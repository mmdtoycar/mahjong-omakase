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

function detectChiitoitsuYaku(combination: HandCombination, allTiles: Tile[], options: GameOptions): YakuResult[] {
  const yaku: YakuResult[] = [{ name: '七对子', han: 2 }]
  const isMenzen = true

  if (options.isTsumo) yaku.push({ name: '门前清自摸和', han: 1 })
  addRiichiYaku(yaku, options)
  if (checkTanyao(allTiles)) yaku.push({ name: '断幺九', han: 1 })
  if (checkHonroutou(allTiles)) yaku.push({ name: '混老头', han: 2 })
  if (checkHonitsu(allTiles)) yaku.push({ name: '混一色', han: isMenzen ? 3 : 2 })
  if (checkChinitsu(allTiles)) yaku.push({ name: '清一色', han: isMenzen ? 6 : 5 })

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
  const pair = melds.find((m) => m.type === 'jantai')!
  const groups = melds.filter((m) => m.type !== 'jantai')
  const isMenzen = groups.every((m) => !m.isOpen)
  const shuntsuMelds = groups.filter((m) => m.type === 'shuntsu')
  const koutsuMelds = groups.filter((m) => m.type === 'koutsu' || m.type === 'kantsu')

  // 1-han yaku
  if (isMenzen && options.isTsumo) yaku.push({ name: '门前清自摸和', han: 1 })
  addRiichiYaku(yaku, options, isMenzen)

  if (isMenzen && checkPinfu(combination, winTile, options)) {
    yaku.push({ name: '平和', han: 1 })
  }

  if (checkTanyao(allTiles)) yaku.push({ name: '断幺九', han: 1 })

  if (isMenzen && checkIipeiko(shuntsuMelds) && !checkRyanpeiko(shuntsuMelds)) {
    yaku.push({ name: '一杯口', han: 1 })
  }

  // Yakuhai
  const yakuhaiList = checkYakuhai(koutsuMelds, options)
  for (const y of yakuhaiList) yaku.push(y)

  // 2-han yaku
  if (checkSanshokuDoujun(shuntsuMelds)) {
    yaku.push({ name: '三色同顺', han: isMenzen ? 2 : 1 })
  }
  if (checkIttsu(shuntsuMelds)) {
    yaku.push({ name: '一气通贯', han: isMenzen ? 2 : 1 })
  }
  if (checkChanta(melds)) {
    yaku.push({ name: '混全带幺九', han: isMenzen ? 2 : 1 })
  }
  if (checkToitoi(groups)) yaku.push({ name: '对对和', han: 2 })
  const waitType = determineWaitType(combination, winTile)
  if (checkSanankou(koutsuMelds, winTile, options.isTsumo, waitType)) {
    yaku.push({ name: '三暗刻', han: 2 })
  }
  if (checkSanshokuDoukou(koutsuMelds)) yaku.push({ name: '三色同刻', han: 2 })
  if (checkHonroutou(allTiles)) yaku.push({ name: '混老头', han: 2 })
  if (checkSankantsu(koutsuMelds)) yaku.push({ name: '三杠子', han: 2 })
  if (checkShousangen(koutsuMelds, pair)) yaku.push({ name: '小三元', han: 2 })

  // 3-han yaku
  if (isMenzen && checkRyanpeiko(shuntsuMelds)) yaku.push({ name: '二杯口', han: 3 })
  if (checkHonitsu(allTiles)) yaku.push({ name: '混一色', han: isMenzen ? 3 : 2 })
  if (checkJunchan(melds)) yaku.push({ name: '纯全带幺九', han: isMenzen ? 3 : 2 })

  // 6-han yaku
  if (checkChinitsu(allTiles)) yaku.push({ name: '清一色', han: isMenzen ? 6 : 5 })

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
  const pair = melds.find((m) => m.type === 'jantai')!
  const groups = melds.filter((m) => m.type !== 'jantai')
  const koutsuMelds = groups.filter((m) => m.type === 'koutsu' || m.type === 'kantsu')
  const isMenzen = groups.every((m) => !m.isOpen)

  if (isMenzen && checkSuuankou(koutsuMelds, winTile, options.isTsumo, groups)) {
    yaku.push({ name: '四暗刻', han: 13, isYakuman: true })
  }
  if (checkDaisangen(koutsuMelds)) yaku.push({ name: '大三元', han: 13, isYakuman: true })
  if (checkShousuushii(koutsuMelds, pair)) yaku.push({ name: '小四喜', han: 13, isYakuman: true })
  if (checkDaisuushii(koutsuMelds)) yaku.push({ name: '大四喜', han: 13, isYakuman: true })
  if (checkTsuuiisou(allTiles)) yaku.push({ name: '字一色', han: 13, isYakuman: true })
  if (checkRyuuiisou(allTiles)) yaku.push({ name: '绿一色', han: 13, isYakuman: true })
  if (checkChinroutou(allTiles)) yaku.push({ name: '清老头', han: 13, isYakuman: true })
  if (isMenzen && checkChuuren(allTiles)) yaku.push({ name: '九莲宝灯', han: 13, isYakuman: true })
  if (checkSuukantsu(koutsuMelds)) yaku.push({ name: '四杠子', han: 13, isYakuman: true })

  addSituationalYakuman(yaku, options)

  return yaku
}

// --- Yaku check helpers ---

function checkPinfu(combination: HandCombination, winTile: Tile, options: GameOptions): boolean {
  const melds = combination.melds
  const groups = melds.filter((m) => m.type !== 'jantai')
  const pair = melds.find((m) => m.type === 'jantai')!

  // All groups must be shuntsu
  if (!groups.every((m) => m.type === 'shuntsu')) return false

  // Pair must not be yakuhai
  const pairTile = pair.tiles[0]
  if (pairTile.isDragon) return false
  if (pairTile.isWind && pairTile.rank === options.bakaze) return false
  if (pairTile.isWind && pairTile.rank === options.jikaze) return false

  // Must be ryanmen (two-sided) wait
  const waitType = determineWaitType(combination, winTile)
  return waitType === 'ryanmen'
}

function checkTanyao(allTiles: Tile[]): boolean {
  return allTiles.every((t) => t.isNumber && t.rank >= 2 && t.rank <= 8)
}

function checkIipeiko(shuntsuMelds: Meld[]): boolean {
  for (let i = 0; i < shuntsuMelds.length; i++) {
    for (let j = i + 1; j < shuntsuMelds.length; j++) {
      if (meldsIdentical(shuntsuMelds[i], shuntsuMelds[j])) return true
    }
  }
  return false
}

function checkRyanpeiko(shuntsuMelds: Meld[]): boolean {
  if (shuntsuMelds.length < 4) return false
  let pairs = 0
  const used = new Set<number>()
  for (let i = 0; i < shuntsuMelds.length; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < shuntsuMelds.length; j++) {
      if (used.has(j)) continue
      if (meldsIdentical(shuntsuMelds[i], shuntsuMelds[j])) {
        pairs++
        used.add(i)
        used.add(j)
        break
      }
    }
  }
  return pairs >= 2
}

function checkYakuhai(koutsuMelds: Meld[], options: GameOptions): YakuResult[] {
  const results: YakuResult[] = []
  for (const m of koutsuMelds) {
    const t = m.tiles[0]
    if (t.isDragon) {
      const names: Record<number, string> = { 5: '役牌:中', 6: '役牌:发', 7: '役牌:白' }
      results.push({ name: names[t.rank], han: 1 })
    }
    if (t.isWind && t.rank === options.bakaze) {
      results.push({ name: '役牌:场风牌', han: 1 })
    }
    if (t.isWind && t.rank === options.jikaze) {
      results.push({ name: '役牌:自风牌', han: 1 })
    }
  }
  return results
}

function checkSanshokuDoujun(shuntsuMelds: Meld[]): boolean {
  for (const m of shuntsuMelds) {
    const rank = m.tiles[0].rank
    const suits = new Set(shuntsuMelds.filter((s) => s.tiles[0].rank === rank).map((s) => s.tiles[0].suit))
    if (suits.size >= 3 && suits.has('m') && suits.has('p') && suits.has('s')) return true
  }
  return false
}

function checkIttsu(shuntsuMelds: Meld[]): boolean {
  for (const suit of ['m', 'p', 's'] as const) {
    const suitMelds = shuntsuMelds.filter((m) => m.tiles[0].suit === suit)
    const starts = new Set(suitMelds.map((m) => m.tiles[0].rank))
    if (starts.has(1) && starts.has(4) && starts.has(7)) return true
  }
  return false
}

function checkChanta(melds: Meld[]): boolean {
  // All groups (including pair) must contain a terminal or honor
  // At least one group must be a shuntsu (otherwise it's honroutou or toitoi)
  const hasShuntsu = melds.some((m) => m.type === 'shuntsu')
  if (!hasShuntsu) return false
  const hasHonor = melds.some((m) => m.tiles.some((t) => t.isHonor))
  if (!hasHonor) return false
  return melds.every((m) => m.tiles.some((t) => t.isTerminalOrHonor))
}

function checkJunchan(melds: Meld[]): boolean {
  const hasShuntsu = melds.some((m) => m.type === 'shuntsu')
  if (!hasShuntsu) return false
  // No honors allowed
  if (melds.some((m) => m.tiles.some((t) => t.isHonor))) return false
  return melds.every((m) => m.tiles.some((t) => t.isTerminal))
}

function checkToitoi(groups: Meld[]): boolean {
  return groups.every((m) => m.type === 'koutsu' || m.type === 'kantsu')
}

function checkSanankou(koutsuMelds: Meld[], winTile: Tile, isTsumo: boolean, waitType: string): boolean {
  let closedKoutsu = 0
  let ronTargetCounted = false
  for (const m of koutsuMelds) {
    if (m.isOpen) continue
    if (!isTsumo && waitType === 'shanpon' && !ronTargetCounted && m.tiles[0].equals(winTile)) {
      ronTargetCounted = true
      continue
    }
    closedKoutsu++
  }
  return closedKoutsu === 3
}

function checkSanshokuDoukou(koutsuMelds: Meld[]): boolean {
  for (const m of koutsuMelds) {
    const t = m.tiles[0]
    if (!t.isNumber) continue
    const suits = new Set(
      koutsuMelds.filter((k) => k.tiles[0].isNumber && k.tiles[0].rank === t.rank).map((k) => k.tiles[0].suit)
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

function checkSankantsu(koutsuMelds: Meld[]): boolean {
  return koutsuMelds.filter((m) => m.type === 'kantsu').length === 3
}

function checkShousangen(koutsuMelds: Meld[], pair: Meld): boolean {
  const dragonKoutsu = koutsuMelds.filter((m) => m.tiles[0].isDragon).length
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

function checkSuuankou(koutsuMelds: Meld[], winTile: Tile, isTsumo: boolean, groups: Meld[]): boolean {
  if (koutsuMelds.length !== 4) return false
  if (isTsumo) return koutsuMelds.every((m) => !m.isOpen)
  // Ron: the koutsu completed by the win tile counts as open (shanpon wait)
  let closedCount = 0
  for (const m of koutsuMelds) {
    if (m.isOpen) continue
    if (m.tiles[0].equals(winTile)) continue // This one completed by ron = open
    closedCount++
  }
  return closedCount === 4 // Only possible if win tile was for the pair (tanki)
}

function checkDaisangen(koutsuMelds: Meld[]): boolean {
  return koutsuMelds.filter((m) => m.tiles[0].isDragon).length === 3
}

function checkShousuushii(koutsuMelds: Meld[], pair: Meld): boolean {
  const windKoutsu = koutsuMelds.filter((m) => m.tiles[0].isWind).length
  const windPair = pair.tiles[0].isWind
  return windKoutsu === 3 && windPair
}

function checkDaisuushii(koutsuMelds: Meld[]): boolean {
  return koutsuMelds.filter((m) => m.tiles[0].isWind).length === 4
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

function checkSuukantsu(koutsuMelds: Meld[]): boolean {
  return koutsuMelds.filter((m) => m.type === 'kantsu').length === 4
}

// --- Helpers ---

function addRiichiYaku(yaku: YakuResult[], options: GameOptions, isMenzen = true): void {
  if (!isMenzen) return
  const hasRiichi = options.isDoubleRiichi || options.isRiichi
  if (options.isDoubleRiichi) {
    yaku.push({ name: '两立直', han: 2 })
  } else if (options.isRiichi) {
    yaku.push({ name: '立直', han: 1 })
  }
  if (hasRiichi && options.isIppatsu) yaku.push({ name: '一发', han: 1 })
}

function addHaiteiYaku(yaku: YakuResult[], options: GameOptions): void {
  if (options.isTsumo && options.isRinshan) {
    yaku.push({ name: '岭上开花', han: 1 })
  } else if (options.isTsumo && options.isHaitei) {
    yaku.push({ name: '海底摸月', han: 1 })
  }
  if (!options.isTsumo && options.isChankan) {
    yaku.push({ name: '抢杠', han: 1 })
  } else if (!options.isTsumo && options.isHaitei) {
    yaku.push({ name: '河底捞鱼', han: 1 })
  }
}

function addSituationalYakuman(yaku: YakuResult[], options: GameOptions): void {
  if (options.isTenhou) yaku.push({ name: '天和', han: 13, isYakuman: true })
  if (options.isChiihou) yaku.push({ name: '地和', han: 13, isYakuman: true })
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
