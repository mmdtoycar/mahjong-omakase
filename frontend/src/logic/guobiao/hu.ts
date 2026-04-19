import { Tile } from './tiles';
import { Meld, HandCombination, countTiles, sortTiles, removeTilesOnce } from './types';

/**
 * Hand Decomposition Logic — Clean-room implementation
 * 
 * Given concealed tiles and exposed melds, find all valid ways
 * to decompose the concealed tiles into groups (melds + pair).
 */

export function findAllCombinations(concealedTiles: Tile[], exposedMelds: Meld[]): HandCombination[] {
  const results: HandCombination[] = [];
  const sorted = sortTiles(concealedTiles);
  const numExposed = exposedMelds.length;

  // Standard hand: (4 - numExposed) melds + 1 pair from concealed tiles
  // Total groups needed from concealed = (4 - numExposed) + 1 = 5 - numExposed
  const targetGroups = 5 - numExposed;

  // Special hands only possible with no exposed melds and 14 concealed tiles
  if (numExposed === 0 && sorted.length === 14) {
    const sevenPairs = checkSevenPairs(sorted);
    if (sevenPairs) results.push(sevenPairs);

    const thirteenOrphans = checkThirteenOrphans(sorted);
    if (thirteenOrphans) results.push(thirteenOrphans);
  }

  // Standard decomposition
  const standardResults: Meld[][] = [];
  decomposeHand(sorted, [], standardResults, targetGroups);

  for (const c of standardResults) {
    results.push({ melds: [...exposedMelds, ...c] });
  }

  return results;
}

/**
 * Recursive backtracking decomposition.
 * Tries to split `remaining` tiles into exactly `targetGroups` groups,
 * where exactly one group is a pair (dui) and the rest are melds (ke or shun).
 */
function decomposeHand(remaining: Tile[], current: Meld[], results: Meld[][], targetGroups: number) {
  if (remaining.length === 0) {
    if (current.length === targetGroups) {
      results.push([...current]);
    }
    return;
  }

  // Too many groups already
  if (current.length >= targetGroups) return;

  const first = remaining[0];
  const counts = countTiles(remaining);

  // Try Pair (only one allowed)
  const hasPair = current.some(m => m.type === 'dui');
  if (!hasPair && (counts.get(first.toString()) || 0) >= 2) {
    const next = removeTilesOnce(remaining, [first, first]);
    current.push({ type: 'dui', tiles: [first, first], isOpen: false });
    decomposeHand(next, current, results, targetGroups);
    current.pop();
  }

  // Try Triplet (ke)
  if ((counts.get(first.toString()) || 0) >= 3) {
    const next = removeTilesOnce(remaining, [first, first, first]);
    current.push({ type: 'ke', tiles: [first, first, first], isOpen: false });
    decomposeHand(next, current, results, targetGroups);
    current.pop();
  }

  // Try Sequence (shun) — only for numbered tiles, rank <= 7
  if (first.isNumber && first.rank <= 7) {
    const t2 = new Tile(first.suit, first.rank + 1);
    const t3 = new Tile(first.suit, first.rank + 2);
    if (counts.has(t2.toString()) && counts.has(t3.toString())) {
      const next = removeTilesOnce(remaining, [first, t2, t3]);
      current.push({ type: 'shun', tiles: [first, t2, t3], isOpen: false });
      decomposeHand(next, current, results, targetGroups);
      current.pop();
    }
  }
}

function checkSevenPairs(tiles: Tile[]): HandCombination | null {
  if (tiles.length !== 14) return null;
  const counts = countTiles(tiles);
  const pairs: Meld[] = [];
  for (const [key, count] of counts.entries()) {
    if (count % 2 !== 0) return null;
    for (let i = 0; i < count / 2; i++) {
      const t = Tile.fromString(key);
      pairs.push({ type: 'dui', tiles: [t, t], isOpen: false });
    }
  }
  return { melds: pairs, isSpecial: true };
}

function checkThirteenOrphans(tiles: Tile[]): HandCombination | null {
  if (tiles.length !== 14) return null;
  const yaoTiles = Tile.yao;
  // All 14 tiles must be yao tiles
  if (!tiles.every(t => yaoTiles.some(y => y.equals(t)))) return null;
  // Must have all 13 unique yao tiles
  const counts = countTiles(tiles);
  if (counts.size !== 13) return null;
  // Exactly one tile appears twice
  let hasDup = false;
  for (const c of counts.values()) {
    if (c === 2) hasDup = true;
    else if (c !== 1) return null;
  }
  if (!hasDup) return null;

  return {
    melds: tiles.map(t => ({ type: 'single' as const, tiles: [t], isOpen: false })),
    isSpecial: true
  };
}
