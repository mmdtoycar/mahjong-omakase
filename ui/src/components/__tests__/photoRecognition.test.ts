import { describe, it, expect } from 'vitest'
import {
  parseTileString,
  parseTileStringSequence,
  parseTileList,
  safeParseJSON,
  isUsableImageDataUrl,
  parseImageDataUrl,
  winHandToLabel,
} from '../PhotoRecognitionModal'
import { Tile } from '../../logic/shared/tiles'
import { toGuobiaoMelds, toRiichiMelds } from '../../logic/shared/importedHand'

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

describe('meld kind inference', () => {
  const meld = (type: string, tiles: string) => ({ type, tiles: parseTileStringSequence(tiles), isOpen: true })

  // Regression: labels the model actually emits that contain none of the old substrings.
  it('derives a triplet from identical tiles regardless of label', () => {
    for (const label of ['ankou', 'koutsu', 'minko', 'toitsu', 'unknown', '']) {
      expect(toGuobiaoMelds([meld(label, '555z')])[0].type).toBe('ke')
      expect(toRiichiMelds([meld(label, '555z')])[0].type).toBe('kezi')
    }
  })

  it('derives a gang from four tiles regardless of label', () => {
    expect(toGuobiaoMelds([meld('mystery', '8888s')])[0].type).toBe('gang')
    expect(toRiichiMelds([meld('mystery', '8888s')])[0].type).toBe('gangzi')
  })

  it('keeps a genuine sequence as a sequence', () => {
    expect(toGuobiaoMelds([meld('shun', '123m')])[0].type).toBe('shun')
    expect(toRiichiMelds([meld('chi', '123m')])[0].type).toBe('shunzi')
  })

  it('falls back to the label when the tiles are ambiguous', () => {
    // Three non-identical, non-consecutive tiles: only the label can say what was meant.
    expect(toGuobiaoMelds([meld('pon', '159m')])[0].type).toBe('ke')
    expect(toGuobiaoMelds([meld('kan', '159m')])[0].type).toBe('gang')
  })
})

describe('isUsableImageDataUrl', () => {
  it('accepts a normal data URL', () => {
    expect(isUsableImageDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true)
    expect(isUsableImageDataUrl('data:image/heic;base64,AAAA')).toBe(true)
  })

  // The real iPhone path: past the canvas limit iOS returns "data:," without throwing, so
  // split(',')[1] is undefined, gets sent as the image, and the server rejects it with a 400.
  it('rejects the empty data URL iOS returns past the canvas limit', () => {
    expect(isUsableImageDataUrl('data:,')).toBe(false)
    expect(isUsableImageDataUrl('data:image/jpeg;base64,')).toBe(false)
  })

  it('rejects empty values and non-images', () => {
    expect(isUsableImageDataUrl(null)).toBe(false)
    expect(isUsableImageDataUrl(undefined)).toBe(false)
    expect(isUsableImageDataUrl('')).toBe(false)
    expect(isUsableImageDataUrl('data:text/plain;base64,QQ==')).toBe(false)
  })
})

describe('parseImageDataUrl', () => {
  it('returns the MIME type and payload separately', () => {
    expect(parseImageDataUrl('data:image/png;base64,iVBORw0K')).toEqual({
      mimeType: 'image/png',
      base64: 'iVBORw0K',
    })
  })

  // The server's @Pattern only accepts lowercase, so an uppercase data URL from a browser must be
  // normalized here rather than rejected with a silent 400.
  it('accepts uppercase subtypes and lowercases the MIME type it reports', () => {
    expect(parseImageDataUrl('data:image/HEIC;base64,AAAA')?.mimeType).toBe('image/heic')
    expect(parseImageDataUrl('DATA:IMAGE/JPEG;BASE64,/9j/4AAQ')?.mimeType).toBe('image/jpeg')
  })

  // Only the five types the server allows; anything else would be sent and then 400'd.
  it('rejects image types the server does not accept', () => {
    expect(parseImageDataUrl('data:image/gif;base64,R0lGOD')).toBeNull()
    expect(parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull()
    expect(parseImageDataUrl('data:image/bmp;base64,Qk0=')).toBeNull()
  })

  it('rejects malformed and payload-less URLs', () => {
    expect(parseImageDataUrl('data:,')).toBeNull()
    expect(parseImageDataUrl('data:image/jpeg;base64,')).toBeNull()
    expect(parseImageDataUrl('data:image/jpeg,notbase64')).toBeNull()
    expect(parseImageDataUrl('https://example.com/a.jpg')).toBeNull()
    expect(parseImageDataUrl(null)).toBeNull()
  })
})

describe('winHandToLabel', () => {
  it('parses a concealed-only hand', () => {
    expect(winHandToLabel('1m2m3m^4m')).toEqual({
      concealed: ['1m', '2m', '3m', '4m'],
      melds: [],
      winningTile: '4m',
    })
  })

  it('includes the winning tile as the last concealed tile too, matching a recogniser’s own answer', () => {
    const label = winHandToLabel('1m2m3m^4m')
    expect(label.concealed.at(-1)).toBe(label.winningTile)
  })

  it('parses an open meld', () => {
    expect(winHandToLabel('1m2m3m^4m[5p5p5p]')).toEqual({
      concealed: ['1m', '2m', '3m', '4m'],
      melds: [{ isOpen: true, tiles: ['5p', '5p', '5p'] }],
      winningTile: '4m',
    })
  })

  it('parses a closed meld (an 暗杠)', () => {
    expect(winHandToLabel('1m2m3m^4m(6s6s6s6s)')).toEqual({
      concealed: ['1m', '2m', '3m', '4m'],
      melds: [{ isOpen: false, tiles: ['6s', '6s', '6s', '6s'] }],
      winningTile: '4m',
    })
  })

  it('parses multiple melds of mixed openness', () => {
    const label = winHandToLabel('1m2m3m^4m[5p5p5p](6s6s6s6s)')
    expect(label.melds).toEqual([
      { isOpen: true, tiles: ['5p', '5p', '5p'] },
      { isOpen: false, tiles: ['6s', '6s', '6s', '6s'] },
    ])
  })

  it('returns an empty label for an empty string, rather than throwing', () => {
    expect(winHandToLabel('')).toEqual({ concealed: [], melds: [], winningTile: null })
  })
})
