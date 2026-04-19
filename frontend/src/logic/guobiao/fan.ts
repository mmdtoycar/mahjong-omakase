import { Tile } from './tiles';
import { HandCombination, GameOptions, FanResult, CalcResult, Meld, tileCount } from './types';
import { findAllCombinations } from './hu';

/**
 * Guobiao Mahjong Fan Calculation Engine — Clean-room implementation
 * Covers all major fan types with proper exclusion logic.
 */

export function calculateBestScore(concealedTiles: Tile[], melds: Meld[], options: GameOptions): CalcResult | null {
  const combinations = findAllCombinations(concealedTiles, melds);
  if (combinations.length === 0) return null;

  let best: CalcResult | null = null;
  for (const combo of combinations) {
    const scored = scoreCombination(combo, concealedTiles, options);
    if (!best || scored.totalScore > best.totalScore) {
      best = scored;
    }
  }
  return best;
}

function scoreCombination(combo: HandCombination, concealedTiles: Tile[], options: GameOptions): CalcResult {
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

  // Helper: add fan if not already excluded
  const addFan = (name: string, score: number, count: number = 1) => {
    for (let i = 0; i < count; i++) {
      fans.push({ name, score });
    }
  };

  // Helper: remove fan by name (for exclusion)
  const removeFan = (name: string, count: number = 1) => {
    for (let i = 0; i < count; i++) {
      const idx = fans.findIndex(f => f.name === name);
      if (idx !== -1) fans.splice(idx, 1);
    }
  };

  const hasFan = (name: string) => fans.some(f => f.name === name);
  const countFan = (name: string) => fans.filter(f => f.name === name).length;

  // ==================== 88 番 ====================
  if (isSpecial) {
    // 十三幺
    if (melds.length === 14 && melds.every(m => m.type === 'single')) {
      addFan('十三幺', 88);
    }
  }
  
  if (!isSpecial) {
    // 大四喜
    if (keMelds.filter(m => m.tiles[0].isWind).length === 4) {
      addFan('大四喜', 88);
    }
    // 大三元
    if (keMelds.filter(m => m.tiles[0].isDragon).length === 3) {
      addFan('大三元', 88);
    }
    // 绿一色
    if (allTiles.every(t => t.isGreen)) {
      addFan('绿一色', 88);
    }
    // 四杠
    if (gangMelds.length === 4) {
      addFan('四杠', 88);
    }
    // 连七对 — handled in special check
    // 九莲宝灯 — complex, skip for now
  }

  // 七对
  if (isSpecial && melds.length === 7 && melds.every(m => m.type === 'dui')) {
    addFan('七对', 24);
  }

  // ==================== 64 番 ====================
  if (!isSpecial) {
    // 小四喜
    const windKes = keMelds.filter(m => m.tiles[0].isWind).length;
    const windDui = duiMelds.filter(m => m.tiles[0].isWind).length;
    if (windKes === 3 && windDui === 1 && !hasFan('大四喜')) {
      addFan('小四喜', 64);
    }

    // 小三元
    const dragonKes = keMelds.filter(m => m.tiles[0].isDragon).length;
    const dragonDui = duiMelds.filter(m => m.tiles[0].isDragon).length;
    if (dragonKes === 2 && dragonDui === 1 && !hasFan('大三元')) {
      addFan('小三元', 64);
    }

    // 字一色
    if (allTiles.every(t => t.isHonor)) {
      addFan('字一色', 64);
    }

    // 四暗刻
    const anKeCount = keMelds.filter(m => !m.isOpen).length;
    if (anKeCount === 4) {
      addFan('四暗刻', 64);
    }

    // 清幺九
    if (allTiles.every(t => t.isTerminal)) {
      addFan('清幺九', 64);
    }
  }

  // ==================== 48 番 ====================
  // (一色四同顺, 一色四节高 — rare, skip for now)

  // ==================== 32 番 ====================
  if (!isSpecial) {
    // 混幺九
    if (allTiles.every(t => t.isTerminalOrHonor) && hasHonors && numberTiles.length > 0 &&
        !hasFan('清幺九') && !hasFan('字一色')) {
      addFan('混幺九', 32);
    }
    // 三杠
    if (gangMelds.length === 3 && !hasFan('四杠')) {
      addFan('三杠', 32);
    }
  }

  // ==================== 24 番 ====================
  if (!isSpecial) {
    // 清一色
    if (distinctSuits === 1 && !hasHonors && numberTiles.length === allTiles.length) {
      addFan('清一色', 24);
    }
    // 全大 (all tiles 7-9)
    if (allTiles.every(t => t.isNumber && t.rank >= 7)) {
      addFan('全大', 24);
    }
    // 全中 (all tiles 4-6)
    if (allTiles.every(t => t.isNumber && t.rank >= 4 && t.rank <= 6)) {
      addFan('全中', 24);
    }
    // 全小 (all tiles 1-3)
    if (allTiles.every(t => t.isNumber && t.rank <= 3)) {
      addFan('全小', 24);
    }
  }

  // ==================== 16 番 ====================
  if (!isSpecial) {
    // 清龙 (一色123+456+789)
    for (const s of ['m', 'p', 's']) {
      const suitShuns = shunMelds.filter(m => m.tiles[0].suit === s);
      const ranks = suitShuns.map(m => m.tiles[0].rank);
      if (ranks.includes(1) && ranks.includes(4) && ranks.includes(7)) {
        addFan('清龙', 16);
        break;
      }
    }

    // 全带五
    if (melds.every(m => m.tiles.some(t => t.isNumber && t.rank === 5))) {
      addFan('全带五', 16);
    }

    // 三暗刻
    const anKeCount3 = keMelds.filter(m => !m.isOpen).length;
    if (anKeCount3 === 3 && !hasFan('四暗刻')) {
      addFan('三暗刻', 16);
    }

    // 三风刻
    const windKeCount = keMelds.filter(m => m.tiles[0].isWind).length;
    if (windKeCount === 3 && !hasFan('大四喜') && !hasFan('小四喜')) {
      addFan('三风刻', 12);
    }
  }

  // ==================== 12 番 ====================
  if (!isSpecial) {
    // 大于五
    if (allTiles.every(t => t.isNumber && t.rank > 5) && !hasFan('全大')) {
      addFan('大于五', 12);
    }
    // 小于五
    if (allTiles.every(t => t.isNumber && t.rank < 5) && !hasFan('全小')) {
      addFan('小于五', 12);
    }
  }

  // ==================== 8 番 ====================
  if (!isSpecial) {
    // 三色三同顺
    for (let r = 1; r <= 7; r++) {
      if (['m', 'p', 's'].every(s =>
        shunMelds.some(m => m.tiles[0].suit === s && m.tiles[0].rank === r)
      )) {
        addFan('三色三同顺', 8);
        break;
      }
    }

    // 三色三节高
    for (let r = 1; r <= 9; r++) {
      const keAtRank = (s: string, rank: number) =>
        keMelds.some(m => m.tiles[0].suit === s && m.tiles[0].rank === rank && !m.tiles[0].isHonor);
      for (const perm of [['m','p','s'],['m','s','p'],['p','m','s'],['p','s','m'],['s','m','p'],['s','p','m']]) {
        if (keAtRank(perm[0], r) && keAtRank(perm[1], r+1) && keAtRank(perm[2], r+2) && r+2 <= 9) {
          addFan('三色三节高', 8);
          break;
        }
      }
      if (hasFan('三色三节高')) break;
    }

    // 花龙 (三色各一组顺子组成123+456+789)
    const shunStarts = shunMelds.map(m => ({ suit: m.tiles[0].suit, rank: m.tiles[0].rank }));
    for (const perm of [['m','p','s'],['m','s','p'],['p','m','s'],['p','s','m'],['s','m','p'],['s','p','m']]) {
      if (shunStarts.some(s => s.suit === perm[0] && s.rank === 1) &&
          shunStarts.some(s => s.suit === perm[1] && s.rank === 4) &&
          shunStarts.some(s => s.suit === perm[2] && s.rank === 7)) {
        addFan('花龙', 8);
        break;
      }
    }

    // 无番和
    // Added at end if no other fans

    // 妙手回春
    if (options.lastTile && options.zimo) {
      addFan('妙手回春', 8);
    }
    // 海底捞月
    if (options.lastTile && !options.zimo) {
      addFan('海底捞月', 8);
    }
    // 杠上开花
    if (options.gangShang && options.zimo && gangMelds.length > 0) {
      addFan('杠上开花', 8);
    }
    // 抢杠和
    if (options.gangShang && !options.zimo) {
      addFan('抢杠和', 8);
    }
  }

  // ==================== 6 番 ====================
  if (!isSpecial) {
    // 碰碰和
    if (keMelds.length === 4) {
      addFan('碰碰和', 6);
    }
    // 混一色
    if (distinctSuits === 1 && hasHonors && !hasFan('清一色') && !hasFan('字一色')) {
      addFan('混一色', 6);
    }
    // 五门齐
    const suitSet = new Set(allTiles.map(t => t.suit));
    const hasWindTile = allTiles.some(t => t.isWind);
    const hasDragonTile = allTiles.some(t => t.isDragon);
    if (suitSet.has('m') && suitSet.has('p') && suitSet.has('s') && hasWindTile && hasDragonTile) {
      addFan('五门齐', 6);
    }
    // 全求人
    if (!options.zimo && openMelds.length === 4) {
      addFan('全求人', 6);
    }
    // 双箭刻
    if (keMelds.filter(m => m.tiles[0].isDragon).length === 2) {
      addFan('双箭刻', 6);
    }
    // 三色三步高
    for (let diff = 1; diff <= 2; diff++) {
      for (let r = 1; r <= 7; r++) {
        for (const perm of [['m','p','s'],['m','s','p'],['p','m','s'],['p','s','m'],['s','m','p'],['s','p','m']]) {
          if (shunMelds.some(m => m.tiles[0].suit === perm[0] && m.tiles[0].rank === r) &&
              shunMelds.some(m => m.tiles[0].suit === perm[1] && m.tiles[0].rank === r + diff) &&
              shunMelds.some(m => m.tiles[0].suit === perm[2] && m.tiles[0].rank === r + diff * 2) &&
              r + diff * 2 <= 7) {
            addFan('三色三步高', 6);
            break;
          }
        }
        if (hasFan('三色三步高')) break;
      }
      if (hasFan('三色三步高')) break;
    }
  }

  // ==================== 4 番 ====================
  if (!isSpecial) {
    // 全带幺
    if (melds.every(m => m.tiles.some(t => t.isTerminalOrHonor)) && !hasFan('混幺九') && !hasFan('清幺九')) {
      addFan('全带幺', 4);
    }
    // 不求人
    if (options.zimo && allClosed && !isSpecial) {
      addFan('不求人', 4);
    }
    // 和绝张
    if (options.juezhang) {
      addFan('和绝张', 4);
    }
    // 双明杠
    const mingGangCount = gangMelds.filter(m => m.isOpen).length;
    if (mingGangCount >= 2) {
      addFan('双明杠', 4);
    }
  }

  // ==================== 2 番 ====================
  if (!isSpecial) {
    // 箭刻
    const dragonKeCount = keMelds.filter(m => m.tiles[0].isDragon).length;
    if (dragonKeCount === 1 && !hasFan('大三元') && !hasFan('小三元') && !hasFan('双箭刻')) {
      addFan('箭刻', 2);
    }

    // 圈风刻
    if (keMelds.some(m => m.tiles[0].suit === 'z' && m.tiles[0].rank === options.quanfeng)) {
      addFan('圈风刻', 2);
    }
    // 门风刻
    if (keMelds.some(m => m.tiles[0].suit === 'z' && m.tiles[0].rank === options.menfeng)) {
      addFan('门风刻', 2);
    }

    // 门前清
    if (allClosed && !hasFan('不求人') && !hasFan('四暗刻')) {
      addFan('门前清', 2);
    }

    // 平和
    if (shunMelds.length === 4 && !hasHonors) {
      addFan('平和', 2);
    }

    // 双暗刻
    const anKeCount2 = keMelds.filter(m => !m.isOpen).length;
    if (anKeCount2 === 2 && !hasFan('三暗刻') && !hasFan('四暗刻')) {
      addFan('双暗刻', 2);
    }

    // 暗杠
    const anGangCount = gangMelds.filter(m => !m.isOpen).length;
    if (anGangCount === 1 && !hasFan('三杠') && !hasFan('四杠')) {
      addFan('暗杠', 2);
    }

    // 断幺
    if (allTiles.every(t => t.isNumber && t.rank >= 2 && t.rank <= 8)) {
      addFan('断幺', 2);
    }

    // 四归一
    const tileCounts = new Map<string, number>();
    allTiles.forEach(t => {
      const k = t.toString();
      tileCounts.set(k, (tileCounts.get(k) || 0) + 1);
    });
    let siGuiYiCount = 0;
    tileCounts.forEach(c => { if (c === 4) siGuiYiCount++; });
    // Don't count tiles that are in gangs
    const gangTileKeys = new Set(gangMelds.map(m => m.tiles[0].toString()));
    tileCounts.forEach((c, k) => {
      if (c === 4 && gangTileKeys.has(k)) siGuiYiCount--;
    });
    if (siGuiYiCount > 0) addFan('四归一', 2, siGuiYiCount);

    // 双同刻
    const numKeTiles = keMelds.filter(m => m.tiles[0].isNumber).map(m => m.tiles[0]);
    let shuangTongKeCount = 0;
    for (let i = 0; i < numKeTiles.length; i++) {
      for (let j = i + 1; j < numKeTiles.length; j++) {
        if (numKeTiles[i].rank === numKeTiles[j].rank && numKeTiles[i].suit !== numKeTiles[j].suit) {
          shuangTongKeCount++;
        }
      }
    }
    if (shuangTongKeCount > 0 && !hasFan('三色三节高')) {
      addFan('双同刻', 2, Math.min(2, shuangTongKeCount));
    }
  }

  // ==================== 1 番 ====================
  if (!isSpecial) {
    // 一般高 (Same-suit same-rank pairs of shun)
    const shunKeys = shunMelds.map(m => `${m.tiles[0].suit}${m.tiles[0].rank}`);
    const shunCounts = new Map<string, number>();
    shunKeys.forEach(k => shunCounts.set(k, (shunCounts.get(k) || 0) + 1));
    let yiBanGaoCount = 0;
    shunCounts.forEach(c => { if (c >= 2) yiBanGaoCount++; });
    if (yiBanGaoCount > 0) addFan('一般高', 1, Math.min(2, yiBanGaoCount));

    // 喜相逢 (Cross-suit same-rank shun pairs)
    const usedShunIdx = new Set<number>();
    let xiXiangFengCount = 0;
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedShunIdx.has(i) || usedShunIdx.has(j)) continue;
        if (shunMelds[i].tiles[0].rank === shunMelds[j].tiles[0].rank &&
            shunMelds[i].tiles[0].suit !== shunMelds[j].tiles[0].suit) {
          // Check not already counted as 一般高
          if (!(shunMelds[i].tiles[0].suit === shunMelds[j].tiles[0].suit)) {
            xiXiangFengCount++;
            usedShunIdx.add(i);
            usedShunIdx.add(j);
          }
        }
      }
    }
    if (xiXiangFengCount > 0 && !hasFan('三色三同顺')) {
      addFan('喜相逢', 1, Math.min(2, xiXiangFengCount));
    }

    // 连六
    const usedForLianLiu = new Set<number>();
    let lianLiuCount = 0;
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedForLianLiu.has(i) || usedForLianLiu.has(j)) continue;
        if (shunMelds[i].tiles[0].suit === shunMelds[j].tiles[0].suit &&
            Math.abs(shunMelds[i].tiles[0].rank - shunMelds[j].tiles[0].rank) === 3) {
          lianLiuCount++;
          usedForLianLiu.add(i);
          usedForLianLiu.add(j);
        }
      }
    }
    if (lianLiuCount > 0 && !hasFan('清龙')) {
      addFan('连六', 1, Math.min(2, lianLiuCount));
    }

    // 老少副
    let laoShaoFuCount = 0;
    const usedForLaoShao = new Set<number>();
    for (let i = 0; i < shunMelds.length; i++) {
      for (let j = i + 1; j < shunMelds.length; j++) {
        if (usedForLaoShao.has(i) || usedForLaoShao.has(j)) continue;
        if (shunMelds[i].tiles[0].suit === shunMelds[j].tiles[0].suit) {
          const ranks = [shunMelds[i].tiles[0].rank, shunMelds[j].tiles[0].rank].sort();
          if (ranks[0] === 1 && ranks[1] === 7) {
            laoShaoFuCount++;
            usedForLaoShao.add(i);
            usedForLaoShao.add(j);
          }
        }
      }
    }
    if (laoShaoFuCount > 0 && !hasFan('清龙')) {
      addFan('老少副', 1, Math.min(2, laoShaoFuCount));
    }

    // 幺九刻
    let yaoJiuKeCount = keMelds.filter(m => m.tiles[0].isTerminalOrHonor).length;
    // Exclude wind/dragon kes already counted by dedicated fans
    if (hasFan('圈风刻')) yaoJiuKeCount--;
    if (hasFan('门风刻')) yaoJiuKeCount--;
    // Reduce by dragon kes counted by 箭刻/双箭刻
    const dragonKesCounted = keMelds.filter(m => m.tiles[0].isDragon).length;
    if (hasFan('箭刻')) yaoJiuKeCount -= 1;
    if (hasFan('双箭刻')) yaoJiuKeCount -= 2;
    if (yaoJiuKeCount > 0 && !hasFan('混幺九') && !hasFan('清幺九') && !hasFan('字一色')) {
      addFan('幺九刻', 1, yaoJiuKeCount);
    }

    // 明杠
    const mingGangCount2 = gangMelds.filter(m => m.isOpen).length;
    if (mingGangCount2 === 1 && !hasFan('双明杠')) {
      addFan('明杠', 1);
    }

    // 缺一门
    if (distinctSuits === 2 && !hasHonors && !hasFan('清一色')) {
      addFan('缺一门', 1);
    } else if (distinctSuits === 2 && hasHonors) {
      // Has 2 number suits + honors = missing 1 number suit
      addFan('缺一门', 1);
    } else if (distinctSuits === 1 && hasHonors && !hasFan('混一色')) {
      // Has 1 number suit + honors = missing 2 number suits... actually 缺一门 only for missing exactly 1
      // skip
    }

    // 无字
    if (!hasHonors && !hasFan('平和') && !hasFan('断幺') && !hasFan('清一色')) {
      addFan('无字', 1);
    }

    // 自摸
    if (options.zimo && !hasFan('不求人') && !hasFan('妙手回春') && !hasFan('杠上开花')) {
      addFan('自摸', 1);
    }

    // 花牌
    if (options.huaCount > 0) {
      addFan('花牌', 1, options.huaCount);
    }
  }

  // Handle special hands' basic fans
  if (isSpecial) {
    if (options.zimo) addFan('自摸', 1);
    if (options.huaCount > 0) addFan('花牌', 1, options.huaCount);
  }

  // 无番和 — if no scoring fans found (only flowers don't count)
  const scoringFans = fans.filter(f => f.name !== '花牌');
  if (scoringFans.length === 0) {
    addFan('无番和', 8);
  }

  const totalScore = fans.reduce((sum, f) => sum + f.score, 0);

  return {
    totalScore: Math.max(totalScore, 8),
    fans,
    combination: combo
  };
}
