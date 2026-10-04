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

/**
 * Checks if a tenpai hand has a good-shape wait (好形听牌).
 * A good shape typically means:
 * - At least 2 winning tile types (e.g. 2-sided ryanmen or 3-sided sequence wait)
 * - Wait tiles are consecutive or sequence-based (excluding shanpon/tanki)
 */
export function isGoodShapeTenpai(tenpai13Tiles: Tile[]): boolean {
  const winningTiles: Tile[] = []
  const counts = tilesToCounts(tenpai13Tiles)

  for (let idx = 0; idx < 34; idx++) {
    if (counts[idx] < 4) {
      counts[idx]++
      // If adding this tile results in Agari (-1 shanten)
      const testTiles = [...tenpai13Tiles, indexToTile(idx)]
      if (calculateShanten(testTiles) === -1) {
        winningTiles.push(indexToTile(idx))
      }
      counts[idx]--
    }
  }

  // If there are at least 2 distinct winning tile types
  if (winningTiles.length >= 2) {
    // Check if wait is ryanmen / sequence-based (not pure shanpon)
    // In a pure shanpon, winning tiles are from 2 pairs waiting for triplets.
    // If it's a sequence wait (like 45 waiting on 3,6), the winning tiles are in the same suit and separated by 3: e.g. 6 - 3 = 3.
    // Or multi-sided sequence wait like 23456 waiting on 1,4,7 (diff = 3 or 6).
    const isSequenceWait = winningTiles.some((w1, i) =>
      winningTiles.some((w2, j) => i !== j && w1.suit === w2.suit && Math.abs(w1.rank - w2.rank) === 3)
    )
    if (isSequenceWait) return true

    // Shanpon (双碰) is technically a 2-type wait (up to 4 remaining tiles), but usually categorized as愚形 in riichi theory.
    // However, if winningTiles has 3 or more types (e.g. 3-sided wait), it's definitely good shape!
    if (winningTiles.length >= 3) return true
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
