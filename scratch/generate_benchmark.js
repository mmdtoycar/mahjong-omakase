const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('xdean_samples.json', 'utf-8'));
const rules = JSON.parse(fs.readFileSync('xdean_rules.json', 'utf-8'));
const mapping = JSON.parse(fs.readFileSync('xdean_mapping.json', 'utf-8'));

function translateHand(hand) {
    let out = [];
    let mode = 'l';
    let suit = 'z';
    
    const suitMap = { 't': 's', 'b': 'p', 'w': 'm', 'z': 'z' };
    const modeMap = { 'c': 'chi:', 'p': 'pung:', 'g': 'gang:', 'a': 'angang:', 'l': '' };

    for (let i = 0; i < hand.length; i++) {
        let c = hand[i];
        if (['c', 'p', 'g', 'a', 'l'].includes(c)) {
            mode = c;
        } else if (['t', 'b', 'w', 'z'].includes(c)) {
            suit = suitMap[c];
        } else if (/\d/.test(c)) {
            const prefix = modeMap[mode];
            if (mode === 'l') {
                // For loose tiles, we aggregate them by suit for better readability
                // but for simplicity here we just do [suit][rank]
                out.push(`${suit}${c}`);
            } else {
                out.push(`${prefix}${suit}${c}`);
            }
        }
    }
    
    return out.join(' ');
}

function translateOpts(optsStr) {
    if (!optsStr) return "{}";
    const opts = {};
    if (optsStr.includes('zimo: true')) opts.zimo = true;
    if (optsStr.includes('juezhang: true')) opts.juezhang = true;
    if (optsStr.includes('gangShang: true')) opts.gangShang = true;
    if (optsStr.includes('lastTile: true')) opts.lastTile = true;
    if (optsStr.includes('hua:')) {
        const m = optsStr.match(/hua:\s*(\d+)/);
        if (m) opts.huaCount = parseInt(m[1]);
    }
    if (optsStr.includes('quanfeng:')) {
        const m = optsStr.match(/quanfeng:\s*(\d+)/);
        if (m) opts.quanfeng = parseInt(m[1]);
    }
    if (optsStr.includes('menfeng:')) {
        const m = optsStr.match(/menfeng:\s*(\d+)/);
        if (m) opts.menfeng = parseInt(m[1]);
    }
    return JSON.stringify(opts);
}

let testFile = `import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions, CalcResult } from './types';
import { calculateBestScore } from './fan';

function parseHand(handStr: string, opts: Partial<GameOptions> = {}): { concealed: Tile[], melds: Meld[], options: GameOptions } {
  const concealed: Tile[] = [];
  const melds: Meld[] = [];
  
  const tokens = handStr.trim().split(/\\s+/);
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
  
  expect(result, \`Hand failed to Hu: \${handStr}\`).not.toBeNull();
  const names = result!.fans.map((f: any) => f.name);
  for (const expected of expectedFanNames) {
    expect(names, \`Missing fan: \${expected} in [\${names.join(', ')}] for hand: \${handStr}\`).toContain(expected);
  }
}

describe('Guobiao Benchmarks - Automated From XDean Samples', () => {
`;

samples.forEach((s, i) => {
    testFile += `  test('Sample ${i+1}: ${s.name}', () => {\n`;
    testFile += `    expectFans('${translateHand(s.hand)}', ['${s.name}'], ${translateOpts(s.opts)});\n`;
    testFile += `  });\n\n`;
});

testFile += `});\n\ndescribe('Guobiao Benchmarks - Special Scoring Rules', () => {\n`;

rules.forEach((r, i) => {
    const translatedFans = r.fans.map(f => mapping[f] || (f === 'Hua' ? '花牌' : f));
    testFile += `  test('Rule ${i+1}', () => {\n`;
    testFile += `    expectFans('${translateHand(r.hand)}', ${JSON.stringify(translatedFans)}, ${translateOpts(r.opts)});\n`;
    testFile += `  });\n\n`;
});

testFile += `});\n`;

fs.writeFileSync('benchmark.test.ts', testFile);
console.log("Benchmark test file generated.");
