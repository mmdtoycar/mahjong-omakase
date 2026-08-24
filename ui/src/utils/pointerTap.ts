import type { PointerEvent } from 'react'

const TAP_MOVE_THRESHOLD_PX = 10

/**
 * onPointerDown fires the instant a finger touches the screen, before the browser knows whether
 * the touch will end up a tap or a scroll — firing the tap action right there misfires on every
 * swipe that starts on the element (e.g. scrolling a row of melds deletes whichever meld the swipe
 * started on). This defers the action to pointerup, and only fires it if the finger didn't move
 * past a small threshold in between — the same tap-vs-drag distinction onClick makes, without its
 * ~300ms synthetic-click delay.
 *
 * Not a hook (despite closing over state) — several call sites need one of these per item inside a
 * `.map()`, where a real hook would break the rules of hooks. A plain closure only has to survive
 * from one pointerdown to the pointerup right after it, which happens well before the next render.
 */
export function pointerTapHandlers(onTap: (() => void) | undefined, disabled = false) {
  let start: { id: number; x: number; y: number } | null = null

  return {
    onPointerDown: (e: PointerEvent) => {
      if (disabled || !onTap || e.button !== 0 || !e.isPrimary || start) return
      start = { id: e.pointerId, x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: PointerEvent) => {
      if (disabled || !onTap || e.button !== 0 || !e.isPrimary || !start || e.pointerId !== start.id) return
      const from = start
      start = null
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_MOVE_THRESHOLD_PX) return
      onTap()
    },
  }
}
