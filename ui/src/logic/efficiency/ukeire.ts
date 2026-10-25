import { Tile } from '../shared/tiles'
import { calculateShanten, indexToTile, tilesToCounts } from './shanten'

export interface AcceptanceTile {
  tile: Tile
  remaining: number // Remaining copies unseen (max 4 minus in-hand)
}

export interface DiscardAnalysis {
  discardTile: Tile
  shanten: number
  acceptanceTiles: AcceptanceTile[]
  totalUkeire: number
  goodShapeUkeire?: number // For 1-shanten: ukeire tiles that lead to good shape tenpai
  goodShapeRate?: number // goodShapeUkeire / totalUkeire (0 to 1)
  isOptimal: boolean
  isViable: boolean
  isBlunder: boolean
  tag: 'optimal' | 'viable' | 'blunder'
}

function canFormMelds(counts: number[], meldsLeft: number, idx = 0): boolean {
  if (meldsLeft === 0) {
    for (let i = 0; i < 34; i++) {
      if (counts[i] !== 0) return false
    }
    return true
  }
  while (idx < 34 && counts[idx] === 0) idx++
  if (idx >= 34) return false

  // Triplet
  if (counts[idx] >= 3) {
    counts[idx] -= 3
    if (canFormMelds(counts, meldsLeft - 1, idx)) {
      counts[idx] += 3
      return true
    }
    counts[idx] += 3
  }

  // Sequence
  if (idx < 27 && idx % 9 <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0) {
    counts[idx]--
    counts[idx + 1]--
    counts[idx + 2]--
    if (canFormMelds(counts, meldsLeft - 1, idx)) {
      counts[idx]++
      counts[idx + 1]++
      counts[idx + 2]++
      return true
    }
    counts[idx]++
    counts[idx + 1]++
    counts[idx + 2]++
  }

  return false
}

function canForm1PairAnd3Melds(counts11: number[]): boolean {
  for (let p = 0; p < 34; p++) {
    if (counts11[p] >= 2) {
      counts11[p] -= 2
      if (canFormMelds(counts11, 3, 0)) {
        counts11[p] += 2
        return true
      }
      counts11[p] += 2
    }
  }
  return false
}

function isSequenceCompletionWin(tenpai13Counts: number[], winIdx: number): boolean {
  if (winIdx >= 27) return false
  const rank = (winIdx % 9) + 1 // 1..9

  const candidateSeqs: [number, number, number][] = []
  if (rank <= 7) candidateSeqs.push([winIdx, winIdx + 1, winIdx + 2])
  if (rank >= 2 && rank <= 8) candidateSeqs.push([winIdx - 1, winIdx, winIdx + 1])
  if (rank >= 3) candidateSeqs.push([winIdx - 2, winIdx - 1, winIdx])

  tenpai13Counts[winIdx]++
  let completesSequence = false
  for (const [a, b, c] of candidateSeqs) {
    if (tenpai13Counts[a] > 0 && tenpai13Counts[b] > 0 && tenpai13Counts[c] > 0) {
      tenpai13Counts[a]--
      tenpai13Counts[b]--
      tenpai13Counts[c]--
      if (canForm1PairAnd3Melds(tenpai13Counts)) {
        completesSequence = true
      }
      tenpai13Counts[a]++
      tenpai13Counts[b]++
      tenpai13Counts[c]++
      if (completesSequence) break
    }
  }
  tenpai13Counts[winIdx]--
  return completesSequence
}

/**
 * Checks if a tenpai hand has a good-shape wait (好形听牌).
 * A good shape wait is:
 * - 3 or more winning tile types (multi-sided wait), or
 * - 2 winning tile types from a two-sided sequence wait (两面听牌) where both tiles complete sequences,
 *   excluding shanpon (双碰) and tanki (单骑).
 */
export function isGoodShapeTenpai(tenpai13Tiles: Tile[]): boolean {
  const winningIndices: number[] = []
  const counts = tilesToCounts(tenpai13Tiles)

  for (let idx = 0; idx < 34; idx++) {
    if (counts[idx] < 4) {
      counts[idx]++
      const testTiles = [...tenpai13Tiles, indexToTile(idx)]
      if (calculateShanten(testTiles) === -1) {
        winningIndices.push(idx)
      }
      counts[idx]--
    }
  }

  // Multi-sided sequence waits (3 or more winning tile types) are always good shape
  if (winningIndices.length >= 3) {
    return true
  }

  // 2-type wait: must be two-sided sequence wait (两面), never shanpon (双碰)
  if (winningIndices.length === 2) {
    const w1 = indexToTile(winningIndices[0])
    const w2 = indexToTile(winningIndices[1])
    if (w1.suit !== w2.suit || Math.abs(w1.rank - w2.rank) !== 3) {
      return false
    }
    return winningIndices.every((idx) => isSequenceCompletionWin(counts, idx))
  }

  return false
}

/**
 * Given a 14-tile hand, analyze all possible discards.
 */
export function analyzeAllDiscards(hand14Tiles: Tile[]): DiscardAnalysis[] {
  // Deduplicate discard options by tile key
  const uniqueTilesMap = new Map<string, Tile>()
  for (const t of hand14Tiles) {
    uniqueTilesMap.set(t.toString(), t)
  }
  const uniqueTiles = Array.from(uniqueTilesMap.values())

  const results: DiscardAnalysis[] = []

  for (const discardTile of uniqueTiles) {
    // Create 13-tile hand after discarding
    const remainingHand: Tile[] = []
    let discardedOne = false
    for (const t of hand14Tiles) {
      if (!discardedOne && t.equals(discardTile)) {
        discardedOne = true
      } else {
        remainingHand.push(t)
      }
    }

    const currentShanten = calculateShanten(remainingHand)
    const remainingCounts = tilesToCounts(remainingHand)

    const acceptanceList: AcceptanceTile[] = []
    let totalUkeire = 0
    let goodShapeUkeire = 0

    // Test all 34 tiles to see if drawing them decreases shanten
    for (let idx = 0; idx < 34; idx++) {
      const drawnTile = indexToTile(idx)
      const countInHand = remainingCounts[idx]
      const unseenCopies = 4 - countInHand

      if (unseenCopies > 0) {
        const testHand = [...remainingHand, drawnTile]
        const newShanten = calculateShanten(testHand)

        if (newShanten < currentShanten) {
          acceptanceList.push({
            tile: drawnTile,
            remaining: unseenCopies,
          })
          totalUkeire += unseenCopies

          // If current was 1-shanten, drawing this tile achieves tenpai (0-shanten)
          if (currentShanten === 1) {
            // Check if testHand (now 13 tiles after imaginary discard? No, testHand is 14 tiles)
            // Wait, testHand is 14 tiles. In tenpai, we discard one tile to leave 13 tiles in tenpai.
            // Let's find if testHand can discard any tile to form a good shape tenpai!
            let hasGoodShapeTenpai = false
            const testUniqueDiscards = Array.from(new Map(testHand.map((t) => [t.toString(), t])).values())
            for (const d of testUniqueDiscards) {
              const tenpai13: Tile[] = []
              let dOnce = false
              for (const th of testHand) {
                if (!dOnce && th.equals(d)) {
                  dOnce = true
                } else {
                  tenpai13.push(th)
                }
              }
              if (calculateShanten(tenpai13) === 0 && isGoodShapeTenpai(tenpai13)) {
                hasGoodShapeTenpai = true
                break
              }
            }

            if (hasGoodShapeTenpai) {
              goodShapeUkeire += unseenCopies
            }
          }
        }
      }
    }

    const goodShapeRate =
      currentShanten === 1 && totalUkeire > 0 ? Math.round((goodShapeUkeire / totalUkeire) * 100) / 100 : undefined

    results.push({
      discardTile,
      shanten: currentShanten,
      acceptanceTiles: acceptanceList,
      totalUkeire,
      goodShapeUkeire: currentShanten === 1 ? goodShapeUkeire : undefined,
      goodShapeRate,
      isOptimal: false,
      isViable: false,
      isBlunder: false,
      tag: 'blunder',
    })
  }

  // Determine optimal, viable, and blunder
  // Lowest shanten first
  const minShanten = Math.min(...results.map((r) => r.shanten))
  const sameShantenResults = results.filter((r) => r.shanten === minShanten)
  const maxUkeire = Math.max(...sameShantenResults.map((r) => r.totalUkeire))

  for (const r of results) {
    if (r.shanten > minShanten) {
      r.isBlunder = true
      r.tag = 'blunder'
    } else {
      // If this tile achieves max ukeire (or ties)
      if (r.totalUkeire === maxUkeire) {
        // If 1-shanten, check if good shape rate is also highest or near highest
        const maxGoodShape = Math.max(...sameShantenResults.map((x) => x.goodShapeRate ?? 0))
        if (minShanten === 1 && (r.goodShapeRate ?? 0) < maxGoodShape - 0.25) {
          // If good shape rate is drastically lower, mark viable rather than optimal
          r.isViable = true
          r.tag = 'viable'
        } else {
          r.isOptimal = true
          r.tag = 'optimal'
        }
      } else if (r.totalUkeire >= maxUkeire * 0.8) {
        // Within 80% of max ukeire
        r.isViable = true
        r.tag = 'viable'
      } else {
        r.isBlunder = true
        r.tag = 'blunder'
      }
    }
  }

  // If no optimal was assigned because of tie-breaking, assign the one with highest ukeire
  if (!results.some((r) => r.isOptimal)) {
    const highest = sameShantenResults.sort(
      (a, b) => (b.goodShapeRate ?? 0) - (a.goodShapeRate ?? 0) || b.totalUkeire - a.totalUkeire
    )[0]
    if (highest) {
      highest.isOptimal = true
      highest.tag = 'optimal'
    }
  }

  // Sort: optimal first, then by ukeire descending, then shanten ascending
  results.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten
    if (a.isOptimal !== b.isOptimal) return a.isOptimal ? -1 : 1
    return b.totalUkeire - a.totalUkeire
  })

  return results
}
