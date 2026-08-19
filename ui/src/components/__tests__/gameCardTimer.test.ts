import { describe, it, expect } from 'vitest'
import { remainingMs, timerState, formatRemaining, GAME_DURATION_MS, TIMER_WARNING_MS } from '../GameCard'

// The backend serializes createdAt with a trailing Z (see JacksonConfig) — this pins that contract,
// since two earlier bugs came from assuming the wrong thing about it (missing Z, then a doubled one).
const CREATED_AT = '2026-08-19T12:00:00Z'

describe('GameCard timer', () => {
  it('reads a fresh session as normal, near the full duration', () => {
    const now = new Date(CREATED_AT).getTime() + 1000
    expect(timerState(CREATED_AT, now)).toBe('normal')
    expect(remainingMs(CREATED_AT, now)).toBeCloseTo(GAME_DURATION_MS - 1000, -2)
  })

  it('switches to warning once inside the warning window', () => {
    const now = new Date(CREATED_AT).getTime() + GAME_DURATION_MS - TIMER_WARNING_MS + 1
    expect(timerState(CREATED_AT, now)).toBe('warning')
  })

  it('expires once the duration has elapsed', () => {
    const now = new Date(CREATED_AT).getTime() + GAME_DURATION_MS + 1
    expect(timerState(CREATED_AT, now)).toBe('expired')
  })

  it('formats remaining time as clamped mm:ss, never negative', () => {
    const now = new Date(CREATED_AT).getTime() + GAME_DURATION_MS + 60_000
    expect(formatRemaining(CREATED_AT, now)).toBe('0:00')
  })
})
