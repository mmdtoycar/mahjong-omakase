import { Tile } from './tiles';
import { Meld, GameOptions, FanResult, Tiles } from './types';
import { calculateBestScore } from './fan';
import { findAllCombinationsMain } from './hu';

// Simple assert replacement
function assert(condition: any, message?: string) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

/**
 * Ting Prediction Logic - Clean-room implementation (HEAD)
 */

export function checkTing(concealedTiles: Tile[], melds: Meld[], options: GameOptions) {
  const tings: { tile: Tile; score: number; fans: FanResult[] }[] = [];
  const allPossible = Tile.all;

  const counts = new Map<string, number>();
  concealedTiles.forEach(t => counts.set(t.toString(), (counts.get(t.toString()) || 0) + 1));
  melds.forEach(m => m.tiles.forEach(t => counts.set(t.toString(), (counts.get(t.toString()) || 0) + 1)));

  allPossible.forEach(testTile => {
    const existingCount = counts.get(testTile.toString()) || 0;
    if (existingCount >= 4) return;

    // Validation Check
    if (options.juezhang && existingCount > 0) return;
    if (options.gangShang && !options.zimo && existingCount > 0) return;

    const totalCount = concealedTiles.length + 1 + melds.length * 3;
    if (totalCount === 14) {
      const hand = [...concealedTiles, testTile];
      const best = calculateBestScore(hand, melds, options, testTile);
      if (best) {
        tings.push({ 
          tile: testTile, 
          score: best.totalScore,
          fans: best.fans
        });
      }
    }
  });

  return tings;
}

/**
 * Ting Prediction Logic - XDean Logic (main)
 */

export function calcTing(tiles: Tiles): Tile[] {
  assert(tiles.length < 14 && (tiles.length % 3) === 1, '听牌必须少于14张且余一张');
  return Tile.All.filter(t => {
    if (tiles.count(t) >= 4) return false;
    const complete = tiles.withTile(t);
    return findAllCombinationsMain(complete).length > 0;
  });
}
