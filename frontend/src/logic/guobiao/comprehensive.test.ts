import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions, CalcResult } from './types';
import { calculateBestScore } from './fan';

/**
 * Comprehensive Test Suite for Guobiao Mahjong Logic.
 * References from XDean's engine (https://github.com/XDean/tool.xdean.cn)
 */

function parseHand(handStr: string, opts: Partial<GameOptions> = {}): { concealed: Tile[], melds: Meld[], options: GameOptions } {
  const concealed: Tile[] = [];
  const melds: Meld[] = [];
  
  const tokens = handStr.trim().split(/\s+/);
  for (const token of tokens) {
    if (token.startsWith('chi:')) {
      const suit = token[4] as TileSuit;
      const ranks = token.slice(5).split('').map(Number);
      melds.push({ type: 'shun', tiles: ranks.map(r => new Tile(suit, r)), isOpen: true });
    } else if (token.startsWith('pung:')) {
      const suit = token[5] as TileSuit;
      const rank = Number(token.slice(6));
      melds.push({ type: 'ke', tiles: [new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank)], isOpen: true });
    } else if (token.startsWith('gang:')) {
      const suit = token[5] as TileSuit;
      const rank = Number(token.slice(6));
      melds.push({ type: 'gang', tiles: [new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank)], isOpen: true });
    } else if (token.startsWith('angang:')) {
      const suit = token[7] as TileSuit;
      const rank = Number(token.slice(8));
      melds.push({ type: 'gang', tiles: [new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank)], isOpen: false });
    } else {
      const suit = token[0] as TileSuit;
      const ranks = token.slice(1).split('').map(Number);
      ranks.forEach(r => concealed.push(new Tile(suit, r)));
    }
  }

  const options: GameOptions = {
    zimo: false, lastTile: false, gangShang: false, juezhang: false,
    quanfeng: 1, menfeng: 1, huaCount: 0, showTingFans: false, ...opts
  };

  return { concealed, melds, options };
}

function calcHu(handStr: string, opts: Partial<GameOptions> = {}): CalcResult | null {
  const { concealed, melds, options } = parseHand(handStr, opts);
  const lastTile = concealed.length > 0 ? concealed[concealed.length - 1] : undefined;
  return calculateBestScore(concealed, melds, options, lastTile);
}

function expectFans(handStr: string, expectedFanNames: string[], opts: Partial<GameOptions> = {}) {
  const result = calcHu(handStr, opts);
  expect(result, `Hand failed to Hu: ${handStr}`).not.toBeNull();
  const names = result!.fans.map((f: any) => f.name);
  for (const expected of expectedFanNames) {
    expect(names, `Missing fan: ${expected} in [${names.join(', ')}] for hand: ${handStr}`).toContain(expected);
  }
}

describe('Guobiao Logic XDean Compliance', () => {
  test('Case 1: Pure 4 Steps (一色四步高)', () => {
    expectFans('chi:s123 chi:s234 chi:s345 chi:s456 m77', ['一色四步高', '全求人', '平和', '缺一门']);
  });

  test('Case 2: Pure 4 Steps Concealed', () => {
    expectFans('p123345567789 m77', ['一色四步高', '单钓将', '平和', '缺一门', '门前清']);
  });

  test('Case 3: Pure Dragon + YiBanGao', () => {
    expectFans('chi:m123 chi:m456 chi:m789 chi:m123 s11', ['清龙', '全求人', '平和', '一般高', '缺一门']);
  });

  test('Case 4: Mixed Triple Ke', () => {
    expectFans('pung:p2 pung:s3 pung:m4 pung:p5 z11', ['三色三节高', '碰碰和', '全求人']);
  });

  test('Case 5: Mixed Triple Steps', () => {
    expectFans('chi:m567 chi:p456 chi:s345 chi:m678 z11', ['三色三步高', '全求人', '连六']);
  });

  test('Case 6: All Green Overlap', () => {
    expectFans('pung:s8 s66234234342', ['绿一色', '一色三节高', '碰碰和', '双暗刻', '清一色', '断幺']);
  });

  test('Case 7: Seven Pairs Pure', () => {
    expectFans('p11223344556688', ['七对', '清一色', '不求人'], { zimo: true });
  });

  test('Case 8: Thirteen Orphans Zimo', () => {
    expectFans('s19m19p19z1234567 s1', ['十三幺', '自摸'], { zimo: true });
  });

  test('Case 9: Little Four Winds', () => {
    // 3 wind kes, 1 wind pair, 1 other ke
    expectFans('z11122233344 s111', ['小四喜', '三风刻', '碰碰和', '三暗刻', '幺九刻']);
  });

  test('Case 10: Little Three Dragons', () => {
    // 2 dragon kes, 1 dragon pair, 2 shuns
    expectFans('z55566677 s234 p234', ['小三元', '双箭刻', '双暗刻', '喜相逢', '缺一门']);
  });

  test('Case 11: Robbing a Kong', () => {
    expectFans('pung:p2 z11 m123456789', ['清龙', '缺一门', '抢杠和'], { gangShang: true, zimo: false });
  });

  test('Case 12: Out of Kong', () => {
    expectFans('gang:s2 z11 m123456789', ['清龙', '缺一门', '杠上开花', '明杠'], { gangShang: true, zimo: true });
  });

  test('Case 13: Last Tile Self-Draw', () => {
    expectFans('gang:s2 z11 m123456789', ['清龙', '缺一门', '明杠', '妙手回春'], { lastTile: true, zimo: true });
  });

  test('Case 14: Last Tile Discard', () => {
    expectFans('gang:s2 z11 m123456789', ['清龙', '缺一门', '明杠', '海底捞月'], { lastTile: true, zimo: false });
  });

  test('Case 15: Pure Triple Shuns (One Suit)', () => {
    // p555666777 is 3 kes. Let's make' em shuns: p567 p567 p567
    expectFans('p567 p567 p567 s555 s66', ['一色三同顺', '不求人', '平和', '喜相逢', '缺一门'], { zimo: true });
  });

  test('Case 16: Flower Tiles No-Fan', () => {
    expectFans('pung:p7 s12367 m789 z11 s5', ['无番和', '花牌'], { huaCount: 2 });
  });

  test('Case 17: Prevalent/Seat Wind logic', () => {
    expectFans('p111 p999 m111 z111 s55', ['四暗刻', '双同刻', '圈风刻', '门风刻', '幺九刻', '单钓将'], { quanfeng: 1, menfeng: 1 });
  });

  test('Case 18: Honor Double Ke', () => {
    expectFans('pung:m3 pung:z3 pung:s1 z66 pung:p3', ['双同刻', '幺九刻', '五门齐', '碰碰和']);
  });

  test('Case 19: Double LaoShaoFu & Double XiXiangFeng', () => {
    expectFans('s123789 m123789 p66', ['喜相逢', '平和', '老少副', '门前清']);
  });

  test('Case 20: All Five Complex', () => {
    expectFans('s456 p456 m456 s456 p55', ['全带五', '一般高', '三色三同顺', '全中']);
  });

  test('Case 21: Bug Report - Duplicate MenQianQing', () => {
    // s111 222 333 444 33, win on 3s discard
    const r = calcHu('s111 s222 s333 s444 s33', { zimo: false });
    const mqCount = r!.fans.find(f => f.name === '门前清')?.count || 0;
    expect(mqCount).toBe(1);
  });
});
