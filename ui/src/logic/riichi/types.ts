import { Tile } from '../shared/tiles'
export { sortTiles, countTiles, removeTilesOnce } from '../shared/tileUtils'

export type MeldType = 'shunzi' | 'kezi' | 'gangzi' | 'duizi'

export interface Meld {
  type: MeldType
  tiles: Tile[]
  isOpen: boolean
  completedByWin?: boolean
}

export interface HandCombination {
  melds: Meld[] // 4 melds + 1 duizi, or 7 pairs
  isChiitoitsu?: boolean
  isKokushi?: boolean
}

export interface WaitType {
  type: 'liangmian' | 'duipeng' | 'kanzhang' | 'bianzhang' | 'danqi'
}

export interface GameOptions {
  isTsumo: boolean
  changfeng: number // round wind: 1=east, 2=south, 3=west, 4=north
  zifeng: number // seat wind
  isRiichi: boolean
  isDoubleRiichi: boolean
  isYifa: boolean
  isQianggang: boolean // robbing a kong
  isLingshang: boolean // after a kong
  isHaidi: boolean // last tile draw/discard
  isTianhu: boolean // dealer first draw
  isDihu: boolean // non-dealer first draw
  doraCount: number
}

export interface YakuResult {
  name: string
  han: number
  isYakuman?: boolean
}

export interface FuDetail {
  reason: string
  fu: number
}

export interface CalcResult {
  han: number
  fu: number
  yakuList: YakuResult[]
  fuDetails: FuDetail[]
  isYakuman: boolean
  yakumanCount: number
  score: {
    ron: number
    tsumoDealer: number
    tsumoNonDealer: number
  }
}
