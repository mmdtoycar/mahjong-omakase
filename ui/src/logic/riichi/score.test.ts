import { describe, it, expect } from 'vitest'
import { Tile } from '../guobiao/tiles'
import { calculateHand, calculateScore } from './score'
import { Meld, GameOptions } from './types'

function tiles(s: string): Tile[] {
  const result: Tile[] = []
  let nums: number[] = []
  for (const ch of s) {
    if ('0123456789'.includes(ch)) {
      nums.push(parseInt(ch))
    } else if ('mpsz'.includes(ch)) {
      for (const n of nums) result.push(new Tile(ch as any, n))
      nums = []
    }
  }
  return result
}

function defaultOptions(overrides: Partial<GameOptions> = {}): GameOptions {
  return {
    isTsumo: false,
    bakaze: 1,
    jikaze: 2,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isChankan: false,
    isRinshan: false,
    isHaitei: false,
    isTenhou: false,
    isChiihou: false,
    doraCount: 0,
    uraDoraCount: 0,
    akaDoraCount: 0,
    ...overrides,
  }
}

describe('Riichi Score Calculator', () => {
  describe('Pinfu', () => {
    // 234m 567m 345p 678s pair 11z(east, non-yakuhai when bakaze=2,jikaze=3)
    // Wait: 67s+8s = ryanmen
    it('pinfu tsumo = 20fu 2han', () => {
      const hand = tiles('234m567m345p67s11z') // 13 tiles
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true, bakaze: 2, jikaze: 3 }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(20)
      expect(result!.yakuList.map((y) => y.name)).toContain('平和')
      expect(result!.yakuList.map((y) => y.name)).toContain('门前清自摸和')
      expect(result!.han).toBe(2)
    })

    it('pinfu ron = 30fu 1han', () => {
      const hand = tiles('234m567m345p67s11z') // 13 tiles
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ bakaze: 2, jikaze: 3 }))
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(30)
      expect(result!.yakuList.map((y) => y.name)).toContain('平和')
      expect(result!.han).toBe(1)
    })
  })

  describe('Tanyao', () => {
    // 234m 567p 345s 678s pair 22m — all 2-8
    it('tanyao with pinfu', () => {
      const hand = tiles('234m567p345s67s22m') // 13 tiles
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('断幺九')
    })
  })

  describe('Yakuhai', () => {
    // 123m 456p 789s 777z(haku) pair 55s — tanki wait on 5s
    it('haku koutsu', () => {
      const hand = tiles('123m456p789s777z5s') // 13 tiles
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('役牌:白')
    })

    // 123m 456p 789s 111z(east) pair 55s — east is bakaze
    it('bakaze (round wind) koutsu', () => {
      const hand = tiles('123m456p789s111z5s') // 13 tiles
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions({ bakaze: 1 }))
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('役牌:场风牌')
    })
  })

  describe('Iipeiko', () => {
    // 112233m 456p 789s pair 4z(north, non-yakuhai when bakaze=1, jikaze=2)
    it('one pair of identical sequences', () => {
      const hand = tiles('112233m456p789s4z') // 13 tiles
      const win = Tile.fromString('4z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('一杯口')
    })
  })

  describe('Chiitoitsu', () => {
    it('seven pairs = 25fu 2han', () => {
      const hand = tiles('1133m2277p4488s6z') // 13 tiles
      const win = Tile.fromString('6z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.fu).toBe(25)
      expect(result!.yakuList.map((y) => y.name)).toContain('七对子')
    })
  })

  describe('Toitoi', () => {
    // Concealed: 222m 55s (pair). 3 open koutsu.
    it('all triplets with open melds', () => {
      const hand = tiles('222m5s') // 4 tiles concealed
      const openMelds: Meld[] = [
        { type: 'koutsu', tiles: tiles('999m'), isOpen: true },
        { type: 'koutsu', tiles: tiles('333p'), isOpen: true },
        { type: 'koutsu', tiles: tiles('666s'), isOpen: true },
      ]
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, openMelds, win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('对对和')
    })
  })

  describe('Honitsu', () => {
    // All man + honors: 123m 456m 789m 111z pair 2z2z
    it('one suit + honors', () => {
      const hand = tiles('123456789m111z2z') // 13 tiles
      const win = Tile.fromString('2z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('混一色')
    })
  })

  describe('Chinitsu', () => {
    // pair(99m) + 123m + 234m + 345m + 678m — all man, ryanmen wait on 8m
    it('all one suit = 6han menzen', () => {
      const hand = tiles('1223334456799m') // 13 tiles
      const win = Tile.fromString('8m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('清一色')
      const chinitsuYaku = result!.yakuList.find((y) => y.name === '清一色')
      expect(chinitsuYaku!.han).toBe(6)
    })
  })

  describe('Sanshoku Doujun', () => {
    // 123m 123p 123s 456m pair 99s
    it('same sequence in all 3 suits', () => {
      const hand = tiles('123m123p123s456m9s') // 13 tiles
      const win = Tile.fromString('9s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('三色同顺')
    })
  })

  describe('Ittsu', () => {
    // 123m 456m 789m 234p pair 55s
    it('straight in one suit', () => {
      const hand = tiles('123456789m234p5s') // 13 tiles
      const win = Tile.fromString('5s')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.yakuList.map((y) => y.name)).toContain('一气通贯')
    })
  })

  describe('Yakuman', () => {
    it('kokushi musou (thirteen orphans)', () => {
      const hand = tiles('19m19p19s1234567z') // 13 tiles
      const win = Tile.fromString('1m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('国士无双')
    })

    it('suuankou (4 concealed triplets) tsumo', () => {
      // 111m 333m 555p 999s pair 2z — tanki wait on 2z
      const hand = tiles('111m333m555p999s2z') // 13 tiles
      const win = Tile.fromString('2z')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true }))
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('四暗刻')
    })

    it('daisangen (big three dragons)', () => {
      // 555z 666z 777z 123m pair 11p
      const hand = tiles('123m11p555666777z') // 13 tiles — wait, that's 3+2+3+3+3=14!
      // Let me fix: 123m 555z 666z 777z pair 1p — tanki
      const hand2 = tiles('123m555666777z1p') // 13 tiles: 3+3+3+3+1=13
      const win = Tile.fromString('1p')
      const result = calculateHand(hand2, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('大三元')
    })

    it('tsuuiisou (all honors)', () => {
      // 111z 222z 333z 444z pair 55z
      const hand = tiles('1112223334445z') // 13 tiles
      const win = Tile.fromString('5z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('字一色')
    })

    it('chuuren poutou (nine gates)', () => {
      const hand = tiles('1112345678999m') // 13 tiles
      const win = Tile.fromString('5m')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result).not.toBeNull()
      expect(result!.isYakuman).toBe(true)
      expect(result!.yakuList.map((y) => y.name)).toContain('九莲宝灯')
    })
  })

  describe('Score table', () => {
    it('1han 30fu non-dealer = 1000 ron', () => {
      const s = calculateScore(1, 30, false)
      expect(s.ron).toBe(1000)
    })

    it('2han 30fu non-dealer = 2000 ron', () => {
      const s = calculateScore(2, 30, false)
      expect(s.ron).toBe(2000)
    })

    it('3han 30fu non-dealer = 3900 ron', () => {
      const s = calculateScore(3, 30, false)
      expect(s.ron).toBe(3900)
    })

    it('4han 30fu non-dealer = 7700 ron', () => {
      const s = calculateScore(4, 30, false)
      expect(s.ron).toBe(7700)
    })

    it('5han = mangan non-dealer = 8000 ron', () => {
      const s = calculateScore(5, 30, false)
      expect(s.ron).toBe(8000)
    })

    it('6han = haneman non-dealer = 12000 ron', () => {
      const s = calculateScore(6, 30, false)
      expect(s.ron).toBe(12000)
    })

    it('8han = baiman non-dealer = 16000 ron', () => {
      const s = calculateScore(8, 30, false)
      expect(s.ron).toBe(16000)
    })

    it('11han = sanbaiman non-dealer = 24000 ron', () => {
      const s = calculateScore(11, 30, false)
      expect(s.ron).toBe(24000)
    })

    it('13han = yakuman non-dealer = 32000 ron', () => {
      const s = calculateScore(13, 0, false)
      expect(s.ron).toBe(32000)
    })

    it('dealer mangan = 12000 ron', () => {
      const s = calculateScore(5, 30, true)
      expect(s.ron).toBe(12000)
    })

    it('non-dealer tsumo 2han 20fu', () => {
      const s = calculateScore(2, 20, false)
      expect(s.tsumoDealer).toBe(700)
      expect(s.tsumoNonDealer).toBe(400)
    })

    it('dealer tsumo mangan', () => {
      const s = calculateScore(5, 30, true)
      expect(s.tsumoDealer).toBe(4000) // everyone pays same for dealer tsumo
      expect(s.tsumoNonDealer).toBe(4000)
    })
  })

  describe('End-to-end scoring', () => {
    it('pinfu ron non-dealer = 1000', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ bakaze: 2, jikaze: 3 }))
      expect(result).not.toBeNull()
      expect(result!.han).toBe(1)
      expect(result!.fu).toBe(30)
      expect(result!.score.ron).toBe(1000)
    })

    it('pinfu+tsumo non-dealer = 400/700', () => {
      const hand = tiles('234m567m345p67s11z')
      const win = Tile.fromString('8s')
      const result = calculateHand(hand, [], win, defaultOptions({ isTsumo: true, bakaze: 2, jikaze: 3 }))
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
      const result = calculateHand(hand, [], win, defaultOptions({ jikaze: 1 }))
      expect(result).not.toBeNull()
      expect(result!.score.ron).toBe(48000)
    })
  })

  describe('Fu calculation', () => {
    it('chiitoitsu always 25fu', () => {
      const hand = tiles('1133m2277p4488s6z')
      const win = Tile.fromString('6z')
      const result = calculateHand(hand, [], win, defaultOptions())
      expect(result!.fu).toBe(25)
    })

    it('closed koutsu of terminals = 8fu contribution', () => {
      // 111m(closed koutsu terminal) + 234m + 234p + 567s + pair 55s — tanki on 5s
      const hand = tiles('111m234m234p567s5s') // 13 tiles
      const win = Tile.fromString('5s')
      // With riichi for yaku
      const result = calculateHand(hand, [], win, defaultOptions({ isRiichi: true }))
      expect(result).not.toBeNull()
      // 20 base + 10 menzen ron + 8 (closed koutsu 1m terminal) + 2 tanki = 40
      expect(result!.fu).toBe(40)
    })
  })
})
