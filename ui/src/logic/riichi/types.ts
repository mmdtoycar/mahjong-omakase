import { Tile } from '../guobiao/tiles'
export { sortTiles, countTiles, removeTilesOnce } from '../shared/tileUtils'

export type MeldType = 'shuntsu' | 'koutsu' | 'kantsu' | 'jantai'

export interface Meld {
  type: MeldType
  tiles: Tile[]
  isOpen: boolean
}

export interface HandCombination {
  melds: Meld[] // 4 melds + 1 jantai, or 7 pairs
  isChiitoitsu?: boolean
  isKokushi?: boolean
}

export interface WaitType {
  type: 'ryanmen' | 'shanpon' | 'kanchan' | 'penchan' | 'tanki'
}

export interface GameOptions {
  isTsumo: boolean
  bakaze: number // round wind: 1=east, 2=south, 3=west, 4=north
  jikaze: number // seat wind
  isRiichi: boolean
  isDoubleRiichi: boolean
  isIppatsu: boolean
  isChankan: boolean // robbing a kong
  isRinshan: boolean // after a kong
  isHaitei: boolean // last tile draw/discard
  isTenhou: boolean // dealer first draw
  isChiihou: boolean // non-dealer first draw
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
  basePoints: number
  isYakuman: boolean
  yakumanCount: number
  score: {
    ron: number
    tsumoDealer: number
    tsumoNonDealer: number
  }
}
