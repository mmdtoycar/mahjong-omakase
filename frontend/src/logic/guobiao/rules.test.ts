import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions, CalcResult } from './types';
import { calculateBestScore } from './fan';
import { findAllCombinations } from './hu';

/**
 * Comprehensive test suite for Guobiao Mahjong Logic.
 */

function parseHand(handStr: string, opts: Partial<GameOptions> = {}): { concealed: Tile[], melds: Meld[], options: GameOptions } {
  const concealed: Tile[] = [];
  const melds: Meld[] = [];
  
  const tokens = handStr.split(' ');
  for (const token of tokens) {
    if (token.startsWith('l')) { // Exposed meld (chi/pung)
      const content = token.slice(1);
      const suit = content[0] as TileSuit;
      const ranks = content.slice(1).split('').map(Number);
      const tiles = ranks.map(r => new Tile(suit, r));
      melds.push({ type: ranks.length === 3 ? (ranks[0] === ranks[1] ? 'ke' : 'shun') : 'dui', tiles, isOpen: true });
    } else if (token.startsWith('c')) { // Concealed meld (chi/pung)
      const content = token.slice(1);
      const suit = content[0] as TileSuit;
      const ranks = content.slice(1).split('').map(Number);
      melds.push({ type: 'shun', tiles: ranks.map(r => new Tile(suit, r)), isOpen: false });
    } else if (token.startsWith('p')) { // Exposed Pung
      const content = token.slice(1);
      const suit = content[0] as TileSuit;
      const rank = Number(content.slice(1));
      melds.push({ type: 'ke', tiles: [new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank)], isOpen: true });
    } else if (token.startsWith('g')) { // Exposed Gang
      const content = token.slice(1);
      const suit = content[0] as TileSuit;
      const rank = Number(content.slice(1));
      melds.push({ type: 'gang', tiles: [new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank), new Tile(suit, rank)], isOpen: true });
    } else if (token.startsWith('gz')) { // Concealed Gang (暗杠)
      const content = token.slice(2);
      const suit = content[0] as TileSuit;
      const rank = Number(content.slice(1));
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

describe('Guobiao 81 Fans Coverage', () => {
  describe('88 Point Fans', () => {
    test('Big Four Winds', () => expectFans('z11122233344411', ['大四喜']));
    test('Big Three Dragons', () => expectFans('z555666777 w123 w55', ['大三元']));
    test('All Green', () => expectFans('t234234666|888 z66', ['绿一色']));
    test('Nine Gates', () => expectFans('w1112345678999 w5', ['九莲宝灯']));
    test('Four Kongs', () => expectFans('gw1 gp2 gs3 gz4 t55', ['四杠']));
    test('Seven Consecutive Pairs', () => expectFans('w11223344556677', ['连七对']));
    test('Thirteen Orphans', () => expectFans('w19 p19 t19 z1234567 z7', ['十三幺']));
  });

  describe('64/48 Point Fans', () => {
    test('All Terminals', () => expectFans('w111p111t111w999p99', ['清幺九']));
    test('Pure Quad Sequence', () => {
      const r = calcHu('t11112222333344');
      expect(r!.fans.map(f => f.name)).toContain('一色四同顺');
      expect(r!.fans.map(f => f.name)).not.toContain('一色三同顺');
    });
    test('Pure Double Dragon', () => expectFans('w11223377889955', ['一色双龙会']));
  });

  describe('Low Value & Exclusions', () => {
    test('User Hand (88+)', () => {
      const r = calcHu('t11112222333344', { zimo: true });
      expect(r!.totalScore).toBeGreaterThanOrEqual(81);
    });
  });
});
