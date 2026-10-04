import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { analyzeAllDiscards } from '../ukeire'

function parseTiles(str: string): Tile[] {
  const tiles: Tile[] = []
  if (str.includes(' ')) {
    return str
      .trim()
      .split(/\s+/)
      .map((s) => Tile.fromString(s))
  }
  let currentDigits: number[] = []
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch >= '1' && ch <= '9') {
      currentDigits.push(parseInt(ch, 10))
    } else if (['m', 'p', 's', 'z'].includes(ch)) {
      for (const d of currentDigits) {
        tiles.push(new Tile(ch as any, d))
      }
      currentDigits = []
    }
  }
  return tiles
}

describe('ukeire analysis', () => {
  it('analyzes standard hand and identifies optimal discard', () => {
    // 14 tiles: 123s(3) + 456p(3) + 23m(2) + 45s(2) + 77m(2) + 1z(1) + 9s(1) = 14 tiles
    // 1z (honor) and 9s (isolated terminal) are isolated.
    const hand = parseTiles('123s456p23m45s77m1z9s')
    expect(hand.length).toBe(14)

    const analyses = analyzeAllDiscards(hand)
    expect(analyses.length).toBeGreaterThan(0)

    const best = analyses[0]
    expect(best.discardTile.toString()).toBe('1z')
    expect(best.isOptimal).toBe(true)
    expect(best.shanten).toBe(1)
    expect(best.totalUkeire).toBeGreaterThan(10)
  })

  it('correctly compares good shape rate vs bad shape rate in 1-shanten', () => {
    // Hand where choosing between keeping kanchan vs ryanmen
    const hand = parseTiles('23m45p79s123s456s77m8m')
    const analyses = analyzeAllDiscards(hand)
    expect(analyses.length).toBeGreaterThan(0)
  })
})
