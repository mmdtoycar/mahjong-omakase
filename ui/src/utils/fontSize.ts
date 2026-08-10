export const MOBILE_BREAKPOINT = 640

interface FontSizeTier {
  /** Upper bound in half-character units — see visualWidth. 8 = four CJK characters = eight letters. */
  maxWidth: number
  desktop: string
  mobile: string
}

/**
 * Fullwidth characters take a whole em; a latin letter takes about half of one.
 *
 * Written as escapes rather than literal characters: the ranges are the point here and the literal
 * form is unreadable. Block by block —
 *   1100-115F  Hangul Jamo                  2E80-303E  CJK radicals, Kangxi, CJK punctuation
 *   3041-33FF  Kana, Bopomofo, CJK compatibility
 *   3400-4DBF  CJK Extension A              4E00-9FFF  CJK Unified Ideographs
 *   A000-A4CF  Yi                           AC00-D7A3  Hangul syllables
 *   F900-FAFF  CJK compatibility ideographs FE30-FE4F  CJK compatibility forms
 *   FF00-FF60  Fullwidth ASCII              FFE0-FFE6  Fullwidth currency and signs
 */
const FULLWIDTH =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/

/**
 * How wide the text actually draws, in half-character units: fullwidth counts 2, a capital 1.4,
 * anything else 1.
 *
 * Character count is not a usable proxy here. A six-character Chinese name draws twice as wide as a
 * six-letter one, and picking a size by `text.length` gives the Chinese name a font that overflows
 * the column it has to fit.
 */
function visualWidth(text: string) {
  let width = 0
  for (const ch of text) {
    if (FULLWIDTH.test(ch)) width += 2
    else if (ch >= 'A' && ch <= 'Z') width += 1.4
    else width += 1
  }
  return width
}

/**
 * Picks the tier the text fits in.
 *
 * `mobile` is passed in rather than read from `window.innerWidth` here: reading it during render
 * does not subscribe to anything, so rotating an iPad across the breakpoint left the size stuck at
 * whatever it was on the previous orientation. `useIsMobile` subscribes to the media query instead.
 */
function resolveByWidth(
  text: string,
  mobile: boolean,
  tiers: FontSizeTier[],
  fallback: { desktop: string; mobile: string }
) {
  const width = visualWidth(text)
  for (const tier of tiers) {
    if (width <= tier.maxWidth) return mobile ? tier.mobile : tier.desktop
  }
  return mobile ? fallback.mobile : fallback.desktop
}

/**
 * The single hero name on the stats page — one line to itself, so it can stay large.
 *
 * A user name is at most 12 characters (Player.MAX_USERNAME_LENGTH), which is a visual width of 24
 * when every one of them is Chinese. That is why the tiers run past 12: the bound is on characters,
 * not on how wide they draw.
 */
export function statFontSize(text: string, mobile: boolean) {
  return resolveByWidth(
    text,
    mobile,
    [
      { maxWidth: 6, desktop: '2rem', mobile: '1.4rem' },
      { maxWidth: 8, desktop: '2rem', mobile: '1.1rem' },
      { maxWidth: 12, desktop: '1.5rem', mobile: '0.9rem' },
      { maxWidth: 16, desktop: '1.2rem', mobile: '0.8rem' },
      { maxWidth: 22, desktop: '0.9rem', mobile: '0.6rem' },
    ],
    { desktop: '0.75rem', mobile: '0.5rem' }
  )
}

/** A name in a list or a card body, where it shares the row with a badge or a label. */
export function nameFontSize(text: string, mobile: boolean) {
  return resolveByWidth(
    text,
    mobile,
    [
      { maxWidth: 6, desktop: '0.95rem', mobile: '1rem' },
      { maxWidth: 8, desktop: '0.95rem', mobile: '0.8rem' },
      { maxWidth: 12, desktop: '0.8rem', mobile: '0.75rem' },
      { maxWidth: 16, desktop: '0.7rem', mobile: '0.6rem' },
    ],
    { desktop: '0.65rem', mobile: '0.45rem' }
  )
}

/**
 * A player name in a table cell — the tightest case. On a phone the name has roughly 66px left once
 * the 段位 badge has taken half the column, so the tiers drop faster than anywhere else, to get the
 * whole name in rather than an ellipsis. Desktop columns are roomy, so those steps stay gentle.
 */
export function tableNameFontSize(text: string, mobile: boolean) {
  return resolveByWidth(
    text,
    mobile,
    [
      { maxWidth: 8, desktop: '0.95rem', mobile: '0.85rem' },
      { maxWidth: 10, desktop: '0.95rem', mobile: '0.72rem' },
      { maxWidth: 12, desktop: '0.85rem', mobile: '0.62rem' },
      { maxWidth: 14, desktop: '0.8rem', mobile: '0.54rem' },
      { maxWidth: 18, desktop: '0.7rem', mobile: '0.48rem' },
    ],
    { desktop: '0.65rem', mobile: '0.44rem' }
  )
}

/** A name on a selectable player card, which has the whole card width to itself. */
export function cardFontSize(text: string, mobile: boolean) {
  return resolveByWidth(
    text,
    mobile,
    [
      { maxWidth: 6, desktop: '1.05rem', mobile: '1rem' },
      { maxWidth: 8, desktop: '1.05rem', mobile: '0.8rem' },
      { maxWidth: 12, desktop: '0.85rem', mobile: '0.8rem' },
    ],
    { desktop: '0.75rem', mobile: '0.7rem' }
  )
}
