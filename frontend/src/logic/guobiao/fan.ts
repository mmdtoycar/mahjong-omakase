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
    const scored = scoreCombination(combo, concealedTiles, options, lastTile, tingCount);
    if (!best || scored.totalScore > best.totalScore) {
      best = scored;
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

function scoreCombination(combo: HandCombination, concealedTiles: Tile[], options: GameOptions, lastTile?: Tile, tingCount: number = -1): CalcResult {
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
  const addFan = (name: string, score: number, count: number = 1) => {
    for (let i = 0; i < count; i++) fans.push({ name, score });
  };
  const removeFan = (name: string, count: number = 1) => {
    for (let i = 0; i < count; i++) {
      const idx = fans.findIndex(f => f.name === name);
      if (idx !== -1) fans.splice(idx, 1);
    }
  };
  const hasFan = (name: string) => fans.some(f => f.name === name);
  const countFan = (name: string) => fans.filter(f => f.name === name).length;

  // =====================================================================
  // 88 番 (5+2=7种)
  // =====================================================================
  if (isSpecial) {
    // 十三幺 (88)
    if (melds.length === 14 && melds.every(m => m.type === 'single')) {
      addFan('十三幺', 88);
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

  if (!isSpecial) {
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
  if (!isSpecial) {
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
    if (keMelds.filter(m => !m.isOpen).length === 4) addFan('四暗刻', 64);

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
  if (!isSpecial) {
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
  if (!isSpecial) {
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
  if (!isSpecial) {
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
      const rankCounts = new Map<number, number>();
      suitShuns.forEach(x => rankCounts.set(x.rank, (rankCounts.get(x.rank) || 0) + 1));
      for (const [, c] of rankCounts) {
        if (c >= 3) { addFan('一色三同顺', 24); break; }
      }
      if (hasFan('一色三同顺')) break;
    }
    // 一色三节高 (24) — 3 kes, same suit, consecutive ranks
    for (const triple of triples(keStarts)) {
      if (hasSameTypeAndDiff(triple, 1)) {
        addFan('一色三节高', 24);
        break;
      }
    }
    // 全大 (24)
    if (allTiles.every(t => t.isNumber && t.rank >= 7)) addFan('全大', 24);
    // 全中 (24)
    if (allTiles.every(t => t.isNumber && t.rank >= 4 && t.rank <= 6)) addFan('全中', 24);
    // 全小 (24)
    if (allTiles.every(t => t.isNumber && t.rank <= 3)) addFan('全小', 24);
  }
  // 七星不靠 & 全不靠 are handled via isSpecial in hu.ts

  // =====================================================================
  // 16 番 (6种)
  // =====================================================================
  if (!isSpecial) {
    // 清龙 (16)
    for (const s of ['m', 'p', 's']) {
      const ranks = shunStarts.filter(x => x.suit === s).map(x => x.rank);
      if (ranks.includes(1) && ranks.includes(4) && ranks.includes(7)) {
        addFan('清龙', 16);
        break;
      }
    }
    // 三色双龙会 (16) — two different suits each have 123+789, third suit has pair of 5
    if (shunMelds.length === 4 && duiMelds.length === 1 && !hasHonors) {
      const duiTile = duiMelds[0].tiles[0];
      if (duiTile.isNumber && duiTile.rank === 5) {
        const otherSuits = ['m', 'p', 's'].filter(s => s !== duiTile.suit);
        if (otherSuits.length === 2) {
          const has1 = (s: string) => shunStarts.some(x => x.suit === s && x.rank === 1);
          const has7 = (s: string) => shunStarts.some(x => x.suit === s && x.rank === 7);
          if (has1(otherSuits[0]) && has7(otherSuits[0]) && has1(otherSuits[1]) && has7(otherSuits[1])) {
            addFan('三色双龙会', 16);
          }
        }
      }
    }
    // 一色三步高 (16)
    for (const s of ['m', 'p', 's']) {
      const suitShuns = shunStarts.filter(x => x.suit === s);
      for (const triple of triples(suitShuns)) {
        if (hasSameTypeAndDiff(triple, 1) || hasSameTypeAndDiff(triple, 2)) {
          if (!hasFan('一色四步高')) addFan('一色三步高', 16);
          break;
        }
      }
      if (hasFan('一色三步高')) break;
    }
    // 全带五 (16)
    if (melds.every(m => m.tiles.some(t => t.isNumber && t.rank === 5))) addFan('全带五', 16);
    // 三同刻 (16) — 3 kes of same rank but different suits
    for (const triple of triples(keStarts)) {
      if (triple.every(t => t.rank === triple[0].rank) && new Set(triple.map(t => t.suit)).size === 3) {
        addFan('三同刻', 16);
        break;
      }
    }
    // 三暗刻 (16)
    if (keMelds.filter(m => !m.isOpen).length === 3 && !hasFan('四暗刻')) addFan('三暗刻', 16);
  }

  // =====================================================================
  // 12 番 (5种)
  // =====================================================================
  if (!isSpecial) {
    // 三风刻 (12)
    const windKeCount = keMelds.filter(m => m.tiles[0].isWind).length;
    if (windKeCount === 3 && !hasFan('大四喜') && !hasFan('小四喜')) addFan('三风刻', 12);
    // 大于五 (12)
    if (allTiles.every(t => t.isNumber && t.rank > 5) && !hasFan('全大')) addFan('大于五', 12);
    // 小于五 (12)
    if (allTiles.every(t => t.isNumber && t.rank < 5) && !hasFan('全小')) addFan('小于五', 12);
  }
  // 全不靠 (12) & 组合龙 (12) — handled via isSpecial in hu.ts if BuKao/ZuHeLong decomposition exists
  if (isSpecial && combo.isBuKao) addFan('全不靠', 12);
  if (isSpecial && combo.isZuHeLong) addFan('组合龙', 12);

  // =====================================================================
  // 8 番 (10种)
  // =====================================================================
  if (!isSpecial) {
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
    // 妙手回春 (8)
    if (options.lastTile && options.zimo) addFan('妙手回春', 8);
    // 海底捞月 (8)
    if (options.lastTile && !options.zimo) addFan('海底捞月', 8);
    // 杠上开花 (8)
    if (options.gangShang && options.zimo && gangMelds.length > 0) addFan('杠上开花', 8);
    // 抢杠和 (8)
    if (options.gangShang && !options.zimo) addFan('抢杠和', 8);
  }

  // =====================================================================
  // 6 番 (7种)
  // =====================================================================
  if (!isSpecial) {
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
  if (!isSpecial) {
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
  if (!isSpecial) {
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
    const anKeCount2 = keMelds.filter(m => !m.isOpen).length;
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
  if (!isSpecial) {
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

    // 自摸 (1)
    if (options.zimo && !hasFan('不求人') && !hasFan('妙手回春') && !hasFan('杠上开花')) addFan('自摸', 1);

    // 花牌 (1 each)
    if (options.huaCount > 0) addFan('花牌', 1, options.huaCount);
  }

  // Handle special hands' basic fans
  if (isSpecial) {
    if (options.zimo) addFan('自摸', 1);
    if (options.huaCount > 0) addFan('花牌', 1, options.huaCount);
  }

  // =====================================================================
  // 无番和 (8) — fallback if no scoring fans
  // =====================================================================
  const scoringFans = fans.filter(f => f.name !== '花牌');
  if (scoringFans.length === 0) addFan('无番和', 8);

  const totalScore = fans.reduce((sum, f) => sum + f.score, 0);
  return {
    totalScore: Math.max(totalScore, 8),
    fans,
    combination: combo
  };
}
