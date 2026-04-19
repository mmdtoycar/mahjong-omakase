import { Tile } from './tiles';

/**
 * Meld (面子) Definitions
 */
export type MeldType = 'shun' | 'ke' | 'gang' | 'dui' | 'single' | 'knitted';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  isOpen: boolean;
  isGang?: boolean; // Distinguishes gang from ke in internal combos
}

/**
 * Hand Combination (胡牌组合)
 */
export interface HandCombination {
  melds: Meld[];
  isSpecial?: boolean;
  isBuKao?: boolean;     // 全不靠 hand
  isZuHeLong?: boolean;  // 组合龙 hand
}

/**
 * Game Context/Options
 */
export interface GameOptions {
  zimo: boolean;
  lastTile: boolean;
  gangShang: boolean;
  juezhang: boolean;
  quanfeng: number;
  menfeng: number;
  huaCount: number;
}

/**
 * Fans (番种) Scored
 */
export interface FanResult {
  name: string;
  nameEn?: string;
  score: number;
  count?: number;
}

/**
 * Final Calculation Result
 */
export interface CalcResult {
  totalScore: number;
  fans: FanResult[];
  combination: HandCombination;
}

// --- Utility Functions ---

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a.compareTo(b));
}

export function countTiles(tiles: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  tiles.forEach(t => {
    const key = t.toString();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

export function tileCount(tiles: Tile[], target: Tile): number {
  return tiles.filter(t => t.equals(target)).length;
}

export function removeTilesOnce(all: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...all];
  for (const r of toRemove) {
    const idx = result.findIndex(t => t.equals(r));
    if (idx !== -1) result.splice(idx, 1);
  }
  return result;
}
