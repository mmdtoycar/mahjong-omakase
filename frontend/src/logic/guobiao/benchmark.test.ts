import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions, CalcResult } from './types';
import { calculateBestScore } from './fan';

function parseHand(handStr: string, opts: Partial<GameOptions> = {}): { concealed: Tile[], melds: Meld[], options: GameOptions } {
  const concealed: Tile[] = [];
  const melds: Meld[] = [];
  
  const tokens = handStr.trim().split(/\s+/);
  for (const token of tokens) {
    if (token.startsWith('chi:')) {
      const suit = token[4] as TileSuit;
      const rank = Number(token.slice(5));
      melds.push({ type: 'shun', tiles: [new Tile(suit, rank), new Tile(suit, rank+1), new Tile(suit, rank+2)], isOpen: true });
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

function expectFans(handStr: string, expectedFanNames: string[], opts: Partial<GameOptions> = {}) {
  const { concealed, melds, options } = parseHand(handStr, opts);
  const lastTile = concealed.length > 0 ? concealed[concealed.length - 1] : undefined;
  const result = calculateBestScore(concealed, melds, options, lastTile);
  
  expect(result, `Hand failed to Hu: ${handStr}`).not.toBeNull();
  const names = result!.fans.map((f: any) => f.name);
  for (const expected of expectedFanNames) {
    expect(names, `Missing fan: ${expected} in [${names.join(', ')}] for hand: ${handStr}`).toContain(expected);
  }
}

describe('Guobiao Benchmarks - Automated From XDean Samples', () => {
  test('Sample 1: 一般高', () => {
    expectFans('p3 p3 p4 p4 p5 p5 s6 s6 s6 m3 m4 m5 z3 z3', ['一般高'], {});
  });

  test('Sample 2: 喜相逢', () => {
    expectFans('m6 m7 m8 p6 p7 p8 p2 p2 p2 m1 m1 m1 m9 m9', ['喜相逢'], {});
  });

  test('Sample 3: 连六', () => {
    expectFans('s3 s4 s5 s6 s7 s8 p9 p9 p9 m9 m9 m9 s1 s1', ['连六'], {});
  });

  test('Sample 4: 老少副', () => {
    expectFans('s1 s2 s3 m9 m9 m9 p9 p9 p9 s7 s8 s9 z5 z5', ['老少副'], {});
  });

  test('Sample 6: 四归一', () => {
    expectFans('m7 m8 m9 s5 s6 s7 m9 m9 m9 z4 z4 z4 z3 z3', ['四归一'], {});
  });

  test('Sample 7: 双同刻', () => {
    expectFans('m5 m5 m5 p5 p5 p5 s1 s2 s3 z4 z4 z4 z3 z3', ['双同刻'], {});
  });

  test('Sample 8: 双暗刻', () => {
    expectFans('m5 m5 m5 s5 s5 s5 s1 s2 s3 s4 s5 s6 z3 z3', ['双暗刻'], {});
  });
  test('Sample 10: 不求人', () => {
    expectFans('angang:p2 m1 m2 m3 m6 m6 m6 m7 m8 m9 s5 s5', ['不求人'], {"zimo":true});
  });

  test('Sample 11: 双明杠', () => {
    expectFans('gang:p7 gang:m8 s1 s1 s1 z4 z4 z4 p4 p4', ['双明杠'], {});
  });

  test('Sample 12: 和绝张', () => {
    expectFans('pung:p7 pung:m8 s1 s1 s1 z4 z4 z4 p4 p4', ['和绝张'], { juezhang: true });
  });

  test('Sample 13: 混一色', () => {
    expectFans('p1 p2 p3 p5 p5 p5 p7 p7 p7 p9 p9 p9 z5 z5', ['混一色'], {});
  });

  test('Sample 14: 三色三步高', () => {
    expectFans('m5 m6 m7 p6 p7 p8 s7 s8 s9 z5 z5 z5 z6 z6', ['三色三步高'], {});
  });

  test('Sample 15: 五门齐', () => {
    expectFans('m1 m2 m3 s6 s7 s8 p4 p4 p4 z4 z4 z4 z5 z5', ['五门齐'], {});
  });

  test('Sample 16: 全求人', () => {
    expectFans('chi:s1 chi:s5 pung:p3 pung:m4 z3 z3', ['全求人'], {});
  });

  test('Sample 17: 双箭刻', () => {
    expectFans('z5 z5 z5 z6 z6 z6 p4 p5 p6 m7 m8 m9 m9 m9', ['双箭刻'], {});
  });

  test('Sample 18: 明暗杠', () => {
    expectFans('angang:p7 gang:m8 s1 s1 s1 z3 z3 z3 z4 z4', ['明暗杠'], {});
  });

  test('Sample 19: 花龙', () => {
    expectFans('p1 p2 p3 m4 m5 m6 s7 s8 s9 z4 z4 z4 z5 z5', ['花龙'], {});
  });

  test('Sample 20: 推不到', () => {
    expectFans('p2 p3 p4 p5 p5 p5 s4 s5 s6 z7 z7 z7 p1 p1', ['推不到'], {});
  });

  test('Sample 21: 三色三同顺', () => {
    expectFans('p7 p8 p9 m7 m8 m9 s7 s8 s9 z5 z5 z5 z6 z6', ['三色三同顺'], {});
  });

  test('Sample 22: 三色三节高', () => {
    expectFans('m4 m4 m4 p5 p5 p5 s6 s6 s6 z5 z5 z5 z6 z6', ['三色三节高'], {});
  });

  test('Sample 23: 无番和', () => {
    expectFans('chi:p2 s3 s4 s5 m8 m8 m8 z1 z1 s7 s8 s9', ['无番和'], {});
  });

  test('Sample 24: 妙手回春', () => {
    expectFans('angang:p7 angang:m8 s1 s1 s1 z4 z4 z4 p4 p4', ['妙手回春'], { lastTile: true, zimo: true });
  });

  test('Sample 25: 全不靠', () => {
    expectFans('m1 m4 m7 p2 p5 p8 s3 s6 z1 z2 z3 z5 z6 z7', ['全不靠'], {});
  });

  test('Sample 26: 组合龙', () => {
    expectFans('m1 m4 m7 p2 p5 p8 s3 s6 s9 m5 m5 m5 z4 z4', ['组合龙'], {});
  });

  test('Sample 27: 大于五', () => {
    expectFans('p7 p7 p7 p8 p8 p8 s6 s7 s8 m7 m8 m9 p6 p6', ['大于五'], {});
  });

  test('Sample 28: 小于五', () => {
    expectFans('p2 p2 p2 p3 p3 p3 s2 s3 s4 m1 m2 m3 p4 p4', ['小于五'], {});
  });

  test('Sample 29: 三风刻', () => {
    expectFans('z1 z1 z1 z2 z2 z2 z3 z3 z3 m5 m6 m7 s9 s9', ['三风刻'], {});
  });

  test('Sample 30: 清龙', () => {
    expectFans('m1 m2 m3 m4 m5 m6 m7 m8 m9 z2 z2 z2 z3 z3', ['清龙'], {});
  });

  test('Sample 31: 三色双龙会', () => {
    expectFans('m1 m2 m3 m7 m8 m9 s1 s2 s3 s7 s8 s9 p5 p5', ['三色双龙会'], {});
  });

  test('Sample 32: 一色三步高', () => {
    expectFans('s3 s4 s5 s4 s5 s6 s5 s6 s7 z5 z5 z5 z6 z6', ['一色三步高'], {});
  });

  test('Sample 33: 全带五', () => {
    expectFans('p5 p5 p5 s3 s4 s5 m5 m6 m7 p4 p5 p6 m5 m5', ['全带五'], {});
  });

  test('Sample 34: 三同刻', () => {
    expectFans('p6 p6 p6 s6 s6 s6 m6 m6 m6 z5 z5 z5 z6 z6', ['三同刻'], {});
  });

  test('Sample 35: 三暗刻', () => {
    expectFans('p1 p1 p1 p3 p3 p3 p5 p5 p5 p6 p7 p8 p9 p9', ['三暗刻'], {});
  });

  test('Sample 36: 七对', () => {
    expectFans('s1 s1 s4 s4 s5 s5 m6 m6 m7 m7 z5 z5 z6 z6', ['七对'], {});
  });

  test('Sample 37: 七星不靠', () => {
    expectFans('m1 m4 m7 p2 p5 p8 s3 z1 z2 z3 z4 z5 z6 z7', ['七星不靠'], {});
  });

  test('Sample 38: 全双刻', () => {
    expectFans('s2 s2 s2 p4 p4 p4 m2 m2 m2 m8 m8 m8 s4 s4', ['全双刻'], {});
  });

  test('Sample 39: 清一色', () => {
    expectFans('m1 m2 m3 m2 m3 m4 m5 m5 m5 m7 m8 m9 m2 m2', ['清一色'], {});
  });

  test('Sample 40: 一色三同顺', () => {
    expectFans('chi:s4 s4 s5 s6 s4 s5 s6 m6 m7 m8 z3 z3', ['一色三同顺'], {});
  });

  test('Sample 41: 一色三节高', () => {
    expectFans('pung:s4 s5 s5 s5 s6 s6 s6 m6 m7 m8 z3 z3', ['一色三节高'], {});
  });

  test('Sample 42: 全大', () => {
    expectFans('p7 p7 p7 p8 p8 p8 s7 s8 s9 m7 m8 m9 p9 p9', ['全大'], {});
  });

  test('Sample 43: 全中', () => {
    expectFans('p5 p5 p5 p6 p6 p6 s4 s5 s6 m4 m5 m6 p4 p4', ['全中'], {});
  });

  test('Sample 44: 全小', () => {
    expectFans('p1 p1 p1 p3 p3 p3 s1 s2 s3 m1 m2 m3 s2 s2', ['全小'], {});
  });

  test('Sample 45: 一色四步高', () => {
    expectFans('m1 m2 m3 m2 m3 m4 m3 m4 m5 m4 m5 m6 m9 m9', ['一色四步高'], {});
  });

  test('Sample 46: 一色四步高', () => {
    expectFans('m1 m2 m3 m3 m4 m5 m5 m6 m7 m7 m8 m9 z5 z5', ['一色四步高'], {});
  });

  test('Sample 47: 三杠', () => {
    expectFans('angang:m1 angang:m2 angang:m3 m4 m4 m4 m5 m5', ['三杠'], {});
  });

  test('Sample 48: 混幺九', () => {
    expectFans('s1 s1 s1 s9 s9 s9 m1 m1 m1 z5 z5 z5 z6 z6', ['混幺九'], {});
  });

  test('Sample 49: 一色四同顺', () => {
    expectFans('s6 s7 s8 s6 s7 s8 s6 s7 s8 s6 s7 s8 z5 z5', ['一色四同顺'], {});
  });

  test('Sample 50: 一色四节高', () => {
    expectFans('m1 m1 m1 m2 m2 m2 m3 m3 m3 m4 m4 m4 z5 z5', ['一色四节高'], {});
  });

  test('Sample 51: 清幺九', () => {
    expectFans('s1 s1 s1 p1 p1 p1 p9 p9 p9 m1 m1 m1 m9 m9', ['清幺九'], {});
  });

  test('Sample 52: 小四喜', () => {
    expectFans('m5 m5 m5 z1 z1 z1 z2 z2 z2 z3 z3 z3 z4 z4', ['小四喜'], {});
  });

  test('Sample 53: 小三元', () => {
    expectFans('p5 p5 p5 s6 s7 s8 z5 z5 z5 z6 z6 z6 z7 z7', ['小三元'], {});
  });

  test('Sample 54: 字一色', () => {
    expectFans('z1 z1 z1 z2 z2 z2 z5 z5 z5 z6 z6 z6 z4 z4', ['字一色'], {});
  });

  test('Sample 55: 四暗刻', () => {
    expectFans('m1 m1 m1 m2 m2 m2 m4 m4 m4 m5 m5 m5 m6 m6', ['四暗刻'], {});
  });

  test('Sample 56: 一色双龙会', () => {
    expectFans('m1 m1 m2 m2 m3 m3 m7 m7 m8 m8 m9 m9 m5 m5', ['一色双龙会'], {});
  });

  test('Sample 57: 大四喜', () => {
    expectFans('z1 z1 z1 z2 z2 z2 z3 z3 z3 z4 z4 z4 p8 p8', ['大四喜'], {});
  });

  test('Sample 58: 大三元', () => {
    expectFans('z5 z5 z5 z6 z6 z6 z7 z7 z7 s1 s2 s3 s4 s4', ['大三元'], {});
  });

  test('Sample 59: 绿一色', () => {
    expectFans('s2 s2 s3 s3 s4 s4 s6 s6 s6 s8 s8 s8 z6 z6', ['绿一色'], {});
  });

  test('Sample 60: 九莲宝灯', () => {
    expectFans('m1 m1 m1 m2 m3 m4 m5 m6 m7 m8 m9 m9 m9 m9', ['九莲宝灯'], {});
  });

  test('Sample 61: 四杠', () => {
    expectFans('angang:m2 angang:m5 angang:m8 angang:s4 s6 s6', ['四杠'], {});
  });

  test('Sample 62: 四杠', () => {
    expectFans('angang:m2 angang:m5 angang:m8 gang:s4 s6 s6', ['四杠'], {});
  });

  test('Sample 63: 连七对', () => {
    expectFans('m1 m1 m2 m2 m3 m3 m4 m4 m5 m5 m6 m6 m7 m7', ['连七对'], {});
  });

  test('Sample 64: 十三幺', () => {
    expectFans('s1 s9 p1 p9 m1 m9 z1 z2 z3 z4 z5 z6 z7 z7', ['十三幺'], {});
  });

});

describe('Guobiao Benchmarks - Special Scoring Rules', () => {
  test('Rule 1', () => {
    expectFans('chi:s1 chi:s2 chi:s3 chi:s4 m7 m7', ["一色四步高","全求人","平和","缺一门"], {});
  });

  test('Rule 2', () => {
    expectFans('p1 p2 p3 p3 p4 p5 p5 p6 p7 p7 p8 p9 m7 m7', ["一色四步高","单钓将","平和","缺一门","门前清"], {});
  });

  test('Rule 3', () => {
    expectFans('chi:m1 chi:m4 chi:m7 chi:m1 s1 s1', ["清龙","全求人","平和","一般高","缺一门"], {});
  });

  test('Rule 4', () => {
    expectFans('chi:m1 chi:m4 chi:m7 chi:m4 s1 s1', ["清龙","全求人","平和","一般高","缺一门"], {});
  });

  test('Rule 5', () => {
    expectFans('pung:p2 pung:s3 pung:m4 pung:p5 z1 z1', ["三色三节高","碰碰和","全求人"], {});
  });

  test('Rule 6', () => {
    expectFans('chi:m5 chi:p4 chi:s3 chi:s6 z1 z1', ["三色三步高","全求人","连六"], {});
  });

  test('Rule 7', () => {
    expectFans('chi:s3 chi:s3 chi:p3 m7 m7 m8 m8 m8', ["断幺","一般高","喜相逢"], {});
  });

  test('Rule 8', () => {
    expectFans('p5 p5 p5 p6 p6 p6 p7 p7 p7 s5 s5 s5 s6 s7', ["一色三同顺","全带五","不求人","平和","喜相逢","缺一门"], {"zimo":true});
  });

  test('Rule 9', () => {
    expectFans('chi:m1 chi:m4 chi:p7 chi:s1 z1 z1', ["花龙","全求人","连六"], {});
  });

  test('Rule 10', () => {
    expectFans('chi:m1 chi:m7 chi:s1 chi:s7 z1 z1', ["全求人","全带幺","喜相逢","喜相逢","老少副","缺一门"], {});
  });

  test('Rule 11', () => {
    expectFans('p1 p1 p2 p2 p3 p3 p4 p4 p5 p5 p6 p6 p8 p8', ["七对","清一色","不求人"], {"zimo":true});
  });

  test('Rule 12', () => {
    expectFans('pung:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","和绝张"], {"juezhang":true});
  });

  test('Rule 13', () => {
    expectFans('pung:s2 p1 p2 p3 p4 p5 p6 p7 p8 p9 z1 z1', ["清龙","单钓将","缺一门"], {"juezhang":true});
  });

  test('Rule 14', () => {
    expectFans('pung:s2 p1 p2 p3 p4 p5 p6 p7 p8 p9 z1 z1', ["清龙","单钓将","缺一门"], {"gangShang":true});
  });

  test('Rule 15', () => {
    expectFans('pung:s2 p1 p2 p3 p4 p5 p6 p7 p8 p9 z1 z1', ["清龙","单钓将","缺一门","自摸"], {"zimo":true,"gangShang":true});
  });

  test('Rule 16', () => {
    expectFans('pung:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","抢杠和"], {"gangShang":true});
  });

  test('Rule 17', () => {
    expectFans('gang:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","杠上开花","明杠"], {"zimo":true,"gangShang":true});
  });

  test('Rule 18', () => {
    expectFans('gang:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","明杠","妙手回春"], {"zimo":true,"lastTile":true});
  });

  test('Rule 19', () => {
    expectFans('gang:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","明杠","海底捞月"], {"lastTile":true});
  });

  test('Rule 20', () => {
    expectFans('gang:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","明杠","妙手回春","杠上开花"], {"zimo":true,"gangShang":true,"lastTile":true});
  });

  test('Rule 21', () => {
    expectFans('gang:s2 z1 z1 p1 p2 p3 p4 p5 p6 p7 p8 p9', ["清龙","缺一门","明杠","海底捞月","抢杠和"], {"gangShang":true,"lastTile":true});
  });

  test('Rule 22', () => {
    expectFans('chi:s7 chi:p7 chi:m7 s7 s8 s9 s6 s6', ["大于五","三色三同顺","平和","一般高"], {});
  });

  test('Rule 23', () => {
    expectFans('pung:p7 s1 s2 s3 s6 s7 m7 m8 m9 z1 z1 s5', ["无番和","花牌","花牌"], {"huaCount":2});
  });

  test('Rule 24', () => {
    expectFans('p1 p1 p1 p9 p9 p9 m1 m1 m1 z1 z1 z1 s5 s5', ["四暗刻","双同刻","圈风刻","门风刻","幺九刻","幺九刻","幺九刻","单钓将"], {"quanfeng":1,"menfeng":1});
  });

  test('Rule 25', () => {
    expectFans('pung:m3 pung:z3 pung:s1 z6 z6 p3 p3 p3', ["双同刻","幺九刻","幺九刻","五门齐","碰碰和"], {});
  });

  test('Rule 26', () => {
    expectFans('s3 s4 s5 s3 s4 s5 p2 p3 p4 m3 m4 m5 z6 z6', ["一般高","单钓将","喜相逢","门前清"], {});
  });

  test('Rule 27', () => {
    expectFans('s1 s2 s3 s7 s8 s9 m1 m2 m3 m7 m8 m9 p6 p6', ["单钓将","喜相逢","平和","喜相逢","老少副","门前清"], {});
  });

  test('Rule 28', () => {
    expectFans('s1 s9 m1 m9 p1 p9 z1 z2 z3 z4 z5 z6 z7 z1', ["十三幺", "不求人"], {"zimo":true});
  });

  test('Rule 29', () => {
    expectFans('pung:s8 s6 s6 s2 s3 s4 s2 s3 s4 s3 s4 s2', ["绿一色","一色三节高","碰碰和","三暗刻","清一色","断幺"], {});
  });

  test('Rule 30', () => {
    expectFans('pung:s8 s1 s2 s3 s3 s4 p2 p3 p4 m6 m6 s2', ["喜相逢","无字"], {});
  });

  test('Rule 31', () => {
    expectFans('s2 s2 s2 p2 p3 p4 pung:s8 m5 m5 s1 s3 s2', ["四归一","无字"], {});
  });

  test('Rule 32', () => {
    expectFans('gang:s2 angang:s4 s6 s6 s6 s8 s8 z6 z6 s8', ["绿一色","三暗刻","碰碰和","混一色","明暗杠"], {});
  });

  test('Rule 33', () => {
    expectFans('s2 s3 s4 s5 s6 s7 p2 p3 p4 p5 p6 m3 m3 p7', ["门前清","平和","断幺","喜相逢","喜相逢","连六"], {});
  });

  test('Rule 34', () => {
    expectFans('angang:m1 angang:m9 angang:s1 angang:s9 p1 p1', ["清幺九","四暗刻","四杠"], {});
  });

  test('Rule 35', () => {
    expectFans('s1 s2 s3 s5 s6 s7 m3 m4 m5 m8 m9 z5 z5 m7', ["门前清","缺一门","边张"], {});
  });

});
