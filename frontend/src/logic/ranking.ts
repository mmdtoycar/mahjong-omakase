import { GameModeKey } from '../types';

export interface PlayerScore {
  playerId: number;
  score: number;
}

export interface PlayerRank extends PlayerScore {
  rank: number;
  rp: number;
}

/**
 * Standard Competition Point (CP) distributions
 */
const RP_DISTRIBUTIONS: Record<GameModeKey, number[]> = {
  GUOBIAO: [15, 5, -5, -15],
  DONGBEI: [15, 5, -5, -15],
  RIICHI: [15, 5, -5, -15],
};

/**
 * Calculates ranks and Ranking Points (RP) for a list of player scores.
 */
export function calculateRanks(
  scores: PlayerScore[], 
  mode: GameModeKey
): PlayerRank[] {
  // Sort by score descending
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  
  const results: PlayerRank[] = [];
  const umaDist = RP_DISTRIBUTIONS[mode] || [0, 0, 0, 0];

  let i = 0;
  while (i < sorted.length) {
    // Find all players with the same score
    let j = i;
    while (j < sorted.length && sorted[j].score === sorted[i].score) {
      j++;
    }

    // Players from index i to j-1 have the same score
    const groupSize = j - i;
    const rank = i + 1;
    
    // Calculate average Uma for this group
    let totalUma = 0;
    for (let k = i; k < j; k++) {
      totalUma += umaDist[k] || 0;
    }
    const avgUma = totalUma / groupSize;

    // Scaling factor for base RP
    const factor = mode === 'RIICHI' ? 1000 : 10;

    for (let k = i; k < j; k++) {
      const current = sorted[k];
      const baseRP = current.score / factor;
      results.push({
        ...current,
        rank,
        rp: baseRP + avgUma
      });
    }

    i = j; // Move to next group
  }

  return results;
}
