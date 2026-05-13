import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { calculateHand } from '../score'
import { Meld, GameOptions } from '../types'
import { tiles, defaultOptions } from './test-helpers'

describe('Yaku Detection', () => {
  describe('Pinfu', () => {
    it('pinfu tsumo = 20fu 2han', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true, changfeng: 2, zifeng: 3 }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(20)
      expect(result!.yakuList.map((y) => y.name)).toContain('平和')
      expect(result!.yakuList.map((y) => y.name)).toContain('门前清自摸和')
      expect(result!.han).toBe(2)
    })

    it('pinfu ron = 30fu 1han', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ changfeng: 2, zifeng: 3 }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
      expect(result!.yakuList.map((y) => y.name)).toContain('平和')
      expect(result!.han).toBe(1)
    })
  })

  describe('Tanyao', () => {
    it('tanyao with pinfu', () => {
      const hand = tiles('234m567p345s67s22m')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('断幺九')
    })
  })

  describe('Yakuhai', () => {
    it('haku kezi', () => {
      const hand = tiles('123m456p789s777z5s')
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('役牌:白')
    })

    it('changfeng (round wind) kezi', () => {
      const hand = tiles('123m456p789s111z5s')
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions({ changfeng: 1 }))
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('役牌:场风牌')
    })
  })

  describe('Iipeiko', () => {
    it('one pair of identical sequences', () => {
      const hand = tiles('112233m456p789s4z')
      const win = Tile.fromString('4z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('一杯口')
    })
  })

  describe('Chiitoitsu', () => {
    it('seven pairs = 25fu 2han', () => {
      const hand = tiles('1133m2277p4488s6z')
      const win = Tile.fromString('6z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(25)
      expect(result!.yakuList.map((y) => y.name)).toContain('七对子')
    })
  })

  describe('Toitoi', () => {
    it('all triplets with open melds', () => {
      const hand = tiles('222m5s')
      const openMelds: Meld[] = [
        { type: 'kezi', tiles: tiles('999m'), isOpen: true },
        { type: 'kezi', tiles: tiles('333p'), isOpen: true },
        { type: 'kezi', tiles: tiles('666s'), isOpen: true },
      ]
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, openMelds, win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('对对和')
    })
  })

  describe('Honitsu', () => {
    it('one suit + honors', () => {
      const hand = tiles('123456789m111z2z')
      const win = Tile.fromString('2z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('混一色')
    })
  })

  describe('Chinitsu', () => {
    it('all one suit = 6han menzen', () => {
      const hand = tiles('1223334456799m')
      const win = Tile.fromString('8m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('清一色')
      const chinitsuYaku = result!.yakuList.find((y) => y.name === '清一色')
      expect(chinitsuYaku!.han).toBe(6)
    })
  })

  describe('Sanshoku Doujun', () => {
    it('same sequence in all 3 suits', () => {
      const hand = tiles('123m123p123s456m9s')
      const win = Tile.fromString('9s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('三色同顺')
    })
  })

  describe('Ittsu', () => {
    it('straight in one suit', () => {
      const hand = tiles('123456789m234p5s')
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('一气通贯')
    })
  })

  describe('Yakuman', () => {
    it('kokushi musou', () => {
      const hand = tiles('19m19p19s1234567z')
      const win = Tile.fromString('1m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('国士无双')
    })

    it('suuankou tsumo', () => {
      const hand = tiles('111m333m555p999s2z')
      const win = Tile.fromString('2z')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('四暗刻')
    })

    it('daisangen', () => {
      const hand = tiles('123m555666777z1p')
      const win = Tile.fromString('1p')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('大三元')
    })

    it('tsuuiisou', () => {
      const hand = tiles('1112223334445z')
      const win = Tile.fromString('5z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('字一色')
    })

    it('chuuren poutou', () => {
      const hand = tiles('1112345678999m')
      const win = Tile.fromString('5m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('九莲宝灯')
    })
  })
})
