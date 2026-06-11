import { Tile } from '../shared/tiles'
import { Meld, HandCombination, GameOptions, YakuResult } from './types'
import { determineWaitType } from './fu'

export function detectYaku(
  combination: HandCombination,
  allTiles: Tile[],
  winTile: Tile,
  options: GameOptions
): YakuResult[] {
  if (combination.isKokushi) return detectKokushiYaku(allTiles, winTile, options)
  if (combination.isChiitoitsu) return detectChiitoitsuYaku(combination, allTiles, options)
  return detectStandardYaku(combination, allTiles, winTile, options)
}

function detectKokushiYaku(_allTiles: Tile[], _winTile: Tile, options: GameOptions): YakuResult[] {
  const yaku: YakuResult[] = [{ name: '国士无双', han: 13, isYakuman: true }]
  addSituationalYakuman(yaku, options)
  return yaku
}

function detectChiitoitsuYaku(_combination: HandCombination, allTiles: Tile[], options: GameOptions): YakuResult[] {
  const yaku: YakuResult[] = [{ name: '七对子', han: 2 }]
  const isMenqing = true

  if (options.isTsumo) yaku.push({ name: '门前清自摸和', han: 1 })
  addRiichiYaku(yaku, options)
  if (checkTanyao(allTiles)) yaku.push({ name: '断幺九', han: 1 })
  if (checkHonroutou(allTiles)) yaku.push({ name: '混老头', han: 2 })
  if (checkHonitsu(allTiles)) yaku.push({ name: '混一色', han: isMenqing ? 3 : 2 })
  if (checkChinitsu(allTiles)) yaku.push({ name: '清一色', han: isMenqing ? 6 : 5 })

  // Yakuman checks
  const yakuman = detectChiitoitsuYakuman(allTiles, options)
  if (yakuman.length > 0) return yakuman

  addHaiteiYaku(yaku, options)
  addDoraYaku(yaku, options)
  return yaku
}

function detectChiitoitsuYakuman(allTiles: Tile[], options: GameOptions): YakuResult[] {
  const yaku: YakuResult[] = []
  if (checkTsuuiisou(allTiles)) yaku.push({ name: '字一色', han: 13, isYakuman: true })
  addSituationalYakuman(yaku, options)
  if (yaku.length === 0) return []
  return yaku
}

function detectStandardYaku(
  combination: HandCombination,
  allTiles: Tile[],
  winTile: Tile,
  options: GameOptions
): YakuResult[] {
  // Check yakuman first
  const yakuman = detectYakuman(combination, allTiles, winTile, options)
  if (yakuman.length > 0) return yakuman

  const yaku: YakuResult[] = []
  const melds = combination.melds
  const pair = melds.find((m) => m.type === 'duizi')!
  const groups = melds.filter((m) => m.type !== 'duizi')
  const isMenqing = groups.every((m) => !m.isOpen)
  const shunziMelds = groups.filter((m) => m.type === 'shunzi')
  const keziMelds = groups.filter((m) => m.type === 'kezi' || m.type === 'gangzi')

  // 1-han yaku
  if (isMenqing && options.isTsumo) yaku.push({ name: '门前清自摸和', han: 1 })
  addRiichiYaku(yaku, options, isMenqing)

  if (isMenqing && checkPinfu(combination, winTile, options)) {
    yaku.push({ name: '平和', han: 1 })
  }

  if (checkTanyao(allTiles)) yaku.push({ name: '断幺九', han: 1 })

  if (isMenqing && checkIipeiko(shunziMelds) && !checkRyanpeiko(shunziMelds)) {
    yaku.push({ name: '一杯口', han: 1 })
  }

  // Yakuhai
  const yakuhaiList = checkYakuhai(keziMelds, options)
  for (const y of yakuhaiList) yaku.push(y)

  // 2-han yaku
  if (checkSanshokuDoujun(shunziMelds)) {
    yaku.push({ name: '三色同顺', han: isMenqing ? 2 : 1 })
  }
  if (checkIttsu(shunziMelds)) {
    yaku.push({ name: '一气通贯', han: isMenqing ? 2 : 1 })
  }
  if (checkChanta(melds)) {
    yaku.push({ name: '混全带幺九', han: isMenqing ? 2 : 1 })
  }
  if (checkToitoi(groups)) yaku.push({ name: '对对和', han: 2 })
  const waitType = determineWaitType(combination, winTile)
  if (checkSanankou(keziMelds, winTile, options.isTsumo, waitType)) {
    yaku.push({ name: '三暗刻', han: 2 })
  }
  if (checkSanshokuDoukou(keziMelds)) yaku.push({ name: '三色同刻', han: 2 })
  if (checkHonroutou(allTiles)) yaku.push({ name: '混老头', han: 2 })
  if (checkSangangzi(keziMelds)) yaku.push({ name: '三杠子', han: 2 })
  if (checkShousangen(keziMelds, pair)) yaku.push({ name: '小三元', han: 2 })

  // 3-han yaku
  if (isMenqing && checkRyanpeiko(shunziMelds)) yaku.push({ name: '二杯口', han: 3 })
  if (checkHonitsu(allTiles)) yaku.push({ name: '混一色', han: isMenqing ? 3 : 2 })
  if (checkJunchan(melds)) yaku.push({ name: '纯全带幺九', han: isMenqing ? 3 : 2 })

  // 6-han yaku
  if (checkChinitsu(allTiles)) yaku.push({ name: '清一色', han: isMenqing ? 6 : 5 })

  addHaiteiYaku(yaku, options)
  addDoraYaku(yaku, options)

  // Remove conflicts
  removeConflicts(yaku)

  return yaku
}

function detectYakuman(
  combination: HandCombination,
  allTiles: Tile[],
  winTile: Tile,
  options: GameOptions
): YakuResult[] {
  const yaku: YakuResult[] = []
  const melds = combination.melds
  const pair = melds.find((m) => m.type === 'duizi')!
  const groups = melds.filter((m) => m.type !== 'duizi')
  const keziMelds = groups.filter((m) => m.type === 'kezi' || m.type === 'gangzi')
  const isMenqing = groups.every((m) => !m.isOpen)

  if (isMenqing && checkSuuankou(keziMelds, winTile, options.isTsumo)) {
    yaku.push({ name: '四暗刻', han: 13, isYakuman: true })
  }
  if (checkDaisangen(keziMelds)) yaku.push({ name: '大三元', han: 13, isYakuman: true })
  if (checkShousuushii(keziMelds, pair)) yaku.push({ name: '小四喜', han: 13, isYakuman: true })
  if (checkDaisuushii(keziMelds)) yaku.push({ name: '大四喜', han: 13, isYakuman: true })
  if (checkTsuuiisou(allTiles)) yaku.push({ name: '字一色', han: 13, isYakuman: true })
  if (checkRyuuiisou(allTiles)) yaku.push({ name: '绿一色', han: 13, isYakuman: true })
  if (checkChinroutou(allTiles)) yaku.push({ name: '清老头', han: 13, isYakuman: true })
  if (isMenqing && checkChuuren(allTiles)) yaku.push({ name: '九莲宝灯', han: 13, isYakuman: true })
  if (checkSuugangzi(keziMelds)) yaku.push({ name: '四杠子', han: 13, isYakuman: true })

  addSituationalYakuman(yaku, options)

  return yaku
}

// --- Yaku check helpers ---

function checkPinfu(combination: HandCombination, winTile: Tile, options: GameOptions): boolean {
  const melds = combination.melds
  const groups = melds.filter((m) => m.type !== 'duizi')
  const pair = melds.find((m) => m.type === 'duizi')!

  // All groups must be shunzi
  if (!groups.every((m) => m.type === 'shunzi')) return false

  // Pair must not be yakuhai
  const pairTile = pair.tiles[0]
  if (pairTile.isDragon) return false
  if (pairTile.isWind && pairTile.rank === options.changfeng) return false
  if (pairTile.isWind && pairTile.rank === options.zifeng) return false

  // Must be liangmian (two-sided) wait
  const waitType = determineWaitType(combination, winTile)
  return waitType === 'liangmian'
}

function checkTanyao(allTiles: Tile[]): boolean {
  return allTiles.every((t) => t.isNumber && t.rank >= 2 && t.rank <= 8)
}

function checkIipeiko(shunziMelds: Meld[]): boolean {
  for (let i = 0; i < shunziMelds.length; i++) {
    for (let j = i + 1; j < shunziMelds.length; j++) {
      if (meldsIdentical(shunziMelds[i], shunziMelds[j])) return true
    }
  }
  return false
}

function checkRyanpeiko(shunziMelds: Meld[]): boolean {
  if (shunziMelds.length < 4) return false
  let pairs = 0
  const used = new Set<number>()
  for (let i = 0; i < shunziMelds.length; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < shunziMelds.length; j++) {
      if (used.has(j)) continue
      if (meldsIdentical(shunziMelds[i], shunziMelds[j])) {
        pairs++
        used.add(i)
        used.add(j)
        break
      }
    }
  }
  return pairs >= 2
}

function checkYakuhai(keziMelds: Meld[], options: GameOptions): YakuResult[] {
  const results: YakuResult[] = []
  for (const m of keziMelds) {
    const t = m.tiles[0]
    if (t.isDragon) {
      const names: Record<number, string> = { 5: '役牌:中', 6: '役牌:发', 7: '役牌:白' }
      results.push({ name: names[t.rank], han: 1 })
    }
    if (t.isWind && t.rank === options.changfeng) {
      results.push({ name: '役牌:场风牌', han: 1 })
    }
    if (t.isWind && t.rank === options.zifeng) {
      results.push({ name: '役牌:自风牌', han: 1 })
    }
  }
  return results
}

function checkSanshokuDoujun(shunziMelds: Meld[]): boolean {
  for (const m of shunziMelds) {
    const rank = m.tiles[0].rank
    const suits = new Set(shunziMelds.filter((s) => s.tiles[0].rank === rank).map((s) => s.tiles[0].suit))
    if (suits.size >= 3 && suits.has('m') && suits.has('p') && suits.has('s')) return true
  }
  return false
}

function checkIttsu(shunziMelds: Meld[]): boolean {
  for (const suit of ['m', 'p', 's'] as const) {
    const suitMelds = shunziMelds.filter((m) => m.tiles[0].suit === suit)
    const starts = new Set(suitMelds.map((m) => m.tiles[0].rank))
    if (starts.has(1) && starts.has(4) && starts.has(7)) return true
  }
  return false
}

function checkChanta(melds: Meld[]): boolean {
  // All groups (including pair) must contain a terminal or honor
  // At least one group must be a shunzi (otherwise it's honroutou or toitoi)
  const hasShuntsu = melds.some((m) => m.type === 'shunzi')
  if (!hasShuntsu) return false
  const hasHonor = melds.some((m) => m.tiles.some((t) => t.isHonor))
  if (!hasHonor) return false
  return melds.every((m) => m.tiles.some((t) => t.isTerminalOrHonor))
}

function checkJunchan(melds: Meld[]): boolean {
  const hasShuntsu = melds.some((m) => m.type === 'shunzi')
  if (!hasShuntsu) return false
  // No honors allowed
  if (melds.some((m) => m.tiles.some((t) => t.isHonor))) return false
  return melds.every((m) => m.tiles.some((t) => t.isTerminal))
}

function checkToitoi(groups: Meld[]): boolean {
  return groups.every((m) => m.type === 'kezi' || m.type === 'gangzi')
}

function checkSanankou(keziMelds: Meld[], winTile: Tile, isTsumo: boolean, waitType: string): boolean {
  let closedKoutsu = 0
  let ronTargetCounted = false
  for (const m of keziMelds) {
    if (m.isOpen) continue
    if (!isTsumo && waitType === 'duipeng' && !ronTargetCounted && m.tiles[0].equals(winTile)) {
      ronTargetCounted = true
      continue
    }
    closedKoutsu++
  }
  return closedKoutsu === 3
}

function checkSanshokuDoukou(keziMelds: Meld[]): boolean {
  for (const m of keziMelds) {
    const t = m.tiles[0]
    if (!t.isNumber) continue
    const suits = new Set(
      keziMelds.filter((k) => k.tiles[0].isNumber && k.tiles[0].rank === t.rank).map((k) => k.tiles[0].suit)
    )
    if (suits.size >= 3) return true
  }
  return false
}

function checkHonroutou(allTiles: Tile[]): boolean {
  const hasTerminal = allTiles.some((t) => t.isTerminal)
  const hasHonor = allTiles.some((t) => t.isHonor)
  return hasTerminal && hasHonor && allTiles.every((t) => t.isTerminalOrHonor)
}

function checkSangangzi(keziMelds: Meld[]): boolean {
  return keziMelds.filter((m) => m.type === 'gangzi').length === 3
}

function checkShousangen(keziMelds: Meld[], pair: Meld): boolean {
  const dragonKoutsu = keziMelds.filter((m) => m.tiles[0].isDragon).length
  const dragonPair = pair.tiles[0].isDragon
  return dragonKoutsu === 2 && dragonPair
}

function checkHonitsu(allTiles: Tile[]): boolean {
  const hasHonor = allTiles.some((t) => t.isHonor)
  if (!hasHonor) return false
  const numberTiles = allTiles.filter((t) => t.isNumber)
  if (numberTiles.length === 0) return false
  const suits = new Set(numberTiles.map((t) => t.suit))
  return suits.size === 1
}

function checkChinitsu(allTiles: Tile[]): boolean {
  if (allTiles.some((t) => t.isHonor)) return false
  const suits = new Set(allTiles.map((t) => t.suit))
  return suits.size === 1
}

// --- Yakuman helpers ---

function checkSuuankou(keziMelds: Meld[], winTile: Tile, isTsumo: boolean): boolean {
  if (keziMelds.length !== 4) return false
  if (isTsumo) return keziMelds.every((m) => !m.isOpen)
  // Ron: the kezi completed by the win tile counts as open (duipeng wait)
  let closedCount = 0
  for (const m of keziMelds) {
    if (m.isOpen) continue
    if (m.tiles[0].equals(winTile)) continue // This one completed by ron = open
    closedCount++
  }
  return closedCount === 4 // Only possible if win tile was for the pair (tanki)
}

function checkDaisangen(keziMelds: Meld[]): boolean {
  return keziMelds.filter((m) => m.tiles[0].isDragon).length === 3
}

function checkShousuushii(keziMelds: Meld[], pair: Meld): boolean {
  const windKoutsu = keziMelds.filter((m) => m.tiles[0].isWind).length
  const windPair = pair.tiles[0].isWind
  return windKoutsu === 3 && windPair
}

function checkDaisuushii(keziMelds: Meld[]): boolean {
  return keziMelds.filter((m) => m.tiles[0].isWind).length === 4
}

function checkTsuuiisou(allTiles: Tile[]): boolean {
  return allTiles.every((t) => t.isHonor)
}

function checkRyuuiisou(allTiles: Tile[]): boolean {
  return allTiles.every((t) => t.isGreen)
}

function checkChinroutou(allTiles: Tile[]): boolean {
  return allTiles.every((t) => t.isTerminal)
}

function checkChuuren(allTiles: Tile[]): boolean {
  if (allTiles.some((t) => t.isHonor)) return false
  const suits = new Set(allTiles.map((t) => t.suit))
  if (suits.size !== 1) return false
  const counts = new Map<number, number>()
  allTiles.forEach((t) => counts.set(t.rank, (counts.get(t.rank) || 0) + 1))
  // Need at least 3 of rank 1 and 9, at least 1 of 2-8
  if ((counts.get(1) || 0) < 3) return false
  if ((counts.get(9) || 0) < 3) return false
  for (let r = 2; r <= 8; r++) {
    if ((counts.get(r) || 0) < 1) return false
  }
  return true
}

function checkSuugangzi(keziMelds: Meld[]): boolean {
  return keziMelds.filter((m) => m.type === 'gangzi').length === 4
}

// --- Helpers ---

function addRiichiYaku(yaku: YakuResult[], options: GameOptions, isMenqing = true): void {
  if (!isMenqing) return
  const hasRiichi = options.isDoubleRiichi || options.isRiichi
  if (options.isDoubleRiichi) {
    yaku.push({ name: '两立直', han: 2 })
  } else if (options.isRiichi) {
    yaku.push({ name: '立直', han: 1 })
  }
  if (hasRiichi && options.isYifa) yaku.push({ name: '一发', han: 1 })
}

function addHaiteiYaku(yaku: YakuResult[], options: GameOptions): void {
  if (options.isTsumo && options.isLingshang) {
    yaku.push({ name: '岭上开花', han: 1 })
  } else if (options.isTsumo && options.isHaidi) {
    yaku.push({ name: '海底摸月', han: 1 })
  }
  if (!options.isTsumo && options.isQianggang) {
    yaku.push({ name: '抢杠', han: 1 })
  } else if (!options.isTsumo && options.isHaidi) {
    yaku.push({ name: '河底捞鱼', han: 1 })
  }
}

function addSituationalYakuman(yaku: YakuResult[], options: GameOptions): void {
  if (options.isTianhu) yaku.push({ name: '天和', han: 13, isYakuman: true })
  if (options.isDihu) yaku.push({ name: '地和', han: 13, isYakuman: true })
}

function addDoraYaku(yaku: YakuResult[], options: GameOptions): void {
  if (options.doraCount > 0) yaku.push({ name: '宝牌', han: options.doraCount })
}

function meldsIdentical(a: Meld, b: Meld): boolean {
  if (a.type !== b.type) return false
  if (a.tiles.length !== b.tiles.length) return false
  return a.tiles[0].equals(b.tiles[0])
}

function removeConflicts(yaku: YakuResult[]): void {
  const names = new Set(yaku.map((y) => y.name))
  // Ryanpeiko excludes iipeiko
  if (names.has('二杯口')) {
    const idx = yaku.findIndex((y) => y.name === '一杯口')
    if (idx !== -1) yaku.splice(idx, 1)
  }
  // Junchan excludes chanta
  if (names.has('纯全带幺九')) {
    const idx = yaku.findIndex((y) => y.name === '混全带幺九')
    if (idx !== -1) yaku.splice(idx, 1)
  }
  // Chinitsu excludes honitsu
  if (names.has('清一色')) {
    const idx = yaku.findIndex((y) => y.name === '混一色')
    if (idx !== -1) yaku.splice(idx, 1)
  }
  // Honroutou: check for toitoi presence (they can coexist)
  // Double riichi excludes single riichi (already handled by add logic)
}
