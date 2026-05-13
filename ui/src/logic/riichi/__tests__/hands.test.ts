import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { calculateHand, calculateScore } from '../score'
import { Meld, GameOptions } from '../types'
import tenhouHands from './testdata/tenhou_hands.json'

function parseTileStr(s: string): Tile[] {
  const tiles: Tile[] = []
  let nums: number[] = []
  for (const ch of s) {
    if ('0123456789'.includes(ch)) {
      nums.push(parseInt(ch))
    } else {
      const suit = ch === 'h' ? 'z' : ch
      for (const n of nums) {
        tiles.push(new Tile(suit as any, n === 0 ? 5 : n))
      }
      nums = []
    }
  }
  return tiles
}

function parseMeld(meldStr: string): Meld | null {
  const isClosed = meldStr.includes('f')

  const cleaned = meldStr.replace(/[cf]/g, '')
  const tiles = parseTileStr(cleaned)

  if (tiles.length < 3) return null

  if (tiles.length === 4) {
    return { type: 'gangzi', tiles, isOpen: !isClosed }
  }

  const allSame = tiles.every((t) => t.suit === tiles[0].suit && t.rank === tiles[0].rank)
  if (allSame) {
    return { type: 'kezi', tiles, isOpen: !isClosed }
  }

  return { type: 'shunzi', tiles: tiles.sort((a, b) => a.compareTo(b)), isOpen: true }
}

function parseWindToNumber(wind: string): number {
  switch (wind) {
    case 'EAST':
      return 1
    case 'SOUTH':
      return 2
    case 'WEST':
      return 3
    case 'NORTH':
      return 4
    default:
      return 1
  }
}

function seatWindToNumber(seatWind: string): number {
  const tile = parseTileStr(seatWind)
  if (tile.length > 0 && tile[0].suit === 'z') return tile[0].rank
  return 1
}

function countDora(hand: Tile[], melds: Meld[], doraIndicators: string[]): number {
  const doraTiles = doraIndicators
    .map((d) => {
      const t = parseTileStr(d)[0]
      if (!t) return null
      if (t.suit === 'z') {
        if (t.rank <= 4) return new Tile('z', (t.rank % 4) + 1)
        return new Tile('z', t.rank === 7 ? 5 : t.rank + 1)
      }
      return new Tile(t.suit, (t.rank % 9) + 1)
    })
    .filter(Boolean) as Tile[]

  const allTiles = [...hand, ...melds.flatMap((m) => m.tiles)]
  let count = 0
  for (const dora of doraTiles) {
    count += allTiles.filter((t) => t.equals(dora)).length
  }
  return count
}

describe('Tenhou reference hands (1000 cases)', () => {
  const hands = tenhouHands

  describe(`Scoring validation (${hands.length} hands)`, () => {
    for (const [idx, h] of hands.entries()) {
      it(`hand ${idx}: ${h.hand} win ${h.winningTile} = ${h.fu}fu ${h.han}han ${h.pointValue}pts`, () => {
        const handTiles = parseTileStr(h.hand)
        const melds: Meld[] = h.melds.map(parseMeld).filter(Boolean) as Meld[]
        const winTile = parseTileStr(h.winningTile)[0]

        const concealedWithoutWin: Tile[] = [...handTiles]
        const winIdx = concealedWithoutWin.findIndex((t) => t.equals(winTile))
        if (winIdx !== -1) concealedWithoutWin.splice(winIdx, 1)
        const doraCount = countDora([...handTiles, winTile], melds, h.doraIndicators)

        const options: GameOptions = {
          isTsumo: h.isTsumo,
          changfeng: parseWindToNumber(h.roundWind),
          zifeng: seatWindToNumber(h.seatWind),
          isRiichi: h.isRiichi,
          isDoubleRiichi: false,
          isYifa: false,
          isQianggang: false,
          isLingshang: false,
          isHaidi: false,
          isTianhu: false,
          isDihu: false,
          doraCount: 0,
        }

        const result = calculateHand(concealedWithoutWin, melds, winTile, options)
        expect(result).not.toBeNull()
        expect(result!.fu).toBe(parseInt(h.fu))

        // Validate score using expected han/fu
        const score = calculateScore(h.han, parseInt(h.fu), h.isDealer)
        if (h.isTsumo) {
          const expectedTotal = h.isDealer ? score.tsumoNonDealer * 3 : score.tsumoDealer + score.tsumoNonDealer * 2
          expect(expectedTotal).toBe(parseInt(h.pointValue))
        } else {
          expect(score.ron).toBe(parseInt(h.pointValue))
        }
      })
    }
  })
})
