import { describe, it, expect, vi } from 'vitest'
import { pointerTapHandlers } from '../pointerTap'
import type { PointerEvent } from 'react'

const point = (x: number, y: number, button = 0) => ({ button, clientX: x, clientY: y } as PointerEvent)

describe('pointerTapHandlers', () => {
  it('fires on pointerup after a stationary press', () => {
    const onTap = vi.fn()
    const { onPointerDown, onPointerUp } = pointerTapHandlers(onTap)
    onPointerDown(point(10, 10))
    onPointerUp(point(10, 10))
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('does not fire once the finger moved past the tap threshold — a scroll, not a tap', () => {
    const onTap = vi.fn()
    const { onPointerDown, onPointerUp } = pointerTapHandlers(onTap)
    onPointerDown(point(10, 10))
    onPointerUp(point(10, 200))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('does not fire without a matching pointerdown first', () => {
    const onTap = vi.fn()
    const { onPointerUp } = pointerTapHandlers(onTap)
    onPointerUp(point(10, 10))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('ignores non-primary buttons', () => {
    const onTap = vi.fn()
    const { onPointerDown, onPointerUp } = pointerTapHandlers(onTap)
    onPointerDown(point(10, 10, 2))
    onPointerUp(point(10, 10, 2))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const onTap = vi.fn()
    const { onPointerDown, onPointerUp } = pointerTapHandlers(onTap, true)
    onPointerDown(point(10, 10))
    onPointerUp(point(10, 10))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('is a no-op when there is no onTap to call', () => {
    const { onPointerDown, onPointerUp } = pointerTapHandlers(undefined)
    expect(() => {
      onPointerDown(point(10, 10))
      onPointerUp(point(10, 10))
    }).not.toThrow()
  })
})
