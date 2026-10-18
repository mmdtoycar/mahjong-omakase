import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { analyzeHandStructure } from '../blockAnalyzer'

function parseTiles(str: string): Tile[] {
  const tiles: Tile[] = []
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

describe('blockAnalyzer', () => {
  it('correctly detects over-blocks hand (六块超额)', () => {
    // 12m(penchan) 45m(ryanmen) 23p(ryanmen) 78p(ryanmen) 24s(kanchan) 77s(pair) 1z(isolated) -> 6 functional blocks
    const hand = parseTiles('12m45m23p78p24s77s1z')
    const analysis = analyzeHandStructure(hand)
    expect(analysis.totalBlockCount).toBe(6)
    expect(analysis.status).toBe('over-blocks')
    expect(analysis.blocks.length).toBeGreaterThan(0)
  })

  it('correctly identifies ryankan (两坎复合形)', () => {
    const hand = parseTiles('246m23p45s77s123p1z')
    const analysis = analyzeHandStructure(hand)
    const ryankan = analysis.blocks.find((b) => b.label.includes('两坎'))
    expect(ryankan).toBeDefined()
  })

  it('correctly identifies nakabukure (中膨形)', () => {
    const hand = parseTiles('4556m23p45s77s123p1z')
    const analysis = analyzeHandStructure(hand)
    const nakabukure = analysis.blocks.find((b) => b.label.includes('中膨'))
    expect(nakabukure).toBeDefined()
  })

  it('correctly parses 112233m as two complete shunzi without breaking into nakabukure', () => {
    // 112233m 456p 789s 11z -> 5 complete blocks (2 shunzi in m, 1 in p, 1 in s, 1 jantou in z)
    const hand = parseTiles('112233m456p789s11z')
    const analysis = analyzeHandStructure(hand)
    expect(analysis.totalBlockCount).toBe(5)
    expect(analysis.status).toBe('five-blocks')

    const shunziInMan = analysis.blocks.filter((b) => b.type === 'mentsu-shunzi' && b.tiles[0].suit === 'm')
    expect(shunziInMan.length).toBe(2)
  })
})
