import { MSG } from '../constants'

/**
 * Abbreviates a name to initials.
 * e.g. "John Doe" -> "J.D."
 * e.g. "john.doe" -> "J.D."
 * e.g. "Single" -> "S."
 */
export function abbrName(name: string | null | undefined): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''

  // Split by common delimiters: space, dot, underscore, hyphen
  const parts = trimmed.split(/[ ._\-]/).filter(Boolean)

  if (parts.length >= 2) {
    const first = parts[0][0].toUpperCase()
    const last = parts[parts.length - 1][0].toUpperCase()
    return `${first}.${last}.`
  }

  // Handle Chinese names or single names
  if (trimmed.length >= 2 && /[^\x00-\xff]/.test(trimmed)) {
    // Basic support for 2+ char CJK names: take first two characters
    return trimmed
      .split('')
      .slice(0, 2)
      .map((c) => c.toUpperCase() + '.')
      .join('')
  }

  return trimmed[0].toUpperCase() + '.'
}

export function scoreClass(score: number): string {
  if (score > 0) return 'score-positive'
  if (score < 0) return 'score-negative'
  return ''
}

export function parseError(e: unknown): string {
  return e instanceof Error ? e.message : MSG.ERROR
}
