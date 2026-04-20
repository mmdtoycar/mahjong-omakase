import { TileSuit, Tile } from '../frontend/src/logic/guobiao/tiles';
import { Meld, GameOptions } from '../frontend/src/logic/guobiao/types';
import { calculateBestScore, scoreCombination } from '../frontend/src/logic/guobiao/fan';
import { findAllCombinations } from '../frontend/src/logic/guobiao/hu';

function parseHand(handStr: string, opts: Partial<GameOptions> = {}) {
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

const { concealed, melds, options } = parseHand('p1 p1 p2 p2 p3 p3 p4 p4 p5 p5 p6 p6 p8 p8', {"zimo":true});
const lastTile = concealed.length > 0 ? concealed[concealed.length - 1] : undefined;

const combs = findAllCombinations(concealed, melds);
combs.forEach((c, i) => {
    console.log(`Combo ${i}:`, c.melds.map(m => m.type));
    const scored = scoreCombination(c, concealed, options, lastTile);
    console.log(`  Score: ${scored.totalScore}`);
    console.log(`  Fans: ${scored.fans.map(f => f.name).join(', ')}`);
});
