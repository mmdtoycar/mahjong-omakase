import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { calculateHand } from '../score'
import { Meld } from '../types'
import { tiles, defaultOptions } from './test-helpers'

describe('Fu Calculation', () => {
  it('chiitoitsu always 25fu', () => {
    const hand = tiles('1133m2277p4488s6z')
    const win = Tile.fromString('6z')
    const result = calculateHand(hand, [], win, defaultOptions())
    expect(result).not.toBeNull()
    expect(result!.fu).toBe(25)
  })

  it('closed kezi of terminals = 8fu', () => {
    const hand = tiles('111m234m234p567s5s')
    const win = Tile.fromString('5s')
    const result = calculateHand(hand, [], win, defaultOptions({ isRiichi: true }))
    expect(result).not.toBeNull()
    expect(result!.fu).toBe(40)
  })

  describe('Wait type ambiguity', () => {
    it('open hand kanzhang: tsumo 40fu', () => {
      const hand = tiles('1233466888m')
      const openMelds: Meld[] = [{ type: 'kezi', tiles: tiles('333z'), isOpen: true }]
      const win = Tile.fromString('2m')
      const result = calculateHand(hand, openMelds, win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(40)
    })

    it('open hand kanzhang: ron 30fu', () => {
      const hand = tiles('1233466888m')
      const openMelds: Meld[] = [{ type: 'kezi', tiles: tiles('333z'), isOpen: true }]
      const win = Tile.fromString('2m')
      const result = calculateHand(hand, openMelds, win, defaultOptions({ isTsumo: false }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('pinfu via liangmian beats kanzhang', () => {
      const hand = tiles('12334789m456p99s')
      const win = Tile.fromString('2m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('平和')
      expect(result!.han).toBe(1)
      expect(result!.fu).toBe(30)
    })
  })

  describe('Fu rounding', () => {
    it('567m2334456888p tsumo 3p = 30fu', () => {
      const hand = tiles('567m2334456888p')
      const win = Tile.fromString('3p')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('567m2334456888p tsumo 7p = 30fu', () => {
      const hand = tiles('567m2334456888p')
      const win = Tile.fromString('7p')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('23455m45556p456s tsumo 5m = 30fu', () => {
      const hand = tiles('23455m45556p456s')
      const win = Tile.fromString('5m')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('23455m45556p456s tsumo 5p = 30fu', () => {
      const hand = tiles('23455m45556p456s')
      const win = Tile.fromString('5p')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('111234m55p56789s tsumo 4s = 30fu', () => {
      const hand = tiles('111234m55p56789s')
      const win = Tile.fromString('4s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
    })

    it('111234m55p56789s tsumo 7s = 40fu', () => {
      const hand = tiles('111234m55p56789s')
      const win = Tile.fromString('7s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(40)
    })

    it('111234m55p56789s ron 7s = 40fu', () => {
      const hand = tiles('111234m55p56789s')
      const win = Tile.fromString('7s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: false, isRiichi: true }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(40)
    })

    it('35678p11s + ankan5555s + pon666z, ron 4p = 50fu', () => {
      const hand = tiles('35678p11s')
      const openMelds: Meld[] = [
        { type: 'gangzi', tiles: tiles('5555s'), isOpen: false },
        { type: 'kezi', tiles: tiles('666z'), isOpen: true },
      ]
      const win = Tile.fromString('4p')
      const result = calculateHand(hand, openMelds, win, defaultOptions({ isTsumo: false }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(50)
    })
  })
})
