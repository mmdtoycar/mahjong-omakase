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
 * Calculates ranks and Ranking Points (RP) for a list of player scores.
 */
export function calculateRanks(scores: PlayerScore[], config: RpConfig): PlayerRank[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score)

  const results: PlayerRank[] = []
  const { rpFactor: factor, rpOrigin: origin, umaDist } = config

  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && sorted[j].score === sorted[i].score) {
      j++
    }

    const groupSize = j - i
    const rank = i + 1

    let totalUma = 0
    for (let k = i; k < j; k++) {
      totalUma += umaDist[k] || 0
    }
    const avgUma = totalUma / groupSize

    for (let k = i; k < j; k++) {
      const current = sorted[k]
      const baseRP = current.score / factor
      results.push({
        ...current,
        rank,
        rp: baseRP + avgUma,
      })
    }

    i = j
  }

  return results
}
