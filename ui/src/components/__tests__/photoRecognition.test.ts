import { describe, it, expect } from 'vitest'
import {
  parseTileString,
  parseTileStringSequence,
  parseTileList,
  safeParseJSON,
  checkRecognizedHand,
  RecognizedHand,
} from '../PhotoRecognitionModal'
import { Tile } from '../../logic/shared/tiles'

const str = (tiles: Tile[]) => tiles.map((t) => `${t.rank}${t.suit}`).join(' ')

describe('parseTileString', () => {
  it('parses ASCII notation', () => {
    expect(str([parseTileString('5m')!])).toBe('5m')
    expect(str([parseTileString(' 7Z ')!])).toBe('7z')
  })

  it('parses Chinese names, including variants', () => {
    expect(str([parseTileString('三万')!])).toBe('3m')
    expect(str([parseTileString('5筒')!])).toBe('5p')
    expect(str([parseTileString('9索')!])).toBe('9s')
    expect(str([parseTileString('红中')!])).toBe('5z')
    expect(str([parseTileString('發')!])).toBe('6z')
    expect(str([parseTileString('白板')!])).toBe('7z')
  })

  it('rejects out-of-range and junk', () => {
    expect(parseTileString('8z')).toBeNull()
    expect(parseTileString('0m')).toBeNull()
    expect(parseTileString('')).toBeNull()
    expect(parseTileString('banana')).toBeNull()
  })
})

describe('parseTileStringSequence', () => {
  it('expands grouped ASCII notation', () => {
    expect(str(parseTileStringSequence('123m 55p 77z'))).toBe('1m 2m 3m 5p 5p 7z 7z')
  })

  it('expands hyphen ranges', () => {
    expect(str(parseTileStringSequence('1-9m'))).toBe('1m 2m 3m 4m 5m 6m 7m 8m 9m')
    expect(str(parseTileStringSequence('1-3饼'))).toBe('1p 2p 3p')
  })

  it('drops ranks that do not exist for the suit', () => {
    expect(str(parseTileStringSequence('89z'))).toBe('')
  })

  // Regression: the ASCII branch used to `return` early, silently discarding
  // any Chinese tiles that followed.
  it('keeps Chinese tiles that follow ASCII notation in the same string', () => {
    expect(str(parseTileStringSequence('123m 东南'))).toBe('1m 2m 3m 1z 2z')
    expect(str(parseTileStringSequence('11p 中中'))).toBe('1p 1p 5z 5z')
  })

  it('parses a pure Chinese list', () => {
    expect(str(parseTileStringSequence('1万, 2饼、东 白'))).toBe('1m 2p 1z 7z')
  })
})

describe('parseTileList', () => {
  it('accepts an array of tile strings', () => {
    expect(str(parseTileList(['1m', '9s', '中']))).toBe('1m 9s 5z')
  })

  it('accepts {suit, rank} objects and rejects invalid ones', () => {
    expect(
      str(
        parseTileList([
          { suit: 'p', rank: 4 },
          { suit: 'z', rank: 9 },
          { suit: 'x', rank: 1 },
        ])
      )
    ).toBe('4p')
  })

  it('accepts a bare string', () => {
    expect(str(parseTileList('123m'))).toBe('1m 2m 3m')
  })

  it('returns empty for null/undefined', () => {
    expect(parseTileList(null)).toEqual([])
    expect(parseTileList(undefined)).toEqual([])
  })
})

describe('safeParseJSON', () => {
  it('parses clean JSON', () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences', () => {
    expect(safeParseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  // Regression: balancing brackets onto a dangling comma still yields invalid JSON.
  it('repairs truncation after a trailing comma', () => {
    expect(safeParseJSON('{"concealed":["1m","2m",')).toEqual({ concealed: ['1m', '2m'] })
  })

  it('drops a partial token rather than inventing a tile', () => {
    expect(safeParseJSON('{"concealed":["1m","2')).toEqual({ concealed: ['1m'] })
  })

  it('repairs truncation after a dangling key', () => {
    expect(safeParseJSON('{"notes":"ok","concealed":')).toEqual({ notes: 'ok' })
  })

  it('rethrows when unrepairable', () => {
    expect(() => safeParseJSON('not json at all')).toThrow()
  })
})

describe('checkRecognizedHand', () => {
  const hand = (concealed: string, melds: RecognizedHand['melds'] = []): RecognizedHand => ({
    concealed: parseTileStringSequence(concealed),
    melds,
    winningTile: null,
    isSelfDraw: false,
  })

  it('accepts a 13-tile hand', () => {
    const r = checkRecognizedHand(hand('1234567899m 111p'))
    expect(r.blocking).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('accepts a 14-tile hand', () => {
    const r = checkRecognizedHand(hand('1234567899m 1112p'))
    expect(r.blocking).toEqual([])
  })

  // A gang shows 4 tiles but fills 3 slots, so 11 + gang(4) is a legal 14.
  it('counts a gang as three slots', () => {
    const gang = { type: 'gang', tiles: parseTileStringSequence('8888s'), isOpen: false }
    const r = checkRecognizedHand(hand('12345678999m', [gang]))
    expect(r.blocking).toEqual([])
  })

  it('blocks a hand with more than 14 slots', () => {
    const r = checkRecognizedHand(hand('123456789m 123456789p'))
    expect(r.blocking.some((m) => m.includes('超过一手牌上限'))).toBe(true)
  })

  // The model has been seen echoing the whole 34-tile legend back as the hand.
  it('blocks the full 34-tile legend', () => {
    const r = checkRecognizedHand(hand('123456789m 123456789p 123456789s 1234567z'))
    expect(r.blocking.length).toBeGreaterThan(0)
  })

  it('blocks a fifth copy of a tile', () => {
    const r = checkRecognizedHand(hand('11111m 22334455p'))
    expect(r.blocking.some((m) => m.includes('1m'))).toBe(true)
  })

  it('counts meld tiles toward the four-copy limit', () => {
    const ke = { type: 'ke', tiles: parseTileStringSequence('555z'), isOpen: true }
    const r = checkRecognizedHand(hand('123456789m 55z', [ke]))
    expect(r.blocking.some((m) => m.includes('5z'))).toBe(true)
  })

  it('warns but does not block an incomplete hand', () => {
    const r = checkRecognizedHand(hand('123m'))
    expect(r.blocking).toEqual([])
    expect(r.warnings.some((m) => m.includes('可能有遗漏'))).toBe(true)
  })
})
