import { Tile } from '../shared/tiles'
import { Meld, HandCombination, GameOptions, FuDetail } from './types'

export function calculateFu(
  combination: HandCombination,
  winTile: Tile,
  options: GameOptions
): { fu: number; details: FuDetail[] } {
  if (combination.isKokushi) return { fu: 25, details: [{ reason: '国士无双', fu: 25 }] }
  if (combination.isChiitoitsu) return { fu: 25, details: [{ reason: '七对子', fu: 25 }] }

  const details: FuDetail[] = []
  const melds = combination.melds
  const groups = melds.filter((m) => m.type !== 'jantai')
  const pair = melds.find((m) => m.type === 'jantai')!
  const isMenzen = groups.every((m) => !m.isOpen)
  const isPinfu =
    isMenzen &&
    groups.every((m) => m.type === 'shuntsu') &&
    !isPairYakuhai(pair, options) &&
    determineWaitType(combination, winTile) === 'ryanmen'

  // Pinfu tsumo: fixed 20符 (self-draw 2符 is waived)
  if (isPinfu && options.isTsumo) return { fu: 20, details: [{ reason: '平和自摸', fu: 20 }] }

  // Base fu
  let baseFu = 20
  details.push({ reason: '底符', fu: 20 })

  // Menzen ron bonus
  if (isMenzen && !options.isTsumo) {
    baseFu += 10
    details.push({ reason: '门前荣和', fu: 10 })
  }

  // Tsumo bonus (not pinfu)
  if (options.isTsumo) {
    baseFu += 2
    details.push({ reason: '自摸', fu: 2 })
  }

  // Meld fu
  for (const m of groups) {
    const isRonTarget = !options.isTsumo && m.tiles[0].equals(winTile)
    const fu = getMeldFu(m, isRonTarget)
    if (fu > 0) {
      baseFu += fu
      details.push({ reason: describeMeld(m, isRonTarget), fu })
    }
  }

  // Pair fu
  const pairFu = getPairFu(pair, options)
  if (pairFu > 0) {
    baseFu += pairFu
    details.push({ reason: `雀头:${tileToChineseName(pair.tiles[0])}`, fu: pairFu })
  }

  // Wait fu
  const waitType = determineWaitType(combination, winTile)
  if (waitType === 'kanchan' || waitType === 'penchan' || waitType === 'tanki') {
    baseFu += 2
    details.push({ reason: `听牌:${waitTypeName(waitType)}`, fu: 2 })
  }

  const fu = Math.ceil(baseFu / 10) * 10
  return { fu: Math.max(fu, 30), details }
}

function getMeldFu(meld: Meld, isRonTarget: boolean): number {
  const t = meld.tiles[0]
  const isYaochuu = t.isTerminalOrHonor

  if (meld.type === 'shuntsu') return 0

  if (meld.type === 'kantsu') {
    if (meld.isOpen) return isYaochuu ? 16 : 8
    return isYaochuu ? 32 : 16
  }

  // Koutsu: ron completing this koutsu counts as 明刻
  const isEffectivelyOpen = meld.isOpen || isRonTarget
  const base = isYaochuu ? 4 : 2
  return isEffectivelyOpen ? base : base * 2
}

function getPairFu(pair: Meld, options: GameOptions): number {
  const t = pair.tiles[0]
  let fu = 0
  if (t.isDragon) fu += 2
  if (t.isWind && t.rank === options.bakaze) fu += 2
  if (t.isWind && t.rank === options.jikaze) fu += 2
  return fu
}

function isPairYakuhai(pair: Meld, options: GameOptions): boolean {
  const t = pair.tiles[0]
  if (t.isDragon) return true
  if (t.isWind && t.rank === options.bakaze) return true
  if (t.isWind && t.rank === options.jikaze) return true
  return false
}

export function determineWaitType(combination: HandCombination, winTile: Tile): string {
  const melds = combination.melds
  const pair = melds.find((m) => m.type === 'jantai')!
  const groups = melds.filter((m) => m.type !== 'jantai')

  // Tanki (pair wait)
  if (pair.tiles[0].equals(winTile)) {
    return 'tanki'
  }

  // Check koutsu (shanpon)
  for (const m of groups) {
    if ((m.type === 'koutsu' || m.type === 'kantsu') && !m.isOpen && m.tiles[0].equals(winTile)) {
      return 'shanpon'
    }
  }

  // Check shuntsu waits
  for (const m of groups) {
    if (m.type !== 'shuntsu' || m.isOpen) continue
    const tiles = m.tiles
    if (!tiles.some((t) => t.equals(winTile))) continue

    const startRank = tiles[0].rank
    if (winTile.rank === startRank) {
      if (startRank === 7) return 'penchan'
      return 'ryanmen'
    }
    if (winTile.rank === startRank + 1) return 'kanchan'
    if (winTile.rank === startRank + 2) {
      if (startRank === 1) return 'penchan'
      return 'ryanmen'
    }
  }

  return 'ryanmen'
}

function waitTypeName(wt: string): string {
  switch (wt) {
    case 'kanchan':
      return '嵌张'
    case 'penchan':
      return '边张'
    case 'tanki':
      return '单骑'
    default:
      return '两面'
  }
}

function describeMeld(m: Meld, isRonTarget: boolean): string {
  const isEffectivelyOpen = m.isOpen || isRonTarget
  const prefix = isEffectivelyOpen ? '明' : '暗'
  const tileName = tileToChineseName(m.tiles[0])
  if (m.type === 'kantsu') return `${prefix}杠:${tileName}`
  return `${prefix}刻:${tileName}`
}

function tileToChineseName(t: Tile): string {
  const numNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (t.suit === 'm') return `${numNames[t.rank - 1]}万`
  if (t.suit === 'p') return `${numNames[t.rank - 1]}饼`
  if (t.suit === 's') return `${numNames[t.rank - 1]}条`
  const honorNames = ['东', '南', '西', '北', '中', '发', '白']
  return honorNames[t.rank - 1]
}
