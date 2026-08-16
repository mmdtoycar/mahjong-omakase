import { describe, it, expect } from 'vitest'
import { Tile } from '../tiles'
import { calculateBestScore } from '../fan'
import { GameOptions, Meld } from '../types'

function defaultOpts(override?: Partial<GameOptions>): GameOptions {
  return {
    isSelfDraw: false,
    lastTile: false,
    gangShang: false,
    juezhang: false,
    quanfeng: 1, // 东
    menfeng: 2, // 南
    huaCount: 0,
    showTingFans: false,
    ...override,
  }
}

function parseTiles(str: string): Tile[] {
  const res: Tile[] = []
  const matches = str.match(/\d+[mpsz]|[1-7]z/g) || []
  for (const m of matches) {
    const suit = m.slice(-1) as 'm' | 'p' | 's' | 'z'
    const digits = m.slice(0, -1)
    for (const d of digits) {
      res.push(new Tile(suit, parseInt(d)))
    }
  }
  return res
}

function makeMeld(type: 'shun' | 'ke' | 'gang' | 'dui', tilesStr: string, isOpen = false): Meld {
  const tiles = parseTiles(tilesStr)
  return {
    type,
    tiles,
    isOpen,
    isGang: type === 'gang',
  }
}

describe('WMO Official Mahjong Competition Rules (Attachment 1) Hand Examples', () => {
  // =========================================================================
  // 88 番
  // =========================================================================

  describe('1. 大四喜 (88分)', () => {
    it('牌例1: 可加计混一色', () => {
      // 东东东 南南南 西西西 北北北 6万6万 (点和)
      const melds: Meld[] = [
        makeMeld('ke', '111z', false),
        makeMeld('ke', '222z', false),
        makeMeld('ke', '333z', false),
        makeMeld('ke', '444z', false),
      ]
      const hand = parseTiles('66m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 6))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大四喜')
      expect(fanNames).toContain('混一色')
      // 不计: 三风刻, 碰碰和, 圈风刻, 门风刻, 幺九刻
      expect(fanNames).not.toContain('三风刻')
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('圈风刻')
      expect(fanNames).not.toContain('门风刻')
      expect(fanNames).not.toContain('幺九刻')
    })

    it('牌例2: 可加计混幺九、混一色', () => {
      // 东东东 南南南 西西西 北北北 1条1条
      const melds: Meld[] = [
        makeMeld('ke', '111z', false),
        makeMeld('ke', '222z', false),
        makeMeld('ke', '333z', false),
        makeMeld('ke', '444z', false),
      ]
      const hand = parseTiles('11s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大四喜')
      expect(fanNames).toContain('混幺九')
      expect(fanNames).toContain('混一色')
    })

    it('牌例3: 可加计字一色', () => {
      // 东东东 南南南 西西西 北北北 白白
      const melds: Meld[] = [
        makeMeld('ke', '111z', false),
        makeMeld('ke', '222z', false),
        makeMeld('ke', '333z', false),
        makeMeld('ke', '444z', false),
      ]
      const hand = parseTiles('77z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大四喜')
      expect(fanNames).toContain('字一色')
    })
  })

  describe('2. 大三元 (88分)', () => {
    it('牌例1: 可加计混一色', () => {
      // 中中中 发发发 白白白 567万 55万
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '666z', false),
        makeMeld('ke', '777z', false),
        makeMeld('shun', '567m', false),
      ]
      const hand = parseTiles('55m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大三元')
      expect(fanNames).toContain('混一色')
      // 不计: 双箭刻, 箭刻
      expect(fanNames).not.toContain('双箭刻')
      expect(fanNames).not.toContain('箭刻')
    })

    it('牌例2: 可加计混幺九、缺一门', () => {
      // 中中中 发发发 白白白 111p 11s
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '666z', false),
        makeMeld('ke', '777z', false),
        makeMeld('ke', '111p', false),
      ]
      const hand = parseTiles('11s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大三元')
      expect(fanNames).toContain('混幺九')
      expect(fanNames).toContain('缺一门')
      expect(fanNames).not.toContain('双箭刻')
      expect(fanNames).not.toContain('箭刻')
    })

    it('牌例3: 可加计字一色', () => {
      // 中中中 发发发 白白白 西西西 北北
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '666z', false),
        makeMeld('ke', '777z', false),
        makeMeld('ke', '333z', false),
      ]
      const hand = parseTiles('44z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 4))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('大三元')
      expect(fanNames).toContain('字一色')
      expect(fanNames).not.toContain('双箭刻')
      expect(fanNames).not.toContain('箭刻')
    })
  })

  describe('3. 绿一色 (88分)', () => {
    it('牌例1: 可加计一色三节高、碰碰和、混一色、箭刻', () => {
      // 222s(碰) 333s(碰) 444s(碰) 发发发 66s
      const melds: Meld[] = [
        makeMeld('ke', '222s', true),
        makeMeld('ke', '333s', true),
        makeMeld('ke', '444s', true),
        makeMeld('ke', '666z', false),
      ]
      const hand = parseTiles('66s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 6))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('绿一色')
      expect(fanNames).toContain('一色三节高')
      expect(fanNames).toContain('碰碰和')
      expect(fanNames).toContain('混一色')
      expect(fanNames).toContain('箭刻')
    })

    it('牌例2: 可加计一色三同顺、清一色、断幺', () => {
      // 234s 234s 234s 666s 88s
      const melds: Meld[] = [
        makeMeld('shun', '234s', false),
        makeMeld('shun', '234s', false),
        makeMeld('shun', '234s', false),
        makeMeld('ke', '666s', false),
      ]
      const hand = parseTiles('88s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 8))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('绿一色')
      expect(fanNames).toContain('一色三同顺')
      expect(fanNames).toContain('清一色')
      expect(fanNames).toContain('断幺')
    })

    it('牌例3: 可加计七对、混一色、不求人 (自摸)', () => {
      // 22s 33s 44s 66s 88s 66z 22s (七对) 自摸
      const hand = parseTiles('22s33s44s66s88s66z22s')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('s', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('绿一色')
      expect(fanNames).toContain('七对')
      expect(fanNames).toContain('混一色')
      expect(fanNames).toContain('不求人')
    })
  })

  describe('4. 九莲宝灯 (88分)', () => {
    it('牌例: 可加计清龙、不求人、四归一 (自摸9万)', () => {
      // 1112345678999m + 9m (自摸 9m)
      const hand = parseTiles('11123456789999m')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('m', 9))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('九莲宝灯')
      expect(fanNames).toContain('清龙')
      expect(fanNames).toContain('不求人')
      expect(fanNames).toContain('四归一')
      // 不计: 清一色、门前清、幺九刻、无字
      expect(fanNames).not.toContain('清一色')
      expect(fanNames).not.toContain('门前清')
      expect(fanNames).not.toContain('幺九刻')
      expect(fanNames).not.toContain('无字')
    })
  })

  describe('5. 四杠 (88分)', () => {
    it('牌例1: 可加计五门齐、箭刻', () => {
      // 2222s(明杠), 5555m(明杠), 9999p(明杠), 中杠(明杠), 东东将
      const melds: Meld[] = [
        makeMeld('gang', '2222s', true),
        makeMeld('gang', '5555m', true),
        makeMeld('gang', '9999p', true),
        makeMeld('gang', '5555z', true),
      ]
      const hand = parseTiles('11z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('四杠')
      expect(fanNames).toContain('五门齐')
      expect(fanNames).toContain('箭刻')
      expect(fanNames).not.toContain('单钓将')
    })

    it('牌例2: 可加计大三元、字一色', () => {
      // 中杠, 发杠, 白杠, 北杠, 南南将
      const melds: Meld[] = [
        makeMeld('gang', '5555z', true),
        makeMeld('gang', '6666z', true),
        makeMeld('gang', '7777z', true),
        makeMeld('gang', '4444z', true),
      ]
      const hand = parseTiles('22z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('四杠')
      expect(fanNames).toContain('大三元')
      expect(fanNames).toContain('字一色')
    })
  })

  describe('6. 连七对 (88分)', () => {
    it('牌例: 可加计断幺', () => {
      // 22p 33p 44p 55p 66p 77p 88p (点和)
      const hand = parseTiles('22334455667788p')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('p', 8))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('连七对')
      expect(fanNames).toContain('断幺')
      // 不计: 清一色、门前清、单钓将、七对、无字
      expect(fanNames).not.toContain('清一色')
      expect(fanNames).not.toContain('门前清')
      expect(fanNames).not.toContain('单钓将')
      expect(fanNames).not.toContain('七对')
      expect(fanNames).not.toContain('无字')
    })
  })

  describe('7. 十三幺 (88分)', () => {
    it('牌例: 13 unique yaos + 1 duplicate', () => {
      // 1s 9s 1p 9p 1m 9m 1z 2z 3z 4z 5z 6z 7z 7z (点和)
      const hand = parseTiles('19s19p19m12345677z')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('十三幺')
      // 不计: 五门齐、门前清、单钓将
      expect(fanNames).not.toContain('五门齐')
      expect(fanNames).not.toContain('门前清')
      expect(fanNames).not.toContain('单钓将')
    })

    it('自摸加计不求人', () => {
      const hand = parseTiles('19s19p19m12345677z')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('十三幺')
      expect(fanNames).toContain('不求人')
    })
  })

  // =========================================================================
  // 64 番
  // =========================================================================

  describe('8. 清幺九 (64分)', () => {
    it('牌例1: 可加计两个双同刻', () => {
      // 111p 111s 999s 999m 11m
      const melds: Meld[] = [
        makeMeld('ke', '111p', false),
        makeMeld('ke', '111s', false),
        makeMeld('ke', '999s', false),
        makeMeld('ke', '999m', false),
      ]
      const hand = parseTiles('11m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('清幺九')
      const stk = res!.fans.find((f) => f.name === '双同刻')
      expect(stk).toBeDefined()
      expect(stk!.count).toBe(2)
      // 不计: 碰碰和、全带幺、幺九刻、无字
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('全带幺')
      expect(fanNames).not.toContain('幺九刻')
      expect(fanNames).not.toContain('无字')
    })

    it('牌例2: 可加计三同刻', () => {
      // 999s 999p 999m 111p 11s
      const melds: Meld[] = [
        makeMeld('ke', '999s', false),
        makeMeld('ke', '999p', false),
        makeMeld('ke', '999m', false),
        makeMeld('ke', '111p', false),
      ]
      const hand = parseTiles('11s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('清幺九')
      expect(fanNames).toContain('三同刻')
    })
  })

  describe('9. 小四喜 (64分)', () => {
    it('牌例1: 可加计混一色、全带幺', () => {
      // (东东东) (南南南) (西西西) (789p) 北北
      const melds: Meld[] = [
        makeMeld('ke', '111z', true),
        makeMeld('ke', '222z', true),
        makeMeld('ke', '333z', true),
        makeMeld('shun', '789p', false),
      ]
      const hand = parseTiles('44z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 4))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('小四喜')
      expect(fanNames).toContain('混一色')
      expect(fanNames).toContain('全带幺')
      expect(fanNames).not.toContain('三风刻')
      expect(fanNames).not.toContain('幺九刻')
    })

    it('牌例2: 可加计字一色、箭刻', () => {
      // 南南南 西西西 北北北 东东 发发发
      const melds: Meld[] = [
        makeMeld('ke', '222z', false),
        makeMeld('ke', '333z', false),
        makeMeld('ke', '444z', false),
        makeMeld('ke', '666z', false),
      ]
      const hand = parseTiles('11z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 1))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('小四喜')
      expect(fanNames).toContain('字一色')
      expect(fanNames).toContain('箭刻')
    })
  })

  describe('10. 小三元 (64分)', () => {
    it('牌例1: 可加计幺九刻、缺一门', () => {
      // 中中中 白白白 发发 234筒 111万
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '777z', false),
        makeMeld('shun', '234p', false),
        makeMeld('ke', '111m', false),
      ]
      const hand = parseTiles('66z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 6))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('小三元')
      const yjk = res!.fans.find((f) => f.name === '幺九刻')
      expect(yjk).toBeDefined()
      expect(yjk!.count).toBe(1) // 111m
      expect(fanNames).toContain('缺一门')
      expect(fanNames).not.toContain('双箭刻')
      expect(fanNames).not.toContain('箭刻')
    })

    it('牌例2: 可加计混幺九、混一色', () => {
      // 白白白 发发发 中中 111s 999s
      const melds: Meld[] = [
        makeMeld('ke', '777z', false),
        makeMeld('ke', '666z', false),
        makeMeld('ke', '111s', false),
        makeMeld('ke', '999s', false),
      ]
      const hand = parseTiles('55z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('小三元')
      expect(fanNames).toContain('混幺九')
      expect(fanNames).toContain('混一色')
      expect(fanNames).not.toContain('双箭刻')
      expect(fanNames).not.toContain('箭刻')
    })
  })

  describe('11. 字一色 (64分)', () => {
    it('牌例1: 可加计三风刻、箭刻', () => {
      // 西西西 南南南 北北北 白白白 发发
      const melds: Meld[] = [
        makeMeld('ke', '333z', false),
        makeMeld('ke', '222z', false),
        makeMeld('ke', '444z', false),
        makeMeld('ke', '777z', false),
      ]
      const hand = parseTiles('66z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 6))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('字一色')
      expect(fanNames).toContain('三风刻')
      expect(fanNames).toContain('箭刻')
      // 不计: 碰碰和、全带幺、幺九刻
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('全带幺')
      expect(fanNames).not.toContain('幺九刻')
    })

    it('牌例2: 可加计小三元', () => {
      // 中中中 发发发 白白 东东东 西西西
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '666z', false),
        makeMeld('ke', '111z', false),
        makeMeld('ke', '333z', false),
      ]
      const hand = parseTiles('77z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('字一色')
      expect(fanNames).toContain('小三元')
    })
  })

  describe('12. 四暗刻 (64分)', () => {
    it('牌例1: 点和 (单钓2条)', () => {
      // 111p 666p 888m 666s + 22s (点和 2s)
      const hand = parseTiles('111p666p888m666s22s')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('s', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('四暗刻')
      expect(fanNames).toContain('幺九刻') // 111p
      expect(fanNames).toContain('单钓将')
      expect(fanNames).toContain('无字')
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('门前清')
    })

    it('牌例2: 自摸 (9万)', () => {
      // 222p 444p 444s 333z 99m (自摸 9m)
      const hand = parseTiles('222p444p444s333z99m')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('m', 9))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('四暗刻')
      expect(fanNames).toContain('不求人')
      expect(fanNames).toContain('幺九刻')
    })
  })

  describe('13. 一色双龙会 (64分)', () => {
    it('牌例: 123p 123p 789p 789p 55p', () => {
      const hand = parseTiles('11223377889955p')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('p', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('一色双龙会')
      // 不计: 七对、清一色、平和、无字、一般高、老少副
      expect(fanNames).not.toContain('七对')
      expect(fanNames).not.toContain('清一色')
      expect(fanNames).not.toContain('平和')
      expect(fanNames).not.toContain('无字')
      expect(fanNames).not.toContain('一般高')
      expect(fanNames).not.toContain('老少副')
    })
  })

  // =========================================================================
  // 48 番
  // =========================================================================

  describe('14. 一色四同顺 (48分)', () => {
    it('牌例: 123s x 4, 99m', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123s', false),
        makeMeld('shun', '123s', false),
        makeMeld('shun', '123s', false),
        makeMeld('shun', '123s', false),
      ]
      const hand = parseTiles('99m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 9))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('一色四同顺')
      expect(fanNames).toContain('全带幺')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('缺一门')
      // 不计: 一色三节高、四归一、一般高
      expect(fanNames).not.toContain('一色三节高')
      expect(fanNames).not.toContain('四归一')
      expect(fanNames).not.toContain('一般高')
    })
  })

  describe('15. 一色四节高 (48分)', () => {
    it('牌例: 666m 777m 888m 999m 55m', () => {
      const melds: Meld[] = [
        makeMeld('ke', '666m', false),
        makeMeld('ke', '777m', false),
        makeMeld('ke', '888m', false),
        makeMeld('ke', '999m', false),
      ]
      const hand = parseTiles('55m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('一色四节高')
      expect(fanNames).toContain('清一色')
      expect(fanNames).toContain('幺九刻') // 999m
      // 不计: 一色三同顺、碰碰和
      expect(fanNames).not.toContain('一色三同顺')
      expect(fanNames).not.toContain('碰碰和')
    })
  })

  // =========================================================================
  // 32 番
  // =========================================================================

  describe('16. 一色四步高 (32分)', () => {
    it('牌例1 (递增1): 234m 345m 456m 567m 22p', () => {
      const melds: Meld[] = [
        makeMeld('shun', '234m', false),
        makeMeld('shun', '345m', false),
        makeMeld('shun', '456m', false),
        makeMeld('shun', '567m', false),
      ]
      const hand = parseTiles('22p')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('p', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('一色四步高')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('断幺')
      expect(fanNames).toContain('缺一门')
      expect(fanNames).not.toContain('连六')
      expect(fanNames).not.toContain('老少副')
    })

    it('牌例2 (递增2): 123p 345p 567p 789p 22s', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', false),
        makeMeld('shun', '345p', false),
        makeMeld('shun', '567p', false),
        makeMeld('shun', '789p', false),
      ]
      const hand = parseTiles('22s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('一色四步高')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('缺一门')
      // 不计: 连六、老少副
      expect(fanNames).not.toContain('连六')
      expect(fanNames).not.toContain('老少副')
    })
  })

  describe('17. 三杠 (32分)', () => {
    it('牌例: 4444m 5555m 4444s 222p 33p', () => {
      const melds: Meld[] = [
        makeMeld('gang', '4444m', true),
        makeMeld('gang', '5555m', true),
        makeMeld('gang', '4444s', true),
        makeMeld('ke', '222p', true),
      ]
      const hand = parseTiles('33p')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('p', 3))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('三杠')
      expect(fanNames).toContain('碰碰和')
      expect(fanNames).toContain('双同刻') // 444m + 444s
      expect(fanNames).toContain('断幺')
    })
  })

  describe('18. 混幺九 (32分)', () => {
    it('牌例: 中中中 111m 111p 999s 南南', () => {
      const melds: Meld[] = [
        makeMeld('ke', '555z', false),
        makeMeld('ke', '111m', false),
        makeMeld('ke', '111p', false),
        makeMeld('ke', '999s', false),
      ]
      const hand = parseTiles('22z')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('z', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('混幺九')
      expect(fanNames).toContain('五门齐')
      expect(fanNames).toContain('双同刻') // 111m + 111p
      expect(fanNames).toContain('箭刻')
      // 不计: 碰碰和、全带幺、幺九刻
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('全带幺')
      expect(fanNames).not.toContain('幺九刻')
    })
  })

  // =========================================================================
  // 24 番
  // =========================================================================

  describe('19. 七对 (24分)', () => {
    it('牌例: 11p 22p 33p 22m 22m 44m 77m 自摸', () => {
      const hand = parseTiles('112233p22224477m')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('m', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('七对')
      expect(fanNames).toContain('不求人')
      expect(fanNames).toContain('四归一')
      expect(fanNames).toContain('缺一门')
      expect(fanNames).toContain('无字')
      // 不计: 门前清、单钓将
      expect(fanNames).not.toContain('门前清')
      expect(fanNames).not.toContain('单钓将')
    })
  })

  describe('20. 七星不靠 (24分)', () => {
    it('牌例: 14p 25s 369m 东南西北中发 + 白 (自摸)', () => {
      const hand = parseTiles('14p25s369m1234567z')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('七星不靠')
      expect(fanNames).toContain('不求人')
      expect(fanNames).not.toContain('五门齐')
      expect(fanNames).not.toContain('门前清')
    })
  })

  describe('21. 全双刻 (24分)', () => {
    it('牌例1: 222s 666s 222p 444p 88m', () => {
      const melds: Meld[] = [
        makeMeld('ke', '222s', false),
        makeMeld('ke', '666s', false),
        makeMeld('ke', '222p', false),
        makeMeld('ke', '444p', false),
      ]
      const hand = parseTiles('88m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 8))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全双刻')
      expect(fanNames).toContain('双同刻') // 222s + 222p
      expect(fanNames).not.toContain('碰碰和')
      expect(fanNames).not.toContain('断幺')
    })
  })

  describe('22. 清一色 (24分)', () => {
    it('牌例2: 123p 456p 789p 456p 22p', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', false),
        makeMeld('shun', '456p', false),
        makeMeld('shun', '789p', false),
        makeMeld('shun', '456p', false),
      ]
      const hand = parseTiles('22p')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('p', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('清一色')
      expect(fanNames).toContain('清龙')
      expect(fanNames).toContain('平和')
      expect(fanNames).not.toContain('无字')
    })
  })

  describe('25. 全大 (24分)', () => {
    it('牌例1: 789m 789p 789s 789s 77m', () => {
      const melds: Meld[] = [
        makeMeld('shun', '789m', false),
        makeMeld('shun', '789p', false),
        makeMeld('shun', '789s', false),
        makeMeld('shun', '789s', false),
      ]
      const hand = parseTiles('77m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全大')
      expect(fanNames).toContain('三色三同顺')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('一般高')
      // 不计: 大于五、无字
      expect(fanNames).not.toContain('大于五')
      expect(fanNames).not.toContain('无字')
    })
  })

  describe('26. 全中 (24分)', () => {
    it('牌例1: 444m 555m 666m 444p 55p', () => {
      const melds: Meld[] = [
        makeMeld('ke', '444m', false),
        makeMeld('ke', '555m', false),
        makeMeld('ke', '666m', false),
        makeMeld('ke', '444p', false),
      ]
      const hand = parseTiles('55p')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('p', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全中')
      expect(fanNames).toContain('一色三节高')
      expect(fanNames).toContain('缺一门')
      expect(fanNames).not.toContain('断幺')
    })
  })

  describe('27. 全小 (24分)', () => {
    it('牌例1: 123s 123m 123p 123p 22m', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123s', false),
        makeMeld('shun', '123m', false),
        makeMeld('shun', '123p', false),
        makeMeld('shun', '123p', false),
      ]
      const hand = parseTiles('22m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全小')
      expect(fanNames).toContain('三色三同顺')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('一般高')
      // 不计: 小于五、无字
      expect(fanNames).not.toContain('小于五')
      expect(fanNames).not.toContain('无字')
    })
  })

  // =========================================================================
  // 16 番
  // =========================================================================

  describe('29. 三色双龙会 (16分)', () => {
    it('牌例1: 123s 789s 123p 789p 55m', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123s', false),
        makeMeld('shun', '789s', false),
        makeMeld('shun', '123p', false),
        makeMeld('shun', '789p', false),
      ]
      const hand = parseTiles('55m')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('m', 5))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('三色双龙会')
      // 不计: 平和、无字、喜相逢、老少副
      expect(fanNames).not.toContain('平和')
      expect(fanNames).not.toContain('无字')
      expect(fanNames).not.toContain('喜相逢')
      expect(fanNames).not.toContain('老少副')
    })
  })

  // =========================================================================
  // 12 番
  // =========================================================================

  describe('34. 全不靠 (12分)', () => {
    it('牌例1: 14s 258m 369p 东南西北发 + 白 (自摸)', () => {
      const hand = parseTiles('14s258m369p123467z')
      const res = calculateBestScore(hand, [], defaultOpts({ isSelfDraw: true }), new Tile('z', 7))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全不靠')
      expect(fanNames).toContain('不求人')
    })

    it('牌例2: 中发东南西北 147m 258s 369p (点和 9p)', () => {
      const hand = parseTiles('56134z147m258s369p')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('p', 9))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('全不靠')
      expect(fanNames).toContain('组合龙')
    })
  })

  describe('35. 组合龙 (12分)', () => {
    it('牌例1: 147p 258m 369s 中中中 西 (点和 西)', () => {
      const hand = parseTiles('147p258m369s555z33z')
      const res = calculateBestScore(hand, [], defaultOpts(), new Tile('z', 3))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('组合龙')
      expect(fanNames).toContain('五门齐')
      expect(fanNames).toContain('门前清')
      expect(fanNames).toContain('箭刻')
      expect(fanNames).toContain('单钓将')
    })
  })

  // =========================================================================
  // 8 番
  // =========================================================================

  describe('40. 推不倒 (8分)', () => {
    it('牌例1: 123p 345p 456s 456s 88s', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', false),
        makeMeld('shun', '345p', false),
        makeMeld('shun', '456s', false),
        makeMeld('shun', '456s', false),
      ]
      const hand = parseTiles('88s')
      const res = calculateBestScore(hand, melds, defaultOpts(), new Tile('s', 8))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('推不倒')
      expect(fanNames).toContain('平和')
      expect(fanNames).toContain('一般高')
      expect(fanNames).not.toContain('缺一门')
    })
  })

  describe('43. 无番和 (8分)', () => {
    it('牌例: (花牌) (吃 123p) (碰 555s) (碰 888m) 北北 24条 听 25条双头 (点和 2条)', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', true),
        makeMeld('ke', '555s', true),
        makeMeld('ke', '888m', true),
      ]
      const hand = parseTiles('44z234s')
      const res = calculateBestScore(hand, melds, defaultOpts({ huaCount: 2 }), new Tile('s', 2))
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('无番和')
      expect(fanNames).toContain('花牌')
      expect(res!.totalScore).toBe(8 + 2)
    })
  })

  describe('47. 抢杠和 (8分)', () => {
    it('抢杠和不计和绝张', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', true),
        makeMeld('shun', '456s', true),
        makeMeld('ke', '888m', true),
        makeMeld('shun', '234m', true),
      ]
      const hand = parseTiles('55z')
      const res = calculateBestScore(
        hand,
        melds,
        defaultOpts({ gangShang: true, isSelfDraw: false, juezhang: true }),
        new Tile('z', 5)
      )
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('抢杠和')
      expect(fanNames).not.toContain('和绝张')
    })
  })

  describe('44. 妙手回春 / 46. 杠上开花 (8分)', () => {
    it('妙手回春不计自摸分', () => {
      const melds: Meld[] = [
        makeMeld('shun', '123p', true),
        makeMeld('shun', '456s', true),
        makeMeld('ke', '888m', true),
        makeMeld('shun', '234m', true),
      ]
      const hand = parseTiles('55z')
      const res = calculateBestScore(
        hand,
        melds,
        defaultOpts({ lastTile: true, isSelfDraw: true }),
        new Tile('z', 5)
      )
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('妙手回春')
      expect(fanNames).not.toContain('自摸')
    })

    it('杠上开花不计自摸分', () => {
      const melds: Meld[] = [
        makeMeld('gang', '1111p', true),
        makeMeld('shun', '456s', true),
        makeMeld('ke', '888m', true),
        makeMeld('shun', '234m', true),
      ]
      const hand = parseTiles('55z')
      const res = calculateBestScore(
        hand,
        melds,
        defaultOpts({ gangShang: true, isSelfDraw: true }),
        new Tile('z', 5)
      )
      expect(res).not.toBeNull()
      const fanNames = res!.fans.map((f) => f.name)
      expect(fanNames).toContain('杠上开花')
      expect(fanNames).not.toContain('自摸')
    })
  })
})
