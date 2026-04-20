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

    const buKao = checkBuKao(sorted);
    if (buKao) results.push(buKao);
  }

  // Standard decomposition (including ZuHeLong)
  const standardResults: Meld[][] = [];
  decomposeHand(sorted, [], standardResults, targetGroups);

  for (const c of standardResults) {
    const zuhelong = c.find(m => m.type === 'zuhelong');
    results.push({ 
      melds: [...exposedMelds, ...c],
      isZuHeLong: !!zuhelong
    });
  }

  return results;
}

/**
 * Recursive backtracking decomposition.
 * Tries to split `remaining` tiles into exactly `targetGroups` groups,
 * where exactly one group is a pair (dui) and the rest are melds (ke or shun).
 */
function decomposeHand(remaining: Tile[], current: Meld[], results: Meld[][], targetGroups: number): void {
  if (remaining.length === 0) {
    if (targetGroups === 0) {
      results.push([...current]);
    }
    return;
  }

  // Out of groups to find
  if (targetGroups < 0) return;

  const first = remaining[0];
  const counts = countTiles(remaining);

  // Try Pair (only one allowed)
  const hasPair = current.some(m => m.type === 'dui');
  if (!hasPair && (counts.get(first.toString()) || 0) >= 2) {
    const next = removeTilesOnce(remaining, [first, first]);
    current.push({ type: 'dui', tiles: [first, first], isOpen: false });
    decomposeHand(next, current, results, targetGroups - 1);
    current.pop();
  }

  // Try ZuHeLong (only if no zuhelong yet and we need at least 3 melds)
  const hasZHL = current.some(m => m.type === 'zuhelong');
  if (!hasZHL && targetGroups >= 3) {
    const zhl = findZuHeLong(remaining);
    if (zhl) {
      const next = removeTilesOnce(remaining, zhl);
      current.push({ type: 'zuhelong' as any, tiles: zhl, isOpen: false });
      decomposeHand(next, current, results, targetGroups - 3); // 1 ZHL = 3 melds
      current.pop();
    }
  }

  // Try Triplet (ke)
  if ((counts.get(first.toString()) || 0) >= 3) {
    const next = removeTilesOnce(remaining, [first, first, first]);
    current.push({ type: 'ke', tiles: [first, first, first], isOpen: false });
    decomposeHand(next, current, results, targetGroups - 1);
    current.pop();
  }

  // Try Sequence (shun) — only for numbered tiles, rank <= 7
  if (first.isNumber && first.rank <= 7) {
    const t2 = new Tile(first.suit, first.rank + 1);
    const t3 = new Tile(first.suit, first.rank + 2);
    if (counts.has(t2.toString()) && counts.has(t3.toString())) {
      const next = removeTilesOnce(remaining, [first, t2, t3]);
      current.push({ type: 'shun', tiles: [first, t2, t3], isOpen: false });
      decomposeHand(next, current, results, targetGroups - 1);
      current.pop();
    }
  }
}

function checkSevenPairs(tiles: Tile[]): HandCombination | null {
  const counts = countTiles(tiles);
  for (const c of counts.values()) {
    if (c !== 2 && c !== 4) return null;
  }
  const pairs: Tile[][] = [];
  const entries = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [tStr, c] of entries) {
    const t = Tile.fromString(tStr);
    for (let i = 0; i < c / 2; i++) pairs.push([t, t]);
  }
  return {
    melds: pairs.map(p => ({ type: 'dui', tiles: p, isOpen: false })),
    isSpecial: true
  };
}

function checkThirteenOrphans(tiles: Tile[]): HandCombination | null {
  const unique = new Set(tiles.map(t => t.toString()));
  if (unique.size !== 13) return null;
  for (const t of Tile.yao) {
    if (!unique.has(t.toString())) return null;
  }
  return {
    melds: tiles.map(t => ({ type: 'single' as const, tiles: [t], isOpen: false })),
    isSpecial: true
  };
}

function findZuHeLong(tiles: Tile[]): Tile[] | null {
  if (tiles.length < 9) return null;
  const suits = ['m', 'p', 's'];
  const patterns = [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9]
  ];

  // Try all permutations of suits for the 3 patterns
  const suitPerms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
  ];

  for (const perm of suitPerms) {
    const required: Tile[] = [];
    for (let i = 0; i < 3; i++) {
        const suit = suits[perm[i]] as any;
        patterns[i].forEach(rank => required.push(new Tile(suit, rank)));
    }

    // Check if tiles contains all required
    const tempTiles = [...tiles];
    let possible = true;
    for (const req of required) {
        const idx = tempTiles.findIndex(t => t.equals(req));
        if (idx === -1) {
            possible = false;
            break;
        }
        tempTiles.splice(idx, 1);
    }
    if (possible) return required;
  }
  return null;
}

function checkBuKao(tiles: Tile[]): HandCombination | null {
  if (tiles.length !== 14) return null;
  
  // All 14 tiles must be distinct
  const unique = new Set(tiles.map(t => t.toString()));
  if (unique.size !== 14) return null;

  const numbers = tiles.filter(t => t.isNumber);

  // Group numbers by suit
  const m = numbers.filter(t => t.suit === 'm').map(t => t.rank).sort((a, b) => a - b);
  const p = numbers.filter(t => t.suit === 'p').map(t => t.rank).sort((a, b) => a - b);
  const s = numbers.filter(t => t.suit === 's').map(t => t.rank).sort((a, b) => a - b);

  const groups = [m, p, s];
  
  // Basic BuKao Rule: in each suit, ranks must differ by at least 3
  for (const g of groups) {
    for (let i = 0; i < g.length - 1; i++) {
        if (g[i+1] - g[i] < 3) return null;
    }
  }

  // Patterns Rule: 1-4-7, 2-5-8, 3-6-9 must be distributed across different suits
  for (const g of groups) {
    if (g.length > 1) {
        const rem = g[0] % 3;
        if (!g.every(r => r % 3 === rem)) return null;
    }
  }

  // Cross-suit Rule: Each suit must belong to a different sequence (mod 3)
  const mods = groups.filter(g => g.length > 0).map(g => g[0] % 3);
  if (new Set(mods).size !== mods.length) return null;

  return {
    melds: tiles.map(t => ({ type: 'single' as const, tiles: [t], isOpen: false })),
    isSpecial: true,
    isBuKao: true,
    isZuHeLong: !!findZuHeLong(tiles)
  };
}
