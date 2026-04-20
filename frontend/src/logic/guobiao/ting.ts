import { Tile } from './tiles';
import { Meld, GameOptions, FanResult } from './types';
import { calculateBestScore } from './fan';

/**
 * Ting Prediction Logic
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

    // Validation Check (based on user request)
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
