import { Tile } from '../shared/tiles'

/**
 * Tile indexing utility:
 * 0..8:   1m..9m
 * 9..17:  1p..9p
 * 18..26: 1s..9s
 * 27..33: 1z..7z
 */
export function tileToIndex(tile: Tile): number {
  if (tile.suit === 'm') return tile.rank - 1
  if (tile.suit === 'p') return 9 + tile.rank - 1
  if (tile.suit === 's') return 18 + tile.rank - 1
  return 27 + tile.rank - 1
}

export function indexToTile(index: number): Tile {
  if (index < 9) return new Tile('m', index + 1)
  if (index < 18) return new Tile('p', index - 9 + 1)
  if (index < 27) return new Tile('s', index - 18 + 1)
  return new Tile('z', index - 27 + 1)
}

export function tilesToCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(34).fill(0)
  for (const t of tiles) {
    counts[tileToIndex(t)]++
  }
  return counts
}

export interface ShantenDetail {
  shanten: number
  standard: number
  chiitoitsu: number
  kokushi: number
}

/**
 * Calculate overall shanten for hand (min of standard, chiitoitsu, kokushi).
 * -1 = Agari (和牌)
 *  0 = Tenpai (听牌)
 *  1 = 1-Shanten (一向听)
 *  ...
 */
export function calculateShanten(tiles: Tile[]): number {
  const counts = tilesToCounts(tiles)
  const std = calculateStandardShantenFromCounts(counts)
  const chitoi = calculateChiitoitsuShantenFromCounts(counts)
  const kokushi = calculateKokushiShantenFromCounts(counts)
  return Math.min(std, chitoi, kokushi)
}

export function calculateShantenDetail(tiles: Tile[]): ShantenDetail {
  const counts = tilesToCounts(tiles)
  const std = calculateStandardShantenFromCounts(counts)
  const chitoi = calculateChiitoitsuShantenFromCounts(counts)
  const kokushi = calculateKokushiShantenFromCounts(counts)
  return {
    shanten: Math.min(std, chitoi, kokushi),
    standard: std,
    chiitoitsu: chitoi,
    kokushi,
  }
}

/**
 * Standard 4-melds + 1-pair shanten calculation.
 */
export function calculateStandardShantenFromCounts(counts: number[]): number {
  let minShanten = 8

  // Case 1: Try with a pair as head
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      counts[i] -= 2
      const res = searchMeldsAndTaatsu(counts, 0, 0, 0)
      const shanten = 7 - 2 * res.melds - Math.min(4 - res.melds, res.taatsu)
      if (shanten < minShanten) {
        minShanten = shanten
      }
      counts[i] += 2
    }
  }

  // Case 2: Without a fixed pair (headless)
  const resNoPair = searchMeldsAndTaatsu(counts, 0, 0, 0)
  const shantenNoPair = 8 - 2 * resNoPair.melds - Math.min(4 - resNoPair.melds, resNoPair.taatsu)
  if (shantenNoPair < minShanten) {
    minShanten = shantenNoPair
  }

  return minShanten
}

interface SearchResult {
  melds: number
  taatsu: number
}

function searchMeldsAndTaatsu(counts: number[], idx: number, melds: number, taatsu: number): SearchResult {
  // Skip zeros
  while (idx < 34 && counts[idx] === 0) {
    idx++
  }
  if (idx >= 34) {
    return { melds, taatsu }
  }

  let best = { melds, taatsu }
  const evaluate = (cand: SearchResult) => {
    // Score based on maximizing 2*melds + taatsu
    const currentScore = 2 * best.melds + Math.min(4 - best.melds, best.taatsu)
    const candScore = 2 * cand.melds + Math.min(4 - cand.melds, cand.taatsu)
    if (candScore > currentScore) {
      best = cand
    } else if (candScore === currentScore && cand.melds > best.melds) {
      best = cand
    }
  }

  // Option 1: Triplet (刻子)
  if (counts[idx] >= 3) {
    counts[idx] -= 3
    evaluate(searchMeldsAndTaatsu(counts, idx, melds + 1, taatsu))
    counts[idx] += 3
  }

  // Option 2: Sequence (顺子) - only for numbered suits (idx < 27 and not across suit boundaries)
  if (idx < 27 && idx % 9 <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0) {
    counts[idx]--
    counts[idx + 1]--
    counts[idx + 2]--
    evaluate(searchMeldsAndTaatsu(counts, idx, melds + 1, taatsu))
    counts[idx]++
    counts[idx + 1]++
    counts[idx + 2]++
  }

  // Option 3: Pair taatsu (对子搭子)
  if (counts[idx] >= 2) {
    counts[idx] -= 2
    evaluate(searchMeldsAndTaatsu(counts, idx + 1, melds, taatsu + 1))
    counts[idx] += 2
  }

  // Option 4: Ryanmen/Penchan sequence taatsu (两面/边张搭子)
  if (idx < 27 && idx % 9 <= 7 && counts[idx + 1] > 0) {
    counts[idx]--
    counts[idx + 1]--
    evaluate(searchMeldsAndTaatsu(counts, idx, melds, taatsu + 1))
    counts[idx]++
    counts[idx + 1]++
  }

  // Option 5: Kanchan sequence taatsu (坎张搭子)
  if (idx < 27 && idx % 9 <= 6 && counts[idx + 2] > 0) {
    counts[idx]--
    counts[idx + 2]--
    evaluate(searchMeldsAndTaatsu(counts, idx, melds, taatsu + 1))
    counts[idx]++
    counts[idx + 2]++
  }

  // Option 6: Skip current tile as isolated
  evaluate(searchMeldsAndTaatsu(counts, idx + 1, melds, taatsu))

  return best
}

/**
 * Chiitoitsu (七对子) shanten calculation.
 */
export function calculateChiitoitsuShantenFromCounts(counts: number[]): number {
  let pairCount = 0
  let uniqueCount = 0

  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      pairCount++
    }
    if (counts[i] >= 1) {
      uniqueCount++
    }
  }

  // Base formula: 6 - pairs + missing distinct kinds
  let shanten = 6 - pairCount
  if (uniqueCount < 7) {
    shanten += 7 - uniqueCount
  }
  return shanten
}

/**
 * Kokushi Musou (国士无双) shanten calculation.
 */
const YAO_INDICES = [
  0,
  8, // 1m, 9m
  9,
  17, // 1p, 9p
  18,
  26, // 1s, 9s
  27,
  28,
  29,
  30,
  31,
  32,
  33, // 1z..7z
]

export function calculateKokushiShantenFromCounts(counts: number[]): number {
  let distinctYao = 0
  let hasPair = false

  for (const idx of YAO_INDICES) {
    if (counts[idx] >= 1) {
      distinctYao++
      if (counts[idx] >= 2) {
        hasPair = true
      }
    }
  }

  return 13 - distinctYao - (hasPair ? 1 : 0)
}
