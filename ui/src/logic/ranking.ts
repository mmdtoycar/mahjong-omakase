export interface PlayerScore {
  playerId: number
  score: number
}

export interface PlayerRank extends PlayerScore {
  rank: number
  rp: number
}

export interface RpConfig {
  rpFactor: number
  rpOrigin: number
  umaDist: number[]
}

/**
 * Standard competition ranking: sort by score descending, tied scores share the
 * same rank, and the next distinct score skips (e.g. [100,50,30,30] → ranks
 * [1,2,3,3]; [50,50,30,10] → [1,1,3,4]). Sort is stable, so tied items keep their
 * input order. This is the single source of truth for per-game rank across the UI
 * and matches the backend RpCalculator.
 */
export function rankByScore<T extends object>(items: T[], getScore: (t: T) => number): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => getScore(b) - getScore(a))
  const result: (T & { rank: number })[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && getScore(sorted[j]) === getScore(sorted[i])) j++
    const rank = i + 1
    for (let k = i; k < j; k++) result.push({ ...sorted[k], rank })
    i = j
  }
  return result
}

/**
 * Calculates ranks and Ranking Points (RP) for a list of player scores.
 */
export function calculateRanks(scores: PlayerScore[], config: RpConfig): PlayerRank[] {
  const { rpFactor: factor, umaDist } = config
  const ranked = rankByScore(scores, (s) => s.score)

  const results: PlayerRank[] = []
  let i = 0
  while (i < ranked.length) {
    // Rank groups are contiguous (same score → same rank), so group by rank.
    let j = i
    while (j < ranked.length && ranked[j].rank === ranked[i].rank) j++

    let totalUma = 0
    for (let k = i; k < j; k++) {
      totalUma += umaDist[k] || 0
    }
    const avgUma = totalUma / (j - i)

    for (let k = i; k < j; k++) {
      results.push({
        playerId: ranked[k].playerId,
        score: ranked[k].score,
        rank: ranked[k].rank,
        rp: ranked[k].score / factor + avgUma,
      })
    }

    i = j
  }

  return results
}
