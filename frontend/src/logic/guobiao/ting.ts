import { calculateBestScore } from './fan';
import { GameOptions, Meld, FanResult } from './types';

export function checkTing(concealedTiles: Tile[], melds: Meld[], options: GameOptions) {
  const tings: { tile: Tile; score: number; fans: FanResult[] }[] = [];
  const allPossible = Tile.All;

  allPossible.forEach(testTile => {
    if (concealedTiles.length + melds.length * 3 !== 13) return;
    
    // Check if testTile is even possible (at most 4 of each)
    const countInHand = concealedTiles.filter(t => t.equals(testTile)).length + 
                       melds.reduce((acc, m) => acc + m.tiles.filter(t => t.equals(testTile)).length, 0) + 1;
    if (countInHand > 4) return;

    const best = calculateBestScore(concealedTiles.concat(testTile), melds, options, testTile);
    if (best) {
      tings.push({ 
        tile: testTile, 
        score: best.totalScore,
        fans: best.fans
      });
    }
  });

  return tings;
}

import {Tiles} from './types';
import {Tile} from './tiles';
import {findAllCombinations} from './hu';

// Simple assert replacement
function assert(condition: any, message?: string) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export function calcTing(tiles: Tiles): Tile[] {
  assert(tiles.length < 14 && (tiles.length % 3) === 1, '听牌必须少于14张且余一张');
  return Tile.All.filter(t => {
    if (tiles.count(t) >= 4)
      return false;
    const complete = tiles.withTile(t);
    return findAllCombinations(complete).length > 0;
  });
}
