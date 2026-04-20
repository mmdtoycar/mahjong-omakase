import { Tile } from './tiles';
import { HandCombination, GameOptions, FanResult, CalcResult, Meld, tileCount, removeTilesOnce } from './types';
import { findAllCombinations } from './hu';

/**
 * Guobiao Mahjong Fan Calculation Engine — Clean-room implementation
 * Complete implementation of all 81 fan types per GB/T 16491—2008.
 */

export function calculateBestScore(concealedTiles: Tile[], melds: Meld[], options: GameOptions, lastTile?: Tile): CalcResult | null {
  const combinations = findAllCombinations(concealedTiles, melds);
  if (combinations.length === 0) return null;

  // Determine ting count: remove lastTile from concealed, check how many tiles complete the hand
  let tingCount = -1; // -1 = unknown
  if (lastTile) {
    const withoutLast = removeTilesOnce(concealedTiles, [lastTile]);
    tingCount = 0;
    for (const t of Tile.all) {
      const testHand = [...withoutLast, t];
      if (findAllCombinations(testHand, melds).length > 0) tingCount++;
    }
  }

  let best: CalcResult | null = null;
  for (const combo of combinations) {
    let tries = [ { combo, completedMeldIdx: -1 } ];
    if (!options.zimo && lastTile && !combo.isSpecial) {
       combo.melds.forEach((m, idx) => {
         if (!m.isOpen && m.tiles.some(t => t.equals(lastTile))) {
           tries.push({ combo, completedMeldIdx: idx });
         }
       });
    }

    for (const t of tries) {
      if (t.completedMeldIdx !== -1) {
         t.combo.melds[t.completedMeldIdx] = { ...t.combo.melds[t.completedMeldIdx], completedByDiscard: true } as any;
      }
      const scored = scoreCombination(t.combo, concealedTiles, options, lastTile, tingCount);
      if (!best || scored.totalScore > best.totalScore) {
        best = scored;
      }
      if (t.completedMeldIdx !== -1) {
         delete (t.combo.melds[t.completedMeldIdx] as any).completedByDiscard;
      }
    }
  }
  return best;
}

// --- Helper: get all starting tiles of shun melds ---
function shunTiles(melds: Meld[]): { suit: string; rank: number }[] {
  return melds.filter(m => m.type === 'shun').map(m => ({ suit: m.tiles[0].suit, rank: m.tiles[0].rank }));
}

// --- Helper: check if 3 tiles form same-type consecutive diff pattern ---
function hasSameTypeAndDiff(tiles: { suit: string; rank: number }[], diff: number): boolean {
  if (tiles.length < 3) return false;
  const sorted = [...tiles].sort((a, b) => a.rank - b.rank);
  return sorted.every(t => t.suit === sorted[0].suit) &&
         sorted[1].rank - sorted[0].rank === diff &&
         sorted[2].rank - sorted[1].rank === diff;
}

// --- Helper: pairs/triples from array ---
function pairs<T>(arr: T[]): [T, T][] {
  const res: [T, T][] = [];
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      res.push([arr[i], arr[j]]);
  return res;
}
function triples<T>(arr: T[]): [T, T, T][] {
  const res: [T, T, T][] = [];
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      for (let k = j + 1; k < arr.length; k++)
        res.push([arr[i], arr[j], arr[k]]);
  return res;
}

// 推不到 tiles: tiles whose face is vertically symmetric
const TUI_BU_DAO_TILES = new Set([
  '1p','2p','3p','4p','5p','8p','9p',
  '2s','4s','5s','6s','8s','9s',
  '7z' // 白
]);

export function scoreCombination(combo: HandCombination, concealedTiles: Tile[], options: GameOptions, lastTile?: Tile, tingCount: number = -1): CalcResult {
  const fans: FanResult[] = [];
  const melds = combo.melds;
  const allTiles = melds.flatMap(m => m.tiles);
  const isSpecial = !!combo.isSpecial;

  const shunMelds = melds.filter(m => m.type === 'shun');
  const keMelds = melds.filter(m => m.type === 'ke' || m.type === 'gang');
  const gangMelds = melds.filter(m => m.type === 'gang');
  const duiMelds = melds.filter(m => m.type === 'dui');

  // Collect suits info
  const numberTiles = allTiles.filter(t => t.isNumber);
  const honorTiles = allTiles.filter(t => t.isHonor);
  const suits = new Set(numberTiles.map(t => t.suit));
  const hasHonors = honorTiles.length > 0;
  const distinctSuits = suits.size;

  // Open/closed info
  const openMelds = melds.filter(m => m.isOpen);
  const allClosed = openMelds.length === 0;

  // Shun start-tile helper arrays
  const shunStarts = shunTiles(melds);
  const keStarts = keMelds.filter(m => m.tiles[0].isNumber).map(m => ({
    suit: m.tiles[0].suit, rank: m.tiles[0].rank
  }));

  // Helper functions
  const addFan = (name: string, score: number, countToAdd: number = 1) => {
    const existing = fans.find(f => f.name === name);
    if (existing) {
        existing.count = (existing.count || 1) + countToAdd;
        existing.score += score * countToAdd;
    } else {
        fans.push({ name, score: score * countToAdd, count: countToAdd });
    }
  };
  const removeFan = (name: string, countToRemove: number = 1) => {
    const existing = fans.find(f => f.name === name);
    if (existing) {
        const baseScore = existing.score / (existing.count || 1);
        existing.count = Math.max(0, (existing.count || 1) - countToRemove);
        existing.score = existing.count * baseScore;
        if (existing.count === 0) {
            const idx = fans.indexOf(existing);
            fans.splice(idx, 1);
        }
    }
  };
  const hasFan = (name: string) => fans.some(f => f.name === name);
  const countFan = (name: string) => {
    const existing = fans.find(f => f.name === name);
    return existing ? (existing.count || 1) : 0;
  };

  // =====================================================================
  // 88 番 (5+2=7种)
  // =====================================================================
  if (isSpecial) {
    // 十三幺 (88) — Check if it's actually thirteen orphans (13 unique yao tiles + 1 duplicate)
    if (melds.length === 14 && melds.every(m => m.type === 'single')) {
      const unique = new Set(allTiles.map(t => t.toString()));
      if (unique.size === 13 && Tile.yao.every(t => unique.has(t.toString()))) {
        addFan('十三幺', 88);
      }
    }
    // 连七对 (88) - 7 consecutive pairs of same suit
    if (melds.length === 7 && melds.every(m => m.type === 'dui')) {
      const duiTiles = melds.map(m => m.tiles[0]).sort((a, b) => a.compareTo(b));
      if (duiTiles.every(t => t.suit === duiTiles[0].suit && t.isNumber) &&
          duiTiles[duiTiles.length - 1].rank - duiTiles[0].rank === 6 &&
          new Set(duiTiles.map(t => t.rank)).size === 7) {
        addFan('连七对', 88);
      }
    }
  }

  if (true) { // removed isSpecial restriction
    // 大四喜 (88)
    if (keMelds.filter(m => m.tiles[0].isWind).length === 4) addFan('大四喜', 88);
    // 大三元 (88)
    if (keMelds.filter(m => m.tiles[0].isDragon).length === 3) addFan('大三元', 88);
    // 绿一色 (88)
    if (allTiles.every(t => t.isGreen)) addFan('绿一色', 88);
    // 九莲宝灯 (88) — same suit, closed, 1112345678999 + any of that suit
    if (allClosed && distinctSuits === 1 && !hasHonors) {
      const s = numberTiles[0].suit;
      const counts = new Map<number, number>();
      allTiles.forEach(t => counts.set(t.rank, (counts.get(t.rank) || 0) + 1));
      // Must have at least: 1×3, 2×1, 3×1, 4×1, 5×1, 6×1, 7×1, 8×1, 9×3
      const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      let isJiuLian = true;
      for (let r = 1; r <= 9; r++) {
        if ((counts.get(r) || 0) < base[r - 1]) { isJiuLian = false; break; }
      }
      if (isJiuLian) addFan('九莲宝灯', 88);
    }
    // 四杠 (88)
    if (gangMelds.length === 4) addFan('四杠', 88);
  }

  // 七对 (24) — must come after 连七对 check
  if (isSpecial && melds.length === 7 && melds.every(m => m.type === 'dui') && !hasFan('连七对')) {
    addFan('七对', 24);
  }

  // =====================================================================
  // 64 番 (6种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 小四喜 (64)
    const windKes = keMelds.filter(m => m.tiles[0].isWind).length;
    const windDui = duiMelds.filter(m => m.tiles[0].isWind).length;
    if (windKes === 3 && windDui === 1 && !hasFan('大四喜')) addFan('小四喜', 64);

    // 小三元 (64)
    const dragonKes = keMelds.filter(m => m.tiles[0].isDragon).length;
    const dragonDui = duiMelds.filter(m => m.tiles[0].isDragon).length;
    if (dragonKes === 2 && dragonDui === 1 && !hasFan('大三元')) addFan('小三元', 64);

    // 字一色 (64)
    if (allTiles.every(t => t.isHonor)) addFan('字一色', 64);

    // 四暗刻 (64)
    if (keMelds.filter(m => !m.isOpen && !(m as any).completedByDiscard).length === 4) addFan('四暗刻', 64);

    // 清幺九 (64)
    if (allTiles.every(t => t.isTerminal)) addFan('清幺九', 64);

    // 一色双龙会 (64) — same suit, 123+123+5+789+789
    if (shunMelds.length === 4 && duiMelds.length === 1) {
      const duiTile = duiMelds[0].tiles[0];
      if (duiTile.isNumber && duiTile.rank === 5) {
        const otherSuits = ['m', 'p', 's'].filter(s => s !== duiTile.suit);
        for (const s of otherSuits) {
          // skip — one-suit double dragon must all be same suit? No, it's 一种花色
        }
        // Check: all 4 shuns are same suit as dui, and contain 2×123 + 2×789
        const sameShuns = shunStarts.filter(ss => ss.suit === duiTile.suit);
        if (sameShuns.length === 4) {
          const r1count = sameShuns.filter(ss => ss.rank === 1).length;
          const r7count = sameShuns.filter(ss => ss.rank === 7).length;
          if (r1count === 2 && r7count === 2) addFan('一色双龙会', 64);
        }
      }
    }
  }

  // =====================================================================
  // 48 番 (2种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 一色四同顺 (48) — 4 shuns, same suit, same rank
    if (shunMelds.length === 4) {
      const ss = shunStarts;
      if (ss.every(s => s.suit === ss[0].suit && s.rank === ss[0].rank)) {
        addFan('一色四同顺', 48);
      }
    }
    // 一色四节高 (48) — 4 kes, same suit, consecutive ranks
    if (keMelds.length === 4 && keStarts.length === 4) {
      const sorted = [...keStarts].sort((a, b) => a.rank - b.rank);
      if (sorted.every(s => s.suit === sorted[0].suit) &&
          sorted[3].rank - sorted[0].rank === 3 &&
          new Set(sorted.map(s => s.rank)).size === 4) {
        addFan('一色四节高', 48);
      }
    }
  }

  // =====================================================================
  // 32 番 (3种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 一色四步高 (32) — 4 shuns, same suit, consecutive diff 1 or 2
    if (shunMelds.length === 4) {
      const ss = shunStarts;
      for (const s of ['m', 'p', 's']) {
        const suitShuns = ss.filter(x => x.suit === s).map(x => x.rank).sort((a, b) => a - b);
        if (suitShuns.length === 4) {
          const diff = suitShuns[1] - suitShuns[0];
          if ((diff === 1 || diff === 2) &&
              suitShuns[2] - suitShuns[1] === diff &&
              suitShuns[3] - suitShuns[2] === diff) {
            addFan('一色四步高', 32);
          }
        }
      }
    }
    // 混幺九 (32)
    if (allTiles.every(t => t.isTerminalOrHonor) && hasHonors && numberTiles.length > 0 &&
        !hasFan('清幺九') && !hasFan('字一色')) {
      addFan('混幺九', 32);
    }
    // 三杠 (32)
    if (gangMelds.length === 3 && !hasFan('四杠')) addFan('三杠', 32);
  }

  // =====================================================================
  // 24 番 (9种)
  // =====================================================================
  // 七星不靠 (24)
  if (isSpecial && combo.isBuKao && honorTiles.length === 7) {
    addFan('七星不靠', 24);
  }

  if (true) { // removed isSpecial restriction
    // 全双刻 (24) — all kes are even numbers, pair is even number
    if (keMelds.length === 4 && keMelds.every(m => m.tiles[0].isNumber && m.tiles[0].rank % 2 === 0) &&
        duiMelds.length === 1 && duiMelds[0].tiles[0].isNumber && duiMelds[0].tiles[0].rank % 2 === 0) {
      addFan('全双刻', 24);
    }
    // 清一色 (24)
    if (distinctSuits === 1 && !hasHonors && numberTiles.length === allTiles.length) addFan('清一色', 24);
    // 一色三同顺 (24) — 3 shuns, same suit, same rank
    for (const s of ['m', 'p', 's']) {
      const suitShuns = shunStarts.filter(x => x.suit === s);
      const counts = new Map<number, number>();
      suitShuns.forEach(ss => counts.set(ss.rank, (counts.get(ss.rank) || 0) + 1));
      let found = false;
      counts.forEach(c => { if (c >= 3) { addFan('一色三同顺', 24); found = true; } });
      if (found) break;
    }
    // 一色三节高 (24) — 3 kes, same suit, consecutive ranks
    for (const s of ['m', 'p', 's']) {
      const suitKes = keStarts.filter(x => x.suit === s).map(x => x.rank).sort((a, b) => a - b);
      for (let i = 0; i <= suitKes.length - 3; i++) {
        if (suitKes[i + 1] === suitKes[i] + 1 && suitKes[i + 2] === suitKes[i] + 2) {
          addFan('一色三节高', 24);
          break;
        }
      }
    }
    // 全大 (24)
    if (allTiles.every(t => t.isNumber && t.rank >= 7)) addFan('全大', 24);
    // 全中 (24)
    if (allTiles.every(t => t.isNumber && t.rank >= 4 && t.rank <= 6)) addFan('全中', 24);
    // 全小 (24)
    if (allTiles.every(t => t.isNumber && t.rank <= 3)) addFan('全小', 24);
  }

  // =====================================================================
  // 16 番 (6种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 清龙 (16)
    for (const s of ['m', 'p', 's']) {
      if (shunStarts.some(ss => ss.suit === s && ss.rank === 1) &&
          shunStarts.some(ss => ss.suit === s && ss.rank === 4) &&
          shunStarts.some(ss => ss.suit === s && ss.rank === 7)) {
        addFan('清龙', 16);
        break;
      }
    }
    // 三色双龙会 (16) — 2 123 shuns of two suits, 2 789 shuns of same two suits, pair of 5 of third suit
    if (shunMelds.length === 4 && duiMelds.length === 1 && duiMelds[0].tiles[0].isNumber && duiMelds[0].tiles[0].rank === 5) {
      const dSuit = duiMelds[0].tiles[0].suit;
      const otherSuits = ['m', 'p', 's'].filter(s => s !== dSuit);
      const reqStarts = [
        { suit: otherSuits[0], rank: 1 }, { suit: otherSuits[0], rank: 7 },
        { suit: otherSuits[1], rank: 1 }, { suit: otherSuits[1], rank: 7 }
      ];
      let matches = 0;
      const usedShuns = new Set<number>();
      for (const req of reqStarts) {
        const idx = shunStarts.findIndex((s, i) => !usedShuns.has(i) && s.suit === req.suit && s.rank === req.rank);
        if (idx !== -1) { matches++; usedShuns.add(idx); }
      }
      if (matches === 4) addFan('三色双龙会', 16);
    }
    // 一色三步高 (16) — same suit, 3 shuns, diff 1 or 2
    for (const s of ['m', 'p', 's']) {
      const suitShuns = shunStarts.filter(x => x.suit === s).map(x => x.rank).sort((a, b) => a - b);
      if (hasSameTypeAndDiff(suitShuns.map(r => ({ suit: s, rank: r })), 1) ||
          hasSameTypeAndDiff(suitShuns.map(r => ({ suit: s, rank: r })), 2)) {
        if (!hasFan('一色四步高')) addFan('一色三步高', 16);
        break;
      }
    }
    // 全带五 (16)
    if (melds.every(m => m.tiles.some(t => t.rank === 5))) addFan('全带五', 16);
    // 三同刻 (16)
    const keCounts = new Map<number, number>();
    keStarts.forEach(k => keCounts.set(k.rank, (keCounts.get(k.rank) || 0) + 1));
    let hasSanTongKe = false;
    keCounts.forEach(c => { if (c >= 3) hasSanTongKe = true; });
    if (hasSanTongKe) addFan('三同刻', 16);
    // 三暗刻 (16)
    if (keMelds.filter(m => !m.isOpen && !(m as any).completedByDiscard).length === 3 && !hasFan('四暗刻')) addFan('三暗刻', 16);
  }

  // =====================================================================
  // 12 番 (5种)
  // =====================================================================
  // 全不靠 (12)
  if (isSpecial && combo.isBuKao && honorTiles.length < 7 && !hasFan('七星不靠')) {
    addFan('全不靠', 12);
  }
  // 组合龙 (12)
  if (combo.isZuHeLong) {
    addFan('组合龙', 12);
  }

  if (true) { // removed isSpecial restriction
    // 大于五 (12)
    if (allTiles.every(t => t.isNumber && t.rank >= 6)) addFan('大于五', 12);
    // 小于五 (12)
    if (allTiles.every(t => t.isNumber && t.rank <= 4)) addFan('小于五', 12);
    // 三风刻 (12)
    if (keMelds.filter(m => m.tiles[0].isWind).length === 3) addFan('三风刻', 12);
  }

  // =====================================================================
  // 8 番 (10种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 三色三同顺 (8)
    for (const triple of triples(shunStarts)) {
      if (triple.every(t => t.rank === triple[0].rank) && new Set(triple.map(t => t.suit)).size === 3) {
        if (!hasFan('一色三同顺')) addFan('三色三同顺', 8);
        break;
      }
    }
    // 三色三节高 (8) — 3 kes, different suits, consecutive ranks
    for (const triple of triples(keStarts)) {
      const sorted = [...triple].sort((a, b) => a.rank - b.rank);
      if (new Set(sorted.map(t => t.suit)).size === 3 &&
          sorted[1].rank - sorted[0].rank === 1 && sorted[2].rank - sorted[1].rank === 1) {
        addFan('三色三节高', 8);
        break;
      }
    }
    // 花龙 (8)
    for (const perm of [['m','p','s'],['m','s','p'],['p','m','s'],['p','s','m'],['s','m','p'],['s','p','m']]) {
      if (shunStarts.some(s => s.suit === perm[0] && s.rank === 1) &&
          shunStarts.some(s => s.suit === perm[1] && s.rank === 4) &&
          shunStarts.some(s => s.suit === perm[2] && s.rank === 7)) {
        addFan('花龙', 8);
        break;
      }
    }
    // 推不到 (8)
    if (allTiles.every(t => TUI_BU_DAO_TILES.has(t.toString()))) addFan('推不到', 8);
    // 双暗杠 (8)
    if (gangMelds.filter(m => !m.isOpen).length === 2) addFan('双暗杠', 8);
    // 无番和 — added at end
  }

  // =====================================================================
  // 6 番 (7种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 碰碰和 (6)
    if (keMelds.length === 4 && !hasFan('一色四节高')) addFan('碰碰和', 6);
    // 混一色 (6)
    if (distinctSuits === 1 && hasHonors && !hasFan('清一色') && !hasFan('字一色')) addFan('混一色', 6);
    // 五门齐 (6)
    const suitSet = new Set(allTiles.map(t => t.suit));
    const hasWindTile = allTiles.some(t => t.isWind);
    const hasDragonTile = allTiles.some(t => t.isDragon);
    if (suitSet.has('m') && suitSet.has('p') && suitSet.has('s') && hasWindTile && hasDragonTile) addFan('五门齐', 6);
    // 全求人 (6)
    if (!options.zimo && openMelds.length === 4) addFan('全求人', 6);
    // 双箭刻 (6)
    if (keMelds.filter(m => m.tiles[0].isDragon).length === 2 && !hasFan('大三元')) addFan('双箭刻', 6);
    // 明暗杠 (6)
    const mingGangCnt = gangMelds.filter(m => m.isOpen).length;
    const anGangCnt = gangMelds.filter(m => !m.isOpen).length;
    if (mingGangCnt >= 1 && anGangCnt >= 1 && gangMelds.length === 2 && !hasFan('三杠') && !hasFan('四杠')) {
      addFan('明暗杠', 6);
    }
    // 三色三步高 (6)
    if (!hasFan('三色三步高')) {
      for (const triple of triples(shunStarts)) {
        const sorted = [...triple].sort((a, b) => a.rank - b.rank);
        if (new Set(sorted.map(t => t.suit)).size === 3) {
          const d = sorted[1].rank - sorted[0].rank;
          if (d >= 1 && d <= 2 && sorted[2].rank - sorted[1].rank === d) {
            addFan('三色三步高', 6);
            break;
          }
        }
      }
    }
  }

  // =====================================================================
  // 4 番 (4种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 全带幺 (4)
    if (melds.every(m => m.tiles.some(t => t.isTerminalOrHonor)) &&
        !hasFan('混幺九') && !hasFan('清幺九') && !hasFan('字一色')) {
      addFan('全带幺', 4);
    }
    // 不求人 (4)
    if (options.zimo && allClosed) addFan('不求人', 4);
    // 和绝张 (4)
    if (options.juezhang) addFan('和绝张', 4);
    // 双明杠 (4)
    const mingGangCount = gangMelds.filter(m => m.isOpen).length;
    if (mingGangCount >= 2 && !hasFan('三杠') && !hasFan('四杠')) addFan('双明杠', 4);
  }

  // =====================================================================
  // 2 番 (10种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 箭刻 (2)
    const dragonKeCount = keMelds.filter(m => m.tiles[0].isDragon).length;
    if (dragonKeCount === 1 && !hasFan('大三元') && !hasFan('小三元') && !hasFan('双箭刻')) addFan('箭刻', 2);

    // 圈风刻 (2)
    if (keMelds.some(m => m.tiles[0].suit === 'z' && m.tiles[0].rank === options.quanfeng)) addFan('圈风刻', 2);
    // 门风刻 (2)
    if (keMelds.some(m => m.tiles[0].suit === 'z' && m.tiles[0].rank === options.menfeng)) addFan('门风刻', 2);

    // 门前清 (2)
    if (allClosed && !hasFan('不求人') && !hasFan('四暗刻')) addFan('门前清', 2);

    // 平和 (2) — 4 shuns + number-tile pair, no honors
    if (shunMelds.length === 4 && !hasHonors) addFan('平和', 2);

    // 四归一 (2)
    const tileCounts = new Map<string, number>();
    allTiles.forEach(t => { const k = t.toString(); tileCounts.set(k, (tileCounts.get(k) || 0) + 1); });
    let siGuiYiCount = 0;
    const gangTileKeys = new Set(gangMelds.map(m => m.tiles[0].toString()));
    tileCounts.forEach((c, k) => { if (c === 4 && !gangTileKeys.has(k)) siGuiYiCount++; });
    if (siGuiYiCount > 0) addFan('四归一', 2, siGuiYiCount);

    // 双同刻 (2)
    let shuangTongKeCount = 0;
    for (const [a, b] of pairs(keStarts)) {
      if (a.rank === b.rank && a.suit !== b.suit) shuangTongKeCount++;
    }
    if (shuangTongKeCount > 0 && !hasFan('三色三节高') && !hasFan('三同刻')) {
      addFan('双同刻', 2, Math.min(2, shuangTongKeCount));
    }

    // 双暗刻 (2)
    const anKeCount2 = keMelds.filter(m => !m.isOpen && !(m as any).completedByDiscard).length;
    if (anKeCount2 === 2 && !hasFan('三暗刻') && !hasFan('四暗刻')) addFan('双暗刻', 2);

    // 暗杠 (2)
    const anGangCount2 = gangMelds.filter(m => !m.isOpen).length;
    if (anGangCount2 === 1 && !hasFan('双暗杠') && !hasFan('三杠') && !hasFan('四杠') && !hasFan('明暗杠')) {
      addFan('暗杠', 2);
    }

    // 断幺 (2)
    if (allTiles.every(t => t.isNumber && t.rank >= 2 && t.rank <= 8)) addFan('断幺', 2);
  }

  // =====================================================================
  // 1 番 (13种)
  // =====================================================================
  if (true) { // removed isSpecial restriction
    // 一般高 (1) — 2 identical shuns (same suit+rank)
    const shunKeysCounts = new Map<string, number>();
    shunStarts.forEach(s => {
      const k = `${s.suit}${s.rank}`;
      shunKeysCounts.set(k, (shunKeysCounts.get(k) || 0) + 1);
    });
    let yiBanGaoCount = 0;
    shunKeysCounts.forEach(c => { if (c >= 2) yiBanGaoCount += Math.floor(c / 2); });
    if (yiBanGaoCount > 0 && !hasFan('一色三同顺') && !hasFan('一色四同顺')) {
      addFan('一般高', 1, Math.min(2, yiBanGaoCount));
    }

    // 喜相逢 (1) — 2 shuns, different suit, same rank
    const usedShunIdx = new Set<number>();
    let xiXiangFengCount = 0;
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedShunIdx.has(i) || usedShunIdx.has(j)) continue;
        if (shunMelds[i].tiles[0].rank === shunMelds[j].tiles[0].rank &&
            shunMelds[i].tiles[0].suit !== shunMelds[j].tiles[0].suit) {
          xiXiangFengCount++;
          usedShunIdx.add(i);
          usedShunIdx.add(j);
        }
      }
    }
    if (xiXiangFengCount > 0 && !hasFan('三色三同顺')) addFan('喜相逢', 1, Math.min(2, xiXiangFengCount));

    // 连六 (1) — same suit, 2 shuns differ by 3
    const usedLL = new Set<number>();
    let lianLiuCount = 0;
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedLL.has(i) || usedLL.has(j)) continue;
        if (shunMelds[i].tiles[0].suit === shunMelds[j].tiles[0].suit &&
            Math.abs(shunMelds[i].tiles[0].rank - shunMelds[j].tiles[0].rank) === 3) {
          lianLiuCount++;
          usedLL.add(i);
          usedLL.add(j);
        }
      }
    }
    if (lianLiuCount > 0 && !hasFan('清龙')) addFan('连六', 1, Math.min(2, lianLiuCount));

    // 老少副 (1) — same suit, 123 and 789
    const usedLS = new Set<number>();
    let laoShaoFuCount = 0;
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedLS.has(i) || usedLS.has(j)) continue;
        if (shunMelds[i].tiles[0].suit === shunMelds[j].tiles[0].suit) {
          const ranks = [shunMelds[i].tiles[0].rank, shunMelds[j].tiles[0].rank].sort();
          if (ranks[0] === 1 && ranks[1] === 7) {
            laoShaoFuCount++;
            usedLS.add(i);
            usedLS.add(j);
          }
        }
      }
    }
    if (laoShaoFuCount > 0 && !hasFan('清龙') && !hasFan('花龙')) addFan('老少副', 1, Math.min(2, laoShaoFuCount));

    // 幺九刻 (1)
    let yaoJiuKeCount = keMelds.filter(m => m.tiles[0].isTerminalOrHonor).length;
    if (hasFan('圈风刻')) yaoJiuKeCount--;
    if (hasFan('门风刻')) yaoJiuKeCount--;
    if (hasFan('箭刻')) yaoJiuKeCount--;
    if (hasFan('双箭刻')) yaoJiuKeCount -= 2;
    if (yaoJiuKeCount > 0 && !hasFan('混幺九') && !hasFan('清幺九') && !hasFan('字一色') &&
        !hasFan('大四喜') && !hasFan('小四喜') && !hasFan('大三元')) {
      addFan('幺九刻', 1, yaoJiuKeCount);
    }

    // 明杠 (1)
    const mingGangCount2 = gangMelds.filter(m => m.isOpen).length;
    if (mingGangCount2 === 1 && !hasFan('双明杠') && !hasFan('明暗杠') && !hasFan('三杠')) addFan('明杠', 1);

    // 缺一门 (1)
    const numSuitCount = ['m', 'p', 's'].filter(s => allTiles.some(t => t.suit === s)).length;
    if (numSuitCount === 2 && !hasFan('清一色') && !hasFan('混一色') && !hasFan('推不到')) {
      addFan('缺一门', 1);
    }

    // 无字 (1)
    if (!hasHonors && !hasFan('平和') && !hasFan('断幺') && !hasFan('清一色') &&
        !hasFan('全大') && !hasFan('全中') && !hasFan('全小') && !hasFan('大于五') && !hasFan('小于五') &&
        !hasFan('清幺九') && !hasFan('全带五') && !hasFan('全双刻')) {
      addFan('无字', 1);
    }

    // 边张 / 坎张 / 单钓将 — only counted when listening on exactly 1 tile
    if (lastTile && tingCount === 1) {
      // Find which meld(s) in this combination contain the lastTile
      const meldsWithLast = melds.filter(m =>
        !m.isOpen && m.tiles.some(t => t.equals(lastTile))
      );

      let isBianZhang = false;
      let isKanZhang = false;
      let isDanDiao = false;

      for (const m of meldsWithLast) {
        if (m.type === 'dui') {
          isDanDiao = true;
        }
        if (m.type === 'shun') {
          const startRank = m.tiles[0].rank;
          // 边张: waiting on 3 in 123, or 7 in 789
          if ((startRank === 1 && lastTile.rank === 3) ||
              (startRank === 7 && lastTile.rank === 7)) {
            isBianZhang = true;
          }
          // 坎张: waiting on middle tile of sequence
          if (lastTile.rank === startRank + 1) {
            isKanZhang = true;
          }
        }
      }

      // Exclusion priority: 单钓将 > 坎张 > 边张
      if (isDanDiao && !hasFan('全求人')) {
        addFan('单钓将', 1);
      } else if (isKanZhang) {
        addFan('坎张', 1);
      } else if (isBianZhang) {
        addFan('边张', 1);
      }
    }
  } // End of !isSpecial block

  // --- Situational Fans (和牌方式) ---
  const hasGang = gangMelds.length > 0;
  if (options.zimo && options.gangShang && hasGang) addFan('杠上开花', 8);
  if (!options.zimo && options.gangShang) {
    // 抢杠和 doesn't require a gang in YOUR hand. You rob someone else's gang.
    // However, Guobiao requires the winning tile to be a single tile wait or at least impossible to be a gang if you have 2. 
    // Specifically, if you have 2+ of the winning tile, someone else couldn't possibly be konging it.
    if (lastTile && tileCount(allTiles, lastTile) <= 2) {
      addFan('抢杠和', 8);
    }
  }
  if (options.zimo && options.lastTile) addFan('妙手回春', 8);
  if (!options.zimo && options.lastTile) addFan('海底捞月', 8);
  if (options.juezhang) addFan('和绝张', 4);
  if (options.zimo && allClosed) addFan('不求人', 4);
  if (!options.zimo && allClosed && !isSpecial) addFan('门前清', 2);
  if (options.zimo && !hasFan('不求人') && !hasFan('妙手回春') && !hasFan('杠上开花')) addFan('自摸', 1);
  if (options.huaCount > 0) addFan('花牌', 1, options.huaCount);

  if (isSpecial) { }

  // =====================================================================
  // EXCLUSIONS (不计)
  if (hasFan('十三幺')) { removeFan('五门齐'); removeFan('不求人'); removeFan('单钓将'); removeFan('门前清'); removeFan('混幺九'); }
  // =====================================================================
  if (hasFan('大四喜')) { removeFan('三风刻'); removeFan('碰碰和'); removeFan('幺九刻'); }
  if (hasFan('大三元')) { removeFan('箭刻'); removeFan('幺九刻'); }
  if (hasFan('九莲宝灯')) { removeFan('清一色'); removeFan('不求人'); removeFan('门前清'); removeFan('幺九刻'); removeFan('无字'); }
  if (hasFan('四杠')) { removeFan('三杠'); removeFan('双暗杠'); removeFan('双明杠'); removeFan('明暗杠'); removeFan('暗杠'); removeFan('明杠'); removeFan('碰碰和'); removeFan('单钓将'); }
  if (hasFan('连七对')) { removeFan('七对'); removeFan('清一色'); removeFan('门前清'); removeFan('不求人'); removeFan('单钓将'); removeFan('无字'); }
  if (hasFan('七对')) { removeFan('门前清'); removeFan('单钓将'); }
  if (hasFan('一色双龙会')) { removeFan('清一色'); removeFan('七对'); removeFan('平和'); removeFan('一般高', 2); removeFan('老少副', 2); removeFan('无字'); }
  if (hasFan('一色四同顺')) { removeFan('一色三同顺'); removeFan('一般高', 6); removeFan('四归一', 4); removeFan('一色三节高'); }
  if (hasFan('一色四节高')) { removeFan('一色三同顺'); removeFan('一色三节高'); removeFan('碰碰和'); }
  if (hasFan('一色三同顺')) { removeFan('一色三节高'); removeFan('一般高', 3); }
  if (hasFan('清一色')) { removeFan('无字'); }
  if (hasFan('混一色')) { removeFan('无字'); }
  if (hasFan('全双刻')) { removeFan('碰碰和'); removeFan('断幺'); removeFan('无字'); }
  if (hasFan('五门齐')) { /* no implicit */ }
  if (hasFan('字一色')) { removeFan('碰碰和'); removeFan('幺九刻', 4); removeFan('全带幺'); }
  if (hasFan('碰碰和')) { removeFan('无番和'); }
  if (hasFan('四暗刻')) { removeFan('三暗刻'); removeFan('双暗刻'); removeFan('不求人'); removeFan('门前清'); removeFan('碰碰和'); }
  if (hasFan('三暗刻')) { removeFan('双暗刻'); }
  if (hasFan('双暗杠')) { removeFan('暗杠', 2); removeFan('双暗刻'); }
  if (hasFan('三杠')) { removeFan('双明杠'); removeFan('双暗杠'); removeFan('明暗杠'); removeFan('暗杠'); removeFan('明杠'); }
  if (hasFan('清幺九')) { removeFan('碰碰和'); removeFan('同刻'); removeFan('幺九刻', 4); removeFan('无字'); removeFan('全带幺'); }
  if (hasFan('清龙')) { removeFan('连六', 2); removeFan('老少副'); }
  if (hasFan('花龙')) { removeFan('喜相逢'); removeFan('老少副'); }
  if (hasFan('推不到')) { removeFan('缺一门'); }
  if (hasFan('平和')) { removeFan('无字'); }
  if (hasFan('断幺')) { removeFan('无字'); }
  if (hasFan('全带五')) { removeFan('断幺'); removeFan('无字'); }
  if (hasFan('不求人')) { removeFan('门前清'); removeFan('自摸'); }
  
  if (combo.isBuKao) {
    removeFan('五门齐'); removeFan('不求人'); removeFan('门前清'); removeFan('单钓将'); removeFan('混幺九');
    removeFan('全带幺'); removeFan('断幺'); removeFan('平和'); removeFan('无字'); removeFan('缺一门');
  }


  if (combo.isZuHeLong) {
    // ZuHeLong can be part of BuKao or standard
    // If it's part of BuKao, it's already counted? No, they can combine.
    // Fixed: in GB, if you have both, they both count.
  }

  // =====================================================================
  // 无番和 (8) — fallback if no scoring fans
  // =====================================================================
  const scoringFans = fans.filter(f => f.name !== '花牌');
  if (scoringFans.length === 0) addFan('无番和', 8);

  const totalScore = fans.reduce((sum, f) => sum + f.score, 0);
  return {
    totalScore,
    fans,
    combination: combo
  };
}
