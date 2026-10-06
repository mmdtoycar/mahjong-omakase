import { MSG } from '../constants'
import { PlayerInfo, TierKey, tierLabel } from '../types'

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

/** Medal emoji for the top 3 ranks (🥇🥈🥉), null for 4th and beyond. */
export function rankMedal(rank: number): string | null {
  return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? null
}

/**
 * In-game seat ranking (fixed 3–4 seats): podium + 🤡 for the 4th (last) seat.
 * Use in per-game views (对局内); NOT the global leaderboard where 4th isn't "last".
 */
export function seatRankMedal(rank: number): string | null {
  return { 1: '🥇', 2: '🥈', 3: '🥉', 4: '🤡' }[rank] ?? null
}

/**
 * 段位分 for display. 未定段(不足 5 场)的分数还在统计中, 所以带上 (?) 后缀; 完全没有数据时给 "-".
 * 半角括号 — 全角 （？） 在窄列里会被当成两个字宽, 挤到第二行.
 */
export function skillRatingText(rating: number | undefined, tier: TierKey | null | undefined): string {
  if (!rating) return '-'
  const val = rating.toFixed(0)
  return !tier || tier === 'UNRANKED' ? `${val}(?)` : val
}

/** Points into the current star out of the star's cap, e.g. "63/100". */
export function ladderPointsText(points: number, starCap: number): string {
  return `${Math.floor(points)}/${starCap}`
}

/** A seat's 段位 after a game, e.g. 美猴王 2星 98/150; null while unranked. */
export function ladderResultText(p: PlayerInfo): string | null {
  if (!p.tier || p.tier === 'UNRANKED' || p.points == null || !p.starCap) return null
  const pts = ladderPointsText(p.points, p.starCap)
  return p.douLevel ? `${tierLabel(p.tier)} Lv.${p.douLevel} ${pts} 豆` : `${tierLabel(p.tier)} ${p.stars}星 ${pts}`
}

export function ladderMoveText(p: PlayerInfo): string | null {
  if (!p.tier) return null
  switch (p.ladderMove) {
    case 'TIER_UP':
      return `晋升${tierLabel(p.tier)}`
    case 'STAR_UP':
      return p.douLevel ? `升至 Lv.${p.douLevel}` : '升星'
    case 'STAR_DOWN':
      return p.douLevel ? `降至 Lv.${p.douLevel}` : '掉星'
    case 'TIER_DOWN':
      return `降为${tierLabel(p.tier)}`
    default:
      return null
  }
}

/** 段位分 for a stats row: 段位战 points, or the old rating before it; (?) while unranked. */
export function tierScoreText(row: {
  skillRating?: number
  tier?: TierKey | null
  ladderPoints?: number | null
  starCap?: number | null
}): string {
  if (row.ladderPoints == null || !row.starCap) return skillRatingText(row.skillRating, row.tier)
  const val = ladderPointsText(row.ladderPoints, row.starCap)
  return !row.tier || row.tier === 'UNRANKED' ? `${val}(?)` : val
}
