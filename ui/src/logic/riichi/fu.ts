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
  const groups = melds.filter((m) => m.type !== 'duizi')
  const pair = melds.find((m) => m.type === 'duizi')!
  const isMenqing = groups.every((m) => !m.isOpen)
  const waitType = determineWaitType(combination, winTile)
  const isPinfu =
    isMenqing && groups.every((m) => m.type === 'shunzi') && !isPairYakuhai(pair, options) && waitType === 'liangmian'

  // Pinfu tsumo: fixed 20符 (self-draw 2符 is waived)
  if (isPinfu && options.isTsumo) return { fu: 20, details: [{ reason: '平和自摸', fu: 20 }] }

  // Base fu
  let baseFu = 20
  details.push({ reason: '底符', fu: 20 })

  // Menzen ron bonus
  if (isMenqing && !options.isTsumo) {
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
  if (waitType === 'kanzhang' || waitType === 'bianzhang' || waitType === 'danqi') {
    baseFu += 2
    details.push({ reason: `听牌:${waitTypeName(waitType)}`, fu: 2 })
  }

  const fu = Math.ceil(baseFu / 10) * 10
  return { fu: Math.max(fu, 30), details }
}

function getMeldFu(meld: Meld, isRonTarget: boolean): number {
  if (meld.type === 'shunzi') return 0

  const t = meld.tiles[0]
  let n = 1
  if (t.isTerminalOrHonor) n++
  if (!meld.isOpen && !isRonTarget) n++
  if (meld.type === 'gangzi') n += 2

  return Math.pow(2, n)
}

function getPairFu(pair: Meld, options: GameOptions): number {
  const t = pair.tiles[0]
  let fu = 0
  if (t.isDragon) fu += 2
  if (t.isWind && t.rank === options.changfeng) fu += 2
  if (t.isWind && t.rank === options.zifeng) fu += 2
  return fu
}

function isPairYakuhai(pair: Meld, options: GameOptions): boolean {
  const t = pair.tiles[0]
  if (t.isDragon) return true
  if (t.isWind && t.rank === options.changfeng) return true
  if (t.isWind && t.rank === options.zifeng) return true
  return false
}

export function determineWaitType(combination: HandCombination, winTile: Tile): string {
  const melds = combination.melds
  const pair = melds.find((m) => m.type === 'duizi')!
  const groups = melds.filter((m) => m.type !== 'duizi')

  const completed = melds.find((m) => m.completedByWin)

  if (completed) {
    if (completed.type === 'duizi') return 'danqi'
    if (completed.type === 'kezi' || completed.type === 'gangzi') return 'duipeng'
    if (completed.type === 'shunzi') {
      const startRank = completed.tiles[0].rank
      if (winTile.rank === startRank) return startRank === 7 ? 'bianzhang' : 'liangmian'
      if (winTile.rank === startRank + 1) return 'kanzhang'
      return startRank === 1 ? 'bianzhang' : 'liangmian'
    }
  }

  if (pair.tiles[0].equals(winTile)) return 'danqi'

  for (const m of groups) {
    if ((m.type === 'kezi' || m.type === 'gangzi') && !m.isOpen && m.tiles[0].equals(winTile)) {
      return 'duipeng'
    }
  }

  for (const m of groups) {
    if (m.type !== 'shunzi' || m.isOpen) continue
    if (!m.tiles.some((t) => t.equals(winTile))) continue
    const startRank = m.tiles[0].rank
    if (winTile.rank === startRank) return startRank === 7 ? 'bianzhang' : 'liangmian'
    if (winTile.rank === startRank + 1) return 'kanzhang'
    if (winTile.rank === startRank + 2) return startRank === 1 ? 'bianzhang' : 'liangmian'
  }

  return 'liangmian'
}

function waitTypeName(wt: string): string {
  switch (wt) {
    case 'kanzhang':
      return '嵌张'
    case 'bianzhang':
      return '边张'
    case 'danqi':
      return '单骑'
    default:
      return '两面'
  }
}

function describeMeld(m: Meld, isRonTarget: boolean): string {
  const isEffectivelyOpen = m.isOpen || isRonTarget
  const prefix = isEffectivelyOpen ? '明' : '暗'
  const tileName = tileToChineseName(m.tiles[0])
  if (m.type === 'gangzi') return `${prefix}杠:${tileName}`
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
