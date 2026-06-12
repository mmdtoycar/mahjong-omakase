import { test, expect, describe } from 'vitest'
import { Tile } from '../tiles'
import { calculateBestScore } from '../fan'
import { GameOptions, CalcResult, Meld } from '../types'

function parseHand(
  handStr: string,
  opts: Partial<GameOptions> = {}
): { concealed: Tile[]; melds: Meld[]; options: GameOptions } {
  const concealed: Tile[] = []
  const melds: Meld[] = []

  const tokens = handStr.split(' ')
  for (const token of tokens) {
    const suitChar = token[0]
    const suit = (suitChar === 'w' ? 'm' : suitChar === 't' ? 's' : suitChar) as any
    const ranks = token.slice(1).split('').map(Number)

    if (token.length > 4) {
      ranks.forEach((r) => concealed.push(new Tile(suit, r)))
    } else if (token.length === 4) {
      const tiles = ranks.map((r) => new Tile(suit, r))
      melds.push({
        type: ranks[0] === ranks[1] ? 'ke' : 'shun',
        tiles,
        isOpen: true,
      })
    } else {
      ranks.forEach((r) => concealed.push(new Tile(suit, r)))
    }
  }

  const options: GameOptions = {
    isSelfDraw: false,
    lastTile: false,
    gangShang: false,
    juezhang: false,
    quanfeng: 1,
    menfeng: 1,
    huaCount: 0,
    showTingFans: false,
    ...opts,
  }

  return { concealed, melds, options }
}

function calc(handStr: string, opts: Partial<GameOptions> = {}): CalcResult | null {
  const { concealed, melds, options } = parseHand(handStr, opts)
  const lastTile = concealed.length > 0 ? concealed[concealed.length - 1] : undefined
  return calculateBestScore(concealed, melds, options, lastTile)
}

describe('Guobiao Bug Fixes', () => {
  test('Lao-Shao-Fu with multiple sets and Identical Chows', () => {
    // 123s, 789s, 789s + pair + another meld
    // 应该计算 1番老少副 + 1番一般高
    const r = calc('s123 s789 s789 s55 m123')
    const fanNames = r!.fans.map((f) => f.name)
    expect(fanNames).toContain('老少副')
    expect(fanNames).toContain('一般高')
  })

  test('Lao-Shao-Fu x2 with 123s, 123s, 789s, 789s', () => {
    // 123s, 123s, 789s, 789s + pair
    // 应该计算 2番老少副
    const r = calc('s123 s123 s789 s789 m55')
    const ls = r!.fans.find((f) => f.name === '老少副')
    expect(ls).toBeDefined()
    expect(ls!.count).toBe(2)
  })

  test('He-Jue-Zhang fan calculation', () => {
    const r = calc('s123 s456 s789 m123 m55', { juezhang: true })
    expect(r!.fans.map((f) => f.name)).toContain('和绝张')
    expect(r!.fans.find((f) => f.name === '和绝张')!.score).toBe(4)
  })

  test('East wind in East round and East seat with West pung', () => {
    // 东风刻 (z111), 西风刻 (z333), 2个顺子, 1个将牌
    // 此时应该计 圈风刻(2) + 门风刻(2) + 幺九刻(1，西风) = 5番
    const r = calc('z111 z333 s123 s456 s77', { quanfeng: 1, menfeng: 1 })
    const fanNames = r!.fans.map((f) => f.name)
    expect(fanNames).toContain('圈风刻')
    expect(fanNames).toContain('门风刻')
    expect(fanNames).toContain('幺九刻')

    const yjk = r!.fans.find((f) => f.name === '幺九刻')
    expect(yjk).toBeDefined()
    expect(yjk!.count).toBe(1)
  })

  test('User Hand: 123789789s 345m 33p - 点炮胡 (6番)', () => {
    // 123条, 789条, 789条, 345万, 将3饼, 听3万 (双面听点炮)
    const concealed = [
      new Tile('s', 1),
      new Tile('s', 2),
      new Tile('s', 3),
      new Tile('s', 7),
      new Tile('s', 8),
      new Tile('s', 9),
      new Tile('s', 7),
      new Tile('s', 8),
      new Tile('s', 9),
      new Tile('m', 3),
      new Tile('m', 4),
      new Tile('m', 5),
      new Tile('p', 3),
      new Tile('p', 3),
    ]
    const melds: Meld[] = []
    const options: GameOptions = {
      isSelfDraw: false,
      lastTile: false,
      gangShang: false,
      juezhang: false,
      quanfeng: 1,
      menfeng: 1,
      huaCount: 0,
      showTingFans: false,
    }
    const lastTile = new Tile('m', 3) // 听 3万 点炮胡
    const r = calculateBestScore(concealed, melds, options, lastTile)
    expect(r).not.toBeNull()
    expect(r!.totalScore).toBe(6)
    const fanNames = r!.fans.map((f) => f.name)
    expect(fanNames).toContain('平和')
    expect(fanNames).toContain('一般高')
    expect(fanNames).toContain('老少副')
    expect(fanNames).toContain('门前清')
    expect(fanNames).not.toContain('无字') // 平和包含无字，不重复计分
  })

  test('User Hand: 123789789s 345m 33p - 自摸胡 (8番)', () => {
    // 123条, 789条, 789条, 345万, 将3饼, 自摸 3万 (双面听自摸)
    const concealed = [
      new Tile('s', 1),
      new Tile('s', 2),
      new Tile('s', 3),
      new Tile('s', 7),
      new Tile('s', 8),
      new Tile('s', 9),
      new Tile('s', 7),
      new Tile('s', 8),
      new Tile('s', 9),
      new Tile('m', 3),
      new Tile('m', 4),
      new Tile('m', 5),
      new Tile('p', 3),
      new Tile('p', 3),
    ]
    const melds: Meld[] = []
    const options: GameOptions = {
      isSelfDraw: true,
      lastTile: false,
      gangShang: false,
      juezhang: false,
      quanfeng: 1,
      menfeng: 1,
      huaCount: 0,
      showTingFans: false,
    }
    const lastTile = new Tile('m', 3) // 听 3万 自摸胡
    const r = calculateBestScore(concealed, melds, options, lastTile)
    expect(r).not.toBeNull()
    expect(r!.totalScore).toBe(8)
    const fanNames = r!.fans.map((f) => f.name)
    expect(fanNames).toContain('平和')
    expect(fanNames).toContain('一般高')
    expect(fanNames).toContain('老少副')
    expect(fanNames).toContain('不求人')
    expect(fanNames).not.toContain('门前清')
    expect(fanNames).not.toContain('自摸') // 不求人包含自摸
  })

  test('User Hand: 双老少副 + 双喜相逢 (11番)', () => {
    // 123条, 789条, 123饼, 789饼, 将3万, 自摸听3万 (单钓将)
    // 包含：平和(2) + 双老少副(2) + 双喜相逢(2) + 不求人(4) + 单钓将(1) = 11番
    const concealed = [
      new Tile('s', 1),
      new Tile('s', 2),
      new Tile('s', 3),
      new Tile('s', 7),
      new Tile('s', 8),
      new Tile('s', 9),
      new Tile('p', 1),
      new Tile('p', 2),
      new Tile('p', 3),
      new Tile('p', 7),
      new Tile('p', 8),
      new Tile('p', 9),
      new Tile('m', 3),
      new Tile('m', 3),
    ]
    const melds: Meld[] = []
    const options: GameOptions = {
      isSelfDraw: true,
      lastTile: false,
      gangShang: false,
      juezhang: false,
      quanfeng: 1,
      menfeng: 1,
      huaCount: 0,
      showTingFans: false,
    }
    const lastTile = new Tile('m', 3) // 听 3万 自摸温 (单钓将)
    const r = calculateBestScore(concealed, melds, options, lastTile)
    expect(r).not.toBeNull()
    expect(r!.totalScore).toBe(11)
    const fanNames = r!.fans.map((f) => f.name)

    // 平和 (2)
    expect(fanNames).toContain('平和')

    // 双老少副 (2番)
    const lsf = r!.fans.find((f) => f.name === '老少副')
    expect(lsf).toBeDefined()
    expect(lsf!.count).toBe(2)

    // 双喜相逢 (2番)
    const xxf = r!.fans.find((f) => f.name === '喜相逢')
    expect(xxf).toBeDefined()
    expect(xxf!.count).toBe(2)

    // 不求人 (4)
    expect(fanNames).toContain('不求人')

    // 单钓将 (1)
    expect(fanNames).toContain('单钓将')
  })
})
