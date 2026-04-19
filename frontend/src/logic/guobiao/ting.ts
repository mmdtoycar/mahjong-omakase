import { Tile } from './tiles';
import { Meld, GameOptions } from './types';
import { calculateBestScore } from './fan';

/**
 * Ting Prediction Logic
 */

export function checkTing(concealedTiles: Tile[], melds: Meld[], options: GameOptions) {
  const tings: { tile: Tile; score: number }[] = [];
  const allPossible = Tile.all;

  allPossible.forEach(testTile => {
    const hand = [...concealedTiles, testTile];
    if (hand.length === 14) {
      const best = calculateBestScore(hand, melds, options);
      if (best && best.totalScore >= 8) {
        tings.push({ tile: testTile, score: best.totalScore });
      }
    }
  });

  return tings;
}
