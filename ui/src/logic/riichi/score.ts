import { Tile } from '../guobiao/tiles'
import { Meld, HandCombination, GameOptions, CalcResult, YakuResult } from './types'
import { findAllCombinations } from './hu'
import { calculateFu } from './fu'
import { detectYaku } from './yaku'

export function calculateScore(
  han: number,
  fu: number,
  isDealer: boolean
): { ron: number; tsumoDealer: number; tsumoNonDealer: number } {
  if (han >= 13) {
    const yakumanCount = Math.floor(han / 13)
    const base = 8000 * yakumanCount
    return dealerCalc(base, isDealer)
  }
  if (han >= 11) {
    const base = 6000 // Sanbaiman
    return dealerCalc(base, isDealer)
  }
  if (han >= 8) {
    const base = 4000 // Baiman
    return dealerCalc(base, isDealer)
  }
  if (han >= 6) {
    const base = 3000 // Haneman
    return dealerCalc(base, isDealer)
  }
  if (han >= 5) {
    const base = 2000 // Mangan
    return dealerCalc(base, isDealer)
  }

  // Normal calculation
  const base = Math.min(fu * Math.pow(2, 2 + han), 2000)
  if (base >= 2000) {
    return dealerCalc(2000, isDealer) // Mangan
  }
  return dealerCalc(base, isDealer)
}

function dealerCalc(base: number, isDealer: boolean): { ron: number; tsumoDealer: number; tsumoNonDealer: number } {
  const r100 = (v: number) => Math.ceil(v / 100) * 100
  if (isDealer) {
    const ron = r100(base * 6)
    const tsumo = r100(base * 2)
    return { ron, tsumoDealer: tsumo, tsumoNonDealer: tsumo }
  }
  const ron = r100(base * 4)
  const tsumoDealer = r100(base * 2)
  const tsumoNonDealer = r100(base)
  return { ron, tsumoDealer, tsumoNonDealer }
}

export function calculateHand(
  concealedTiles: Tile[],
  exposedMelds: Meld[],
  winTile: Tile,
  options: GameOptions
): CalcResult | null {
  // Win tile is added to concealed for decomposition
  const fullConcealed = [...concealedTiles, winTile]
  const allTiles = [...fullConcealed, ...exposedMelds.flatMap((m) => m.tiles)]
  const combinations = findAllCombinations(fullConcealed, exposedMelds)

  if (combinations.length === 0) return null

  let bestResult: CalcResult | null = null

  for (const combo of combinations) {
    const yakuList = detectYaku(combo, allTiles, winTile, options)
    if (yakuList.length === 0) continue

    const isYakuman = yakuList.some((y) => y.isYakuman)
    const yakumanCount = yakuList.filter((y) => y.isYakuman).length

    let han: number
    let fu: number
    let fuDetails: { reason: string; fu: number }[] = []

    if (isYakuman) {
      han = yakumanCount * 13
      fu = 0
      fuDetails = []
    } else {
      han = yakuList.reduce((sum, y) => sum + y.han, 0)
      const fuResult = calculateFu(combo, winTile, options)
      fu = fuResult.fu
      fuDetails = fuResult.details
    }

    const isDealer = options.jikaze === 1
    const score = calculateScore(han, fu, isDealer)
    const basePoints = isYakuman ? 8000 * yakumanCount : Math.min(fu * Math.pow(2, 2 + han), 2000)

    const result: CalcResult = {
      han,
      fu,
      yakuList,
      fuDetails,
      basePoints,
      isYakuman,
      yakumanCount,
      score,
    }

    if (!bestResult || comparResults(result, bestResult) > 0) {
      bestResult = result
    }
  }

  return bestResult
}

function comparResults(a: CalcResult, b: CalcResult): number {
  // Prefer higher score
  if (a.score.ron !== b.score.ron) return a.score.ron - b.score.ron
  // If same score, prefer more han
  if (a.han !== b.han) return a.han - b.han
  // If same han, prefer lower fu (shows more yaku)
  return b.fu - a.fu
}
