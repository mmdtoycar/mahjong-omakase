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
