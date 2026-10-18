import { describe, it, expect, vi, afterEach } from 'vitest'
import { listenForChanges } from '../index'

const encoder = new TextEncoder()

/** A stream the test feeds by hand, like the server does. */
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: { ok: true, status: 200, body } as unknown as Response,
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('listenForChanges', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function setup(streams: ReturnType<typeof openStream>[]) {
    const fetchMock = vi.fn(() => Promise.resolve(streams.shift()!.response))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', { getItem: () => 'token' })
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    return fetchMock
  }

  it('calls back once for an event that arrives in pieces', async () => {
    const first = openStream()
    setup([first])
    const onChange = vi.fn()
    const stop = listenForChanges(onChange)

    await settle()
    first.send('event:hello\ndata:ok\n\n')
    first.send('event:changed\ndata:')
    await settle()
    expect(onChange).not.toHaveBeenCalled()
    first.send('1\n\n')
    await settle()

    expect(onChange).toHaveBeenCalledTimes(1)
    stop()
  })

  it('ignores heartbeats', async () => {
    const first = openStream()
    setup([first])
    const onChange = vi.fn()
    const stop = listenForChanges(onChange)

    await settle()
    first.send(':ping\n\n')
    await settle()

    expect(onChange).not.toHaveBeenCalled()
    stop()
  })

  it('reconnects after a drop and catches up once it is back', async () => {
    vi.useFakeTimers()
    const first = openStream()
    const second = openStream()
    const fetchMock = setup([first, second])
    const onChange = vi.fn()
    const stop = listenForChanges(onChange)

    await vi.advanceTimersByTimeAsync(0)
    first.end()
    await vi.advanceTimersByTimeAsync(0)
    expect(onChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenCalledTimes(1)
    stop()
  })

  it('sends the login token and stops listening when told to', async () => {
    const first = openStream()
    const fetchMock = setup([first])
    const stop = listenForChanges(vi.fn())

    await settle()
    stop()

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/events')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
    expect((init.signal as AbortSignal).aborted).toBe(true)
  })
})
