import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { calculateHand, calculateScore } from '../score'
import { tiles, defaultOptions } from './test-helpers'

describe('Score Calculation', () => {
  describe('Score table (calculateScore)', () => {
    it('1han 30fu non-dealer = 1000 ron', () => {
      expect(calculateScore(1, 30, false).ron).toBe(1000)
    })

    it('2han 30fu non-dealer = 2000 ron', () => {
      expect(calculateScore(2, 30, false).ron).toBe(2000)
    })

    it('3han 30fu non-dealer = 3900 ron', () => {
      expect(calculateScore(3, 30, false).ron).toBe(3900)
    })

    it('4han 30fu non-dealer = 8000 ron (kiriage mangan)', () => {
      expect(calculateScore(4, 30, false).ron).toBe(8000)
    })

    it('5han mangan non-dealer = 8000 ron', () => {
      expect(calculateScore(5, 30, false).ron).toBe(8000)
    })

    it('6han haneman non-dealer = 12000 ron', () => {
      expect(calculateScore(6, 30, false).ron).toBe(12000)
    })

    it('8han baiman non-dealer = 16000 ron', () => {
      expect(calculateScore(8, 30, false).ron).toBe(16000)
    })

    it('11han sanbaiman non-dealer = 24000 ron', () => {
      expect(calculateScore(11, 30, false).ron).toBe(24000)
    })

    it('13han yakuman non-dealer = 32000 ron', () => {
      expect(calculateScore(13, 0, false).ron).toBe(32000)
    })

    it('dealer mangan = 12000 ron', () => {
      expect(calculateScore(5, 30, true).ron).toBe(12000)
    })

    it('non-dealer tsumo 2han 20fu', () => {
      const s = calculateScore(2, 20, false)
      expect(s.tsumoDealer).toBe(700)
      expect(s.tsumoNonDealer).toBe(400)
    })

    it('dealer tsumo mangan', () => {
      const s = calculateScore(5, 30, true)
      expect(s.tsumoDealer).toBe(4000)
      expect(s.tsumoNonDealer).toBe(4000)
    })
  })

  describe('End-to-end scoring', () => {
    it('pinfu ron non-dealer = 1000', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ changfeng: 2, zifeng: 3 }))
      expect(result).not.toBeNull()
      expect(result!.han).toBe(1)
      expect(result!.fu).toBe(30)
      expect(result!.score.ron).toBe(1000)
    })

    it('pinfu+tsumo non-dealer = 400/700', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true, changfeng: 2, zifeng: 3 }))
      expect(result).not.toBeNull()
      expect(result!.han).toBe(2)
      expect(result!.fu).toBe(20)
      expect(result!.score.tsumoNonDealer).toBe(400)
      expect(result!.score.tsumoDealer).toBe(700)
    })

    it('yakuman non-dealer ron = 32000', () => {
      const hand = tiles('19m19p19s1234567z')
      const win = Tile.fromString('1m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.score.ron).toBe(32000)
    })

    it('yakuman dealer ron = 48000', () => {
      const hand = tiles('19m19p19s1234567z')
      const win = Tile.fromString('1m')
      const result = calculateHand(hand, [], win, defaultOptions({ zifeng: 1 }))
      expect(result).not.toBeNull()
      expect(result!.score.ron).toBe(48000)
    })
  })

  describe('Regression', () => {
    it('pinfu with dora is still valid', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ changfeng: 2, zifeng: 3, doraCount: 3 }))
      expect(result).not.toBeNull()
      expect(result!.yakuList.some((y) => y.name !== '宝牌')).toBe(true)
    })

    it('26+ han non-yakuman = kazoe yakuman (single)', () => {
      const s = calculateScore(26, 30, false, 0)
      expect(s.ron).toBe(32000)
    })

    it('double yakuman only when yakumanCount=2', () => {
      const s = calculateScore(26, 0, false, 2)
      expect(s.ron).toBe(64000)
    })
  })
})
