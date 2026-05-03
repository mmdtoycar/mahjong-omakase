import { test, expect, describe } from 'vitest'
import { Tile } from './tiles'
import { calculateBestScore } from './fan'
import { GameOptions, CalcResult, Meld } from './types'

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
       ranks.forEach(r => concealed.push(new Tile(suit, r)))
    } else if (token.length === 4) {
       const tiles = ranks.map(r => new Tile(suit, r))
       melds.push({ 
         type: ranks[0] === ranks[1] ? 'ke' : 'shun', 
         tiles, 
         isOpen: true 
       })
    } else {
       ranks.forEach(r => concealed.push(new Tile(suit, r)))
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
    const r = calc('s123 s789 s789 s55 m123')
    const fanNames = r!.fans.map(f => f.name)
    expect(fanNames).toContain('老少副')
    expect(fanNames).toContain('一般高')
  })

  test('Lao-Shao-Fu x2 with 123s, 123s, 789s, 789s', () => {
    const r = calc('s123 s123 s789 s789 m55')
    const ls = r!.fans.find(f => f.name === '老少副')
    expect(ls).toBeDefined()
    expect(ls!.count).toBe(2)
  })

  test('Lao-Shao-Fu with Pure Straight (Additivity)', () => {
    // Pure Straight (16) + Extra Lao-Shao-Fu (1)
    // s123 s456 s789 (Straight) + s789 (extra) + s11 (pair)
    const r = calc('s123 s456 s789 s789 s11')
    const fanNames = r!.fans.map(f => f.name)
    expect(fanNames).toContain('清龙')
    expect(fanNames).toContain('老少副')
  })

  test('He-Jue-Zhang fan calculation', () => {
    const r = calc('s123 s456 s789 m123 m55', { juezhang: true })
    expect(r!.fans.map(f => f.name)).toContain('和绝张')
    expect(r!.fans.find(f => f.name === '和绝张')!.score).toBe(4)
  })

  test('East wind in East round and East seat with West pung', () => {
    // East Pung (z111), West Pung (z333), 2 shuns, 1 pair
    const r = calc('z111 z333 s123 s456 s77', { quanfeng: 1, menfeng: 1 })
    const fanNames = r!.fans.map(f => f.name)
    expect(fanNames).toContain('圈风刻')
    expect(fanNames).toContain('门风刻')
    expect(fanNames).toContain('幺九刻')
    
    const yjk = r!.fans.find(f => f.name === '幺九刻')
    expect(yjk).toBeDefined()
    expect(yjk!.count).toBe(1)
  })
})
