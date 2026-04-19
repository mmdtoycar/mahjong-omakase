import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions } from './types';
import { calculateBestScore } from './fan';
import { findAllCombinations } from './hu';

/**
 * Comprehensive test suite for Guobiao Mahjong Logic.
 * Tests are inspired by standard Guobiao test scenarios.
 * All code is independently implemented.
 */

// --- Hand parser using compact notation ---
// Notation: suit letters (w=万/m, b=饼/p, t=条/s, z=字)
// Mode prefixes: l=concealed(default), c=chi, p=peng, g=minggang, a=angang
// Example: "pb7 lt123456789z11" = peng 7p, concealed 123456789s+11z
function parseHand(str: string, opts: Partial<GameOptions> = {}): {
  concealed: Tile[], melds: Meld[], options: GameOptions
} {
  const concealed: Tile[] = [];
  const melds: Meld[] = [];
  let mode: 'l' | 'c' | 'p' | 'g' | 'a' = 'l';
  let suit: TileSuit = 'z';

  for (const c of str) {
    if (c === 'b') { suit = 'p'; continue; }
    if (c === 't') { suit = 's'; continue; }
    if (c === 'w') { suit = 'm'; continue; }
    if (c === 'z') { suit = 'z'; continue; }
    if (c === 'c') { mode = 'c'; continue; }
    if (c === 'p') { mode = 'p'; continue; }
    if (c === 'g') { mode = 'g'; continue; }
    if (c === 'a') { mode = 'a'; continue; }
    if (c === 'l') { mode = 'l'; continue; }
    if (c === ' ') continue;

    const rank = parseInt(c, 10);
    if (isNaN(rank)) continue;
    const tile = new Tile(suit, rank);

    switch (mode) {
      case 'l': concealed.push(tile); break;
      case 'c': melds.push({
        type: 'shun',
        tiles: [tile, new Tile(suit, rank + 1), new Tile(suit, rank + 2)],
        isOpen: true
      }); break;
      case 'p': melds.push({
        type: 'ke', tiles: [tile, tile, tile], isOpen: true
      }); break;
      case 'g': melds.push({
        type: 'gang', tiles: [tile, tile, tile, tile], isOpen: true
      }); break;
      case 'a': melds.push({
        type: 'gang', tiles: [tile, tile, tile, tile], isOpen: false
      }); break;
    }
  }

  const options: GameOptions = {
    zimo: false, lastTile: false, gangShang: false, juezhang: false,
    quanfeng: 1, menfeng: 1, huaCount: 0, ...opts
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
  expect(result).not.toBeNull();
  const names = result!.fans.map((f: any) => f.name);
  for (const expected of expectedFanNames) {
    expect(names, `Missing fan: ${expected} in [${names.join(', ')}] for hand: ${handStr}`).toContain(expected);
  }
}

function expectNotNull(handStr: string, opts: Partial<GameOptions> = {}) {
  const result = calcHu(handStr, opts);
  expect(result, `Expected valid hu for: ${handStr}`).not.toBeNull();
}

// =============================================================
// DECOMPOSITION TESTS
// =============================================================
describe('Hand Decomposition', () => {
  test('5-tile concealed with 3 exposed melds', () => {
    // 5 concealed tiles (1 meld + 1 pair) + 3 exposed melds = 14 tiles total
    const tiles = [
      new Tile('s', 1), new Tile('s', 1), new Tile('s', 1),
      new Tile('s', 2), new Tile('s', 3)
    ];
    const exposedMelds: Meld[] = [
      { type: 'ke', tiles: [new Tile('m', 1), new Tile('m', 1), new Tile('m', 1)], isOpen: true },
      { type: 'ke', tiles: [new Tile('m', 2), new Tile('m', 2), new Tile('m', 2)], isOpen: true },
      { type: 'ke', tiles: [new Tile('m', 3), new Tile('m', 3), new Tile('m', 3)], isOpen: true },
    ];
    const combos = findAllCombinations(tiles, exposedMelds);
    expect(combos.length).toBeGreaterThan(0);
  });

  test('Full 14-tile concealed hand decomposes', () => {
    // 111s 234s 567s 789s 99z = 14 tiles (3+3+3+3+2)
    const tiles = [
      new Tile('s', 1), new Tile('s', 1), new Tile('s', 1),
      new Tile('s', 2), new Tile('s', 3), new Tile('s', 4),
      new Tile('s', 5), new Tile('s', 6), new Tile('s', 7),
      new Tile('s', 7), new Tile('s', 8), new Tile('s', 9),
      new Tile('z', 9), new Tile('z', 9),
    ];
    const combos = findAllCombinations(tiles, []);
    expect(combos.length).toBeGreaterThan(0);
  });

  test('Hand with one exposed peng decomposes correctly', () => {
    // Exposed: peng of 7z (红中)
    // Concealed: 123m 456m 789m 11z
    const concealed = [
      new Tile('m', 1), new Tile('m', 2), new Tile('m', 3),
      new Tile('m', 4), new Tile('m', 5), new Tile('m', 6),
      new Tile('m', 7), new Tile('m', 8), new Tile('m', 9),
      new Tile('z', 1), new Tile('z', 1),
    ];
    const exposedMelds: Meld[] = [{
      type: 'ke', tiles: [new Tile('z', 7), new Tile('z', 7), new Tile('z', 7)], isOpen: true
    }];
    const combos = findAllCombinations(concealed, exposedMelds);
    expect(combos.length).toBeGreaterThan(0);
  });

  test('Hand with two exposed melds', () => {
    // Exposed: chi 123p, peng 5z
    // Concealed: 789m 11z 234s
    const concealed = [
      new Tile('m', 7), new Tile('m', 8), new Tile('m', 9),
      new Tile('z', 1), new Tile('z', 1),
    ];
    const exposedMelds: Meld[] = [
      { type: 'shun', tiles: [new Tile('p', 1), new Tile('p', 2), new Tile('p', 3)], isOpen: true },
      { type: 'ke', tiles: [new Tile('z', 5), new Tile('z', 5), new Tile('z', 5)], isOpen: true },
      { type: 'shun', tiles: [new Tile('s', 2), new Tile('s', 3), new Tile('s', 4)], isOpen: true },
    ];
    const combos = findAllCombinations(concealed, exposedMelds);
    expect(combos.length).toBeGreaterThan(0);
  });

  test('Seven pairs', () => {
    const tiles = '1122334455667788'.split('').map((c, i) =>
      new Tile('s', parseInt(c, 10))
    );
    // Actually: 1s 1s 2s 2s 3s 3s 4s 4s 5s 5s 6s 6s 7s 7s
    const combos = findAllCombinations([
      new Tile('s',1),new Tile('s',1),new Tile('s',2),new Tile('s',2),
      new Tile('s',3),new Tile('s',3),new Tile('s',4),new Tile('s',4),
      new Tile('s',5),new Tile('s',5),new Tile('s',6),new Tile('s',6),
      new Tile('s',7),new Tile('s',7),
    ], []);
    const specialCombos = combos.filter(c => c.isSpecial);
    expect(specialCombos.length).toBeGreaterThan(0);
  });

  test('Thirteen Orphans', () => {
    const tiles = [
      ...Tile.yao,
      new Tile('m', 1) // duplicate 1m
    ];
    const combos = findAllCombinations(tiles, []);
    const specialCombos = combos.filter(c => c.isSpecial);
    expect(specialCombos.length).toBeGreaterThan(0);
  });

  test('ZuHeLong (组合龙)', () => {
    // w147 p258 s369 + w11 pair + s123 shun = 14 tiles
    const tiles = [
      new Tile('m', 1), new Tile('m', 4), new Tile('m', 7),
      new Tile('p', 2), new Tile('p', 5), new Tile('p', 8),
      new Tile('s', 3), new Tile('s', 6), new Tile('s', 9),
      new Tile('m', 1), new Tile('m', 1),
      new Tile('s', 1), new Tile('s', 2), new Tile('s', 3)
    ];
    const combos = findAllCombinations(tiles, []);
    expect(combos.some(c => c.isZuHeLong)).toBe(true);
  });

  test('BuKao (全不靠)', () => {
    // w147 p258 s369 + z12345
    const tiles = [
      new Tile('m', 1), new Tile('m', 4), new Tile('m', 7),
      new Tile('p', 2), new Tile('p', 5), new Tile('p', 8),
      new Tile('s', 3), new Tile('s', 6), new Tile('s', 9),
      new Tile('z', 1), new Tile('z', 2), new Tile('z', 3),
      new Tile('z', 4), new Tile('z', 5)
    ];
    const combos = findAllCombinations(tiles, []);
    expect(combos.some(c => c.isBuKao)).toBe(true);
  });
});

// =============================================================
// FAN SCORING TESTS  
// =============================================================
describe('Basic Scoring', () => {
  test('Mixed One Suit with exposed peng of dragon', () => {
    // peng red dragon (z5=中), concealed: 123m 456m 789m 11z
    expectFans('pz5 lw123456789z11', ['混一色', '箭刻', '清龙']);
  });

  test('Pure One Suit (via Seven Pairs or standard)', () => {
    // This hand can be decomposed as 7 pairs OR as standard melds
    // The engine selects the highest scoring. Both should have 清一色.
    expectFans('b11223344556688', ['清一色'], { zimo: true });
  });

  test('All Pungs (碰碰和)', () => {
    expectFans('pw1b2t3z1 lw55', ['碰碰和']);
  });

  test('Mixed One Suit basic', () => {
    expectFans('b123555777999z55', ['混一色']);
  });

  test('Self-drawn concealed hand gets 不求人 (which includes 自摸)', () => {
    // All concealed + zimo = 不求人 (excludes 自摸 per GB rules)
    const result = calcHu('b123456789w123z11', { zimo: true });
    expect(result).not.toBeNull();
    expect(result!.fans.some((f: any) => f.name === '不求人')).toBe(true);
  });
});

describe('88 Point Fans', () => {
  test('Big Four Winds (大四喜)', () => {
    expectFans('z111222333444b88', ['大四喜']);
  });

  test('Big Three Dragons (大三元)', () => {
    expectFans('pz567 lt12344', ['大三元']);
  });

  test('All Green (绿一色)', () => {
    expectFans('t223344666888z66', ['绿一色']);
  });

  test('Thirteen Orphans (十三幺)', () => {
    expectFans('t19b19w19z1234567w1', ['十三幺'], { zimo: true });
  });
});

describe('64 Point Fans', () => {
  test('Little Four Winds (小四喜)', () => {
    expectFans('pz123 lz44w555', ['小四喜']);
  });

  test('Little Three Dragons (小三元)', () => {
    // peng 中(z5), peng 发(z6), pair 白(z7), + 123456m = 2*3+8=14
    expectFans('pz56 lz77w123456', ['小三元']);
  });

  test('All Honors (字一色)', () => {
    expectFans('z11122255566644', ['字一色']);
  });

  test('Four Concealed Pungs (四暗刻)', () => {
    expectFans('b111999w111z111t55', ['四暗刻'], { menfeng: 1, quanfeng: 1 });
  });
});

describe('12 Point Fans', () => {
  test('Combination Dragon (组合龙)', () => {
    // w147 b258 t369 + w11 pair + t123 shun
    expectFans('w147 b258 t369 w11 t123', ['组合龙']);
  });

  test('Greater Honors and Knitted Tiles (全不靠)', () => {
    // w147 b258 t369 + z12345
    expectFans('w147 b258 t369 z12345', ['全不靠']);
  });
});

describe('24 Point Fans', () => {
  test('Seven Star Greater Honors and Knitted Tiles (七星不靠)', () => {
    // w147 b25 t36 + z1234567 = 14 tiles
    expectFans('w147 b25 t36 z1234567', ['七星不靠']);
  });

  test('Pure One Suit (清一色)', () => {
    expectFans('w12323455578922', ['清一色']);
  });

  test('Seven Pairs (七对)', () => {
    expectFans('t114455w6677z5566', ['七对']);
  });
});

describe('16 Point Fans', () => {
  test('Pure Straight (清龙)', () => {
    expectFans('w123456789z22233', ['清龙']);
  });
});

describe('8 Point Fans', () => {
  test('Mixed Triple Sequence (三色三同顺)', () => {
    expectFans('ct7b7w7 lt789 66', ['三色三同顺']);
  });

  test('Mixed Straight (花龙)', () => {
    expectFans('b123w456t789z44455', ['花龙']);
  });
});

describe('6 Point Fans', () => {
  test('All Pungs (碰碰和)', () => {
    expectFans('pb7w8 lt111z444b44', ['碰碰和']);
  });

  test('Mixed One Suit (混一色) basic', () => {
    expectFans('b123555777999z55', ['混一色']);
  });

  test('Five Types (五门齐)', () => {
    // m + p + s + wind + dragon
    expectFans('w123t678b444z44455', ['五门齐']);
  });
});

describe('Special Context Fans', () => {
  test('Self draw (自摸)', () => {
    const r = calcHu('w123456789b123z11', { zimo: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '不求人')).toBe(true);
  });

  test('Last Tile Moon (海底捞月)', () => {
    const r = calcHu('w123456789b123z11', { lastTile: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '海底捞月')).toBe(true);
  });

  test('Last Tile Spring (妙手回春)', () => {
    const r = calcHu('w123456789b123z11', { lastTile: true, zimo: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '妙手回春')).toBe(true);
  });

  test('Kong Bloom (杠上开花)', () => {
    const r = calcHu('gt2 lz11 b123456789', { gangShang: true, zimo: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '杠上开花')).toBe(true);
  });

  test('Rob Kong (抢杠和)', () => {
    const r = calcHu('pt2 lz11 b123456789', { gangShang: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '抢杠和')).toBe(true);
  });

  test('Last Tile Absolute (和绝张)', () => {
    const r = calcHu('pt2 lz11 b123456789', { juezhang: true });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '和绝张')).toBe(true);
  });

  test('Flower tiles', () => {
    const r = calcHu('w123456789b123z11', { huaCount: 3 });
    expect(r).not.toBeNull();
    const huaFans = r!.fans.filter((f: any) => f.name === '花牌');
    expect(huaFans.length).toBe(3);
  });
});

describe('Complex Combined Hands', () => {
  test('Mixed One Suit with exposed gang of red dragon', () => {
    // This is the exact case the user reported as broken
    expectNotNull('gz5 lw123456789z11');
  });

  test('Exposed chi + peng still scores', () => {
    expectNotNull('cw1 pb7 lt111z444b44');
  });

  test('All exposed (全求人)', () => {
    expectFans('ct15 pb3w4 lz33', ['全求人']);
  });

  test('Mixed Old Head (混幺九)', () => {
    expectFans('t111999w111z55566', ['混幺九']);
  });

  test('Sequence fan interactions', () => {
    // Two 老少副 + two 喜相逢 in one hand
    expectFans('t123789w123789b66', ['喜相逢', '老少副']);
  });
});

describe('No-Fan Win (无番和)', () => {
  test('Basic no-fan win with flowers', () => {
    const r = calcHu('pb7 lt123 67 w789 z11 t5', { huaCount: 2 });
    expect(r).not.toBeNull();
    expect(r!.fans.some((f: any) => f.name === '无番和')).toBe(true);
    expect(r!.fans.some((f: any) => f.name === '花牌')).toBe(true);
  });
});
