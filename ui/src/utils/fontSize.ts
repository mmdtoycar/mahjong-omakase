const MOBILE_BREAKPOINT = 640

interface FontSizeTier {
  maxLen: number
  desktop: string
  mobile: string
}

function resolve(text: string, tiers: FontSizeTier[], fallback: { desktop: string; mobile: string }) {
  const len = text.length
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT
  for (const t of tiers) {
    if (len <= t.maxLen) return mobile ? t.mobile : t.desktop
  }
  return mobile ? fallback.mobile : fallback.desktop
}

export function statFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '2rem', mobile: '1.4rem' },
      { maxLen: 8, desktop: '2rem', mobile: '1.1rem' },
      { maxLen: 12, desktop: '1.5rem', mobile: '0.9rem' },
    ],
    { desktop: '1.2rem', mobile: '0.9rem' }
  )
}

export function nameFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '0.95rem', mobile: '1rem' },
      { maxLen: 8, desktop: '0.95rem', mobile: '0.8rem' },
      { maxLen: 12, desktop: '0.8rem', mobile: '0.75rem' },
      { maxLen: 16, desktop: '0.7rem', mobile: '0.6rem' },
    ],
    { desktop: '0.65rem', mobile: '0.45rem' }
  )
}

export function cardFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '1.05rem', mobile: '1rem' },
      { maxLen: 8, desktop: '1.05rem', mobile: '0.8rem' },
      { maxLen: 12, desktop: '0.85rem', mobile: '0.8rem' },
    ],
    { desktop: '0.75rem', mobile: '0.7rem' }
  )
}
