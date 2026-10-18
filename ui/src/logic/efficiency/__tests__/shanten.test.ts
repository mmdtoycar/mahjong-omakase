import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import {
  calculateShanten,
  calculateStandardShantenFromCounts,
  calculateChiitoitsuShantenFromCounts,
  calculateKokushiShantenFromCounts,
  tilesToCounts,
} from '../shanten'

function parseTiles(str: string): Tile[] {
  // Parses "123m456p789s111z22z" or space-separated "1m 2m 3m..."
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

describe('shanten calculation', () => {
  it('correctly identifies standard agari (和牌, -1 shanten)', () => {
    const tiles = parseTiles('123m456p789s111z22z')
    expect(tiles.length).toBe(14)
    expect(calculateShanten(tiles)).toBe(-1)
  })

  it('correctly identifies standard tenpai (听牌, 0 shanten)', () => {
    const tiles = parseTiles('123m456p789s111z2z')
    expect(tiles.length).toBe(13)
    expect(calculateShanten(tiles)).toBe(0)
  })

  it('correctly identifies standard 1-shanten (一向听, 1 shanten)', () => {
    // 123m 456p 78s 111z 24s -> melds: 123m, 456p, 111z. taatsu: 78s, 24s. headless: pair candidate from taatsu
    const tiles = parseTiles('123m456p78s24s111z')
    expect(tiles.length).toBe(13)
    expect(calculateShanten(tiles)).toBe(1)
  })

  it('correctly identifies perfect 1-shanten (完全一向听)', () => {
    // 233m (3) + 45p (2) + 77s (2) + 123s (3) + 456s (3) = 13 tiles
    const tiles = parseTiles('233m45p77s123s456s')
    expect(tiles.length).toBe(13)
    expect(calculateShanten(tiles)).toBe(1)
  })

  it('correctly identifies Chiitoitsu tenpai and agari', () => {
    const tenpaiTiles = parseTiles('11m22m33p44p55s66s7z')
    expect(tenpaiTiles.length).toBe(13)
    expect(calculateChiitoitsuShantenFromCounts(tilesToCounts(tenpaiTiles))).toBe(0)
    expect(calculateShanten(tenpaiTiles)).toBe(0)

    const agariTiles = parseTiles('11m22m33p44p55s66s77z')
    expect(agariTiles.length).toBe(14)
    expect(calculateChiitoitsuShantenFromCounts(tilesToCounts(agariTiles))).toBe(-1)
    expect(calculateShanten(agariTiles)).toBe(-1)
  })

  it('correctly rejects 4 identical tiles as 2 pairs for Chiitoitsu', () => {
    // 1111m (counts as 1 pair for chitoi) + 22m + 33p + 44p + 55s + 6z = 13 tiles
    // Pairs: 1m, 2m, 3p, 4p, 5s (5 pairs). Single: 6z (total 6 distinct kinds).
    // Needs 1 more pair and at least 7 distinct kinds (missing 1 kind) -> 6 - 5 + 1 = 2-shanten.
    const tiles = parseTiles('1111m22m33p44p55s6z')
    expect(tiles.length).toBe(13)
    const counts = tilesToCounts(tiles)
    expect(calculateChiitoitsuShantenFromCounts(counts)).toBe(2)
  })

  it('correctly identifies Kokushi tenpai and agari', () => {
    // 13-sided wait
    const tenpai13 = parseTiles('19m19p19s1234567z')
    expect(calculateKokushiShantenFromCounts(tilesToCounts(tenpai13))).toBe(0)
    expect(calculateShanten(tenpai13)).toBe(0)

    // single wait
    const tenpaiSingle = parseTiles('11m9m19p19s123456z')
    expect(calculateKokushiShantenFromCounts(tilesToCounts(tenpaiSingle))).toBe(0)
    expect(calculateShanten(tenpaiSingle)).toBe(0)

    // agari
    const agariKokushi = parseTiles('11m9m19p19s1234567z')
    expect(calculateKokushiShantenFromCounts(tilesToCounts(agariKokushi))).toBe(-1)
    expect(calculateShanten(agariKokushi)).toBe(-1)
  })
})
