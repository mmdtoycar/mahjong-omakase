import { Tile } from '../guobiao/tiles'
import { Meld, HandCombination, sortTiles, countTiles, removeTilesOnce } from './types'

export function findAllCombinations(concealedTiles: Tile[], exposedMelds: Meld[]): HandCombination[] {
  const results: HandCombination[] = []
  const sorted = sortTiles(concealedTiles)
  const numExposed = exposedMelds.length

  if (numExposed === 0 && sorted.length === 14) {
    const sevenPairs = checkChiitoitsu(sorted)
    if (sevenPairs) results.push(sevenPairs)

    const kokushi = checkKokushi(sorted)
    if (kokushi) results.push(kokushi)
  }

  const targetGroups = 5 - numExposed
  const standardResults: Meld[][] = []
  decomposeHand(sorted, [], standardResults, targetGroups, false)

  for (const c of standardResults) {
    results.push({ melds: [...exposedMelds, ...c] })
  }

  return results
}

function decomposeHand(
  remaining: Tile[],
  current: Meld[],
  results: Meld[][],
  targetGroups: number,
  hasPair: boolean
): void {
  if (remaining.length === 0) {
    if (targetGroups === 0) {
      results.push([...current])
    }
    return
  }
  if (targetGroups <= 0) return

  const first = remaining[0]
  const counts = countTiles(remaining)

  // Try pair (only one allowed)
  if (!hasPair && (counts.get(first.toString()) || 0) >= 2) {
    const next = removeTilesOnce(remaining, [first, first])
    current.push({ type: 'jantai', tiles: [first, first], isOpen: false })
    decomposeHand(next, current, results, targetGroups - 1, true)
    current.pop()
  }

  // Try triplet (koutsu)
  if ((counts.get(first.toString()) || 0) >= 3) {
    const next = removeTilesOnce(remaining, [first, first, first])
    current.push({ type: 'koutsu', tiles: [first, first, first], isOpen: false })
    decomposeHand(next, current, results, targetGroups - 1, hasPair)
    current.pop()
  }

  // Try sequence (shuntsu) — numbered tiles only, rank <= 7
  if (first.isNumber && first.rank <= 7) {
    const t2 = new Tile(first.suit, first.rank + 1)
    const t3 = new Tile(first.suit, first.rank + 2)
    if (counts.has(t2.toString()) && counts.has(t3.toString())) {
      const next = removeTilesOnce(remaining, [first, t2, t3])
      current.push({ type: 'shuntsu', tiles: [first, t2, t3], isOpen: false })
      decomposeHand(next, current, results, targetGroups - 1, hasPair)
      current.pop()
    }
  }
}

function checkChiitoitsu(tiles: Tile[]): HandCombination | null {
  const counts = countTiles(tiles)
  if (counts.size !== 7) return null
  for (const c of counts.values()) {
    if (c !== 2) return null
  }
  const pairs: Meld[] = []
  for (const [tStr] of Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const t = Tile.fromString(tStr)
    pairs.push({ type: 'jantai', tiles: [t, t], isOpen: false })
  }
  return { melds: pairs, isChiitoitsu: true }
}

function checkKokushi(tiles: Tile[]): HandCombination | null {
  const yaoTiles = Tile.yao
  const counts = countTiles(tiles)
  for (const y of yaoTiles) {
    if (!counts.has(y.toString())) return null
  }
  // Exactly one duplicate among the 13 yao tiles
  let hasDuplicate = false
  for (const y of yaoTiles) {
    if ((counts.get(y.toString()) || 0) >= 2) {
      hasDuplicate = true
      break
    }
  }
  if (!hasDuplicate) return null
  return {
    melds: tiles.map((t) => ({ type: 'jantai' as const, tiles: [t], isOpen: false })),
    isKokushi: true,
  }
}
