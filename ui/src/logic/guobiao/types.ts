import { Tile } from './tiles'
export { sortTiles, countTiles, tileCount, removeTilesOnce } from '../shared/tileUtils'

/**
 * Meld (面子) Definitions
 */
export type MeldType = 'shun' | 'ke' | 'gang' | 'dui' | 'single' | 'knitted' | 'zuhelong'

export interface Meld {
  type: MeldType
  tiles: Tile[]
  isOpen: boolean
  isGang?: boolean // Distinguishes gang from ke in internal combos
}

/**
 * Hand Combination (胡牌组合)
 */
export interface HandCombination {
  melds: Meld[]
  isSpecial?: boolean
  isBuKao?: boolean // 全不靠 hand
  isZuHeLong?: boolean // 组合龙 hand
}

/**
 * Game Context/Options
 */
export interface GameOptions {
  isSelfDraw: boolean
  lastTile: boolean
  gangShang: boolean
  juezhang: boolean
  quanfeng: number
  menfeng: number
  huaCount: number
  showTingFans: boolean
}

/**
 * Fans (番种) Scored
 */
export interface FanResult {
  name: string
  nameEn?: string
  score: number
  count?: number
}

/**
 * Final Calculation Result
 */
export interface CalcResult {
  totalScore: number
  fans: FanResult[]
  combination: HandCombination
}

// --- Utility Functions re-exported from shared ---
