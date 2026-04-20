import { Tile } from './tiles';
import { Meld, HandCombination, countTiles, sortTiles, removeTilesOnce, Tiles, Combination, Dui, Hand, Hu, Ke, QiDui, Shun, Yao13, ZuHeLong, BuKao as BuKaoType, TilePoint, TileNumberTypes } from './types';
import { calcFan } from './fan';

/**
 * Hand Decomposition Logic — Clean-room implementation (HEAD)
 */

export function findAllCombinations(concealedTiles: Tile[], exposedMelds: Meld[]): HandCombination[] {
  const results: HandCombination[] = [];
  const sorted = sortTiles(concealedTiles);
  const numExposed = exposedMelds.length;

  // Standard hand: (4 - numExposed) melds + 1 pair from concealed tiles
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

function decomposeHand(remaining: Tile[], current: Meld[], results: Meld[][], targetGroups: number): void {
  if (remaining.length === 0) {
    if (targetGroups === 0) {
      results.push([...current]);
    }
    return;
  }
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
      decomposeHand(next, current, results, targetGroups - 3);
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

  // Try Sequence (shun)
  if (first.isNumber && first.rank <= 7) {
    const t2 = new Tile(first.type, (first.point + 1) as TilePoint);
    const t3 = new Tile(first.type, (first.point + 2) as TilePoint);
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
  for (const t of Tile.Yao) {
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
  const patterns = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
  const suitPerms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  for (const perm of suitPerms) {
    const required: Tile[] = [];
    for (let i = 0; i < 3; i++) {
        const suit = suits[perm[i]] as any;
        patterns[i].forEach(rank => required.push(Tile.fromString(`${rank}${suit}`)));
    }
    const tempTiles = [...tiles];
    let possible = true;
    for (const req of required) {
        const idx = tempTiles.findIndex(t => t.equals(req));
        if (idx === -1) { possible = false; break; }
        tempTiles.splice(idx, 1);
    }
    if (possible) return required;
  }
  return null;
}

function checkBuKao(tiles: Tile[]): HandCombination | null {
  if (tiles.length !== 14) return null;
  const unique = new Set(tiles.map(t => t.toString()));
  if (unique.size !== 14) return null;
  const numbers = tiles.filter(t => t.isNumber);
  const m = numbers.filter(t => t.suit === 'm').map(t => t.rank).sort((a, b) => a - b);
  const p = numbers.filter(t => t.suit === 'p').map(t => t.rank).sort((a, b) => a - b);
  const s = numbers.filter(t => t.suit === 's').map(t => t.rank).sort((a, b) => a - b);
  const groups = [m, p, s];
  for (const g of groups) {
    for (let i = 0; i < g.length - 1; i++) { if (g[i+1] - g[i] < 3) return null; }
  }
  for (const g of groups) {
    if (g.length > 1) {
        const rem = g[0] % 3;
        if (!g.every(r => r % 3 === rem)) return null;
    }
  }
  const mods = groups.filter(g => g.length > 0).map(g => g[0] % 3);
  if (new Set(mods).size !== mods.length) return null;

  return {
    melds: tiles.map(t => ({ type: 'single' as const, tiles: [t], isOpen: false })),
    isSpecial: true,
    isBuKao: true,
    isZuHeLong: !!findZuHeLong(tiles)
  };
}

/**
 * XDean Logic (main)
 */

export function calcHuBest(hand: Hand): Hu | null {
  const hus = calcHu(hand);
  if (hus.length === 0) return null;
  return hus.reduce((a, b) => a.totalScore > b.totalScore ? a : b);
}

export function calcHu(hand: Hand): Hu[] {
  if (hand.count !== 14) throw new Error('hand count must be 14');
  const mingComb = new Combination(hand.mings.map(m => m.toMian()));
  const result = [];
  for (const comb of findAllCombinationsMain(hand.tiles)) {
    const completeComb = mingComb.with(...comb.mians);
    const fans = calcFan(hand, completeComb);
    result.push(new Hu(completeComb, fans));
  }
  return result;
}

export function findAllCombinationsMain(tiles: Tiles): Combination[] {
  if ((tiles.length - 2) % 3 !== 0 || tiles.length > 14) return [];
  const res = [];
  if (tiles.length === 14) {
    const yao = find13Yao(tiles);
    if (!!yao) return [new Combination([yao])];
    const bukao = findBuKaoMain(tiles);
    if (!!bukao) return [new Combination([bukao])];
    const qidui = findQiDui(tiles);
    if (!!qidui) res.push(new Combination([qidui]));
  }
  const duis = findDui(tiles);
  for (const [left, dui] of duis) {
    for (const [l, zhl] of findZuHeLongMain(left)) {
       const combinations = findShunKeCombinations(l);
       for (const sub of combinations) res.push(sub.with(zhl).with(dui));
    }
    const combinations = findShunKeCombinations(left);
    for (const comb of combinations) res.push(comb.with(dui));
  }
  return res;
}

function findShunKeCombinations(tiles: Tiles): Combination[] {
  if (tiles.length === 0) return [new Combination([])];
  if (tiles.length < 3) return [];
  const res = [];
  for (const [left, ke] of findKe(tiles, tiles.last)) {
    for (const sub of findShunKeCombinations(left)) res.push(sub.with(ke));
  }
  for (const [left, shun] of findShun(tiles, tiles.last)) {
    for (const sub of findShunKeCombinations(left)) res.push(sub.with(shun));
  }
  return res;
}

function findDui(tiles: Tiles): [Tiles, Dui][] {
  const results: [Tiles, Dui][] = [];
  for (const t of tiles.filterMoreThan(1).distinct.tiles) {
    const [left] = tiles.split(t, t);
    results.push([left, new Dui(t)]);
  }
  return results;
}

function findShun(tiles: Tiles, tile: Tile): [Tiles, Shun][] {
  if (tile.type === 'z' || tiles.length < 3) return [];
  return [-2, -1, 0].map(p => p + tile.point)
    .filter(p => p >= 1 && p <= 7)
    .map(p => new Shun(new Tile(tile.type, p as TilePoint)))
    .filter(s => tiles.contains(s.toTiles))
    .map(s => [tiles.split(...s.toTiles.tiles)[0], s]);
}

function findKe(tiles: Tiles, tile: Tile): [Tiles, Ke][] {
  const sames = tiles.filterType(tile.type).filterPoint(tile.point);
  if (sames.length > 2) {
    const [left] = tiles.split(tile, tile, tile);
    return [[left, new Ke(tile)]];
  } else return [];
}

function findZuHeLongMain(tiles: Tiles): [Tiles, ZuHeLong][] {
  if (tiles.length < 9) return [];
  const distinct = tiles.distinct;
  const types = [distinct.filterType('w'), distinct.filterType('b'), distinct.filterType('t')];
  if (types.some(t => t.length < 3)) return [];
  const groups = types.map(ts => {
    const points: TilePoint[][] = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
    return points.map(ps => ts.filterPoint(...ps)).filter(t => t.length === 3);
  });
  if (groups.some(t => t.length === 0)) return [];
  for (const m of groups[0]) {
    for (const p of groups[1]) {
      for (const s of groups[2]) {
        if (m.minPointTile.point !== p.minPointTile.point && m.minPointTile.point !== s.minPointTile.point && p.minPointTile.point !== s.minPointTile.point) {
          const [left, used] = tiles.split(...m.tiles, ...p.tiles, ...s.tiles);
          return [[left, new ZuHeLong(used)]];
        }
      }
    }
  }
  return [];
}

function findQiDui(tiles: Tiles): QiDui | null {
  const single: Tile[] = [];
  const pair: Tile[] = [];
  for (const tile of tiles.tiles) {
    const index = tile.indexIn(single);
    if (index === -1) single.push(tile);
    else { single.splice(index, 1); pair.push(tile); }
  }
  return single.length === 0 ? new QiDui(new Tiles(pair)) : null;
}

function find13Yao(tiles: Tiles): Yao13 | null {
  if (tiles.allIn(Tile.Yao) && tiles.distinct.length === 13) {
    const duis = findDui(tiles);
    return new Yao13(duis[0][1].tile);
  } else return null;
}

function findBuKaoMain(tiles: Tiles): BuKaoType | null {
  if (tiles.distinct.length !== 14) return null;
  const numbers = tiles.filterType(...TileNumberTypes);
  if (numbers.mostPoint[1] > 1) return null;
  if (([[1, 4, 7], [2, 5, 8], [3, 6, 9]] as TilePoint[][]).some(ps => {
    const ts = numbers.filterPoint(...ps);
    return ts.length > ts.mostType[1];
  })) return null;
  if (TileNumberTypes.map(t => tiles.filterType(t)).every(ts => {
    for (const pair of ts.pairs()) {
      if (Math.abs(pair[0].point - pair[1].point) % 3 !== 0) return false;
    }
    return true;
  })) return new BuKaoType(tiles);
  else return null;
}
