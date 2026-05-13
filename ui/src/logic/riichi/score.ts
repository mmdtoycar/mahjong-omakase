import { Tile } from '../shared/tiles'
import { Meld, HandCombination, GameOptions, CalcResult } from './types'
import { findAllCombinations } from './hu'
import { calculateFu } from './fu'
import { detectYaku } from './yaku'

const MANGAN = 2000
const HANEMAN = 3000
const BAIMAN = 4000
const SANBAIMAN = 6000
const YAKUMAN = 8000

function getBasePoints(han: number, fu: number, yakumanCount: number): number {
  if (yakumanCount > 0) return YAKUMAN * yakumanCount
  if (han >= 13) return YAKUMAN
  if (han >= 11) return SANBAIMAN
  if (han >= 8) return BAIMAN
  if (han >= 6) return HANEMAN
  if (han >= 5) return MANGAN
  if (han === 4 && fu >= 30) return MANGAN
  if (han === 3 && fu >= 60) return MANGAN
  return Math.min(fu * Math.pow(2, 2 + han), MANGAN)
}

function roundUp100(v: number): number {
  return Math.ceil(v / 100) * 100
}

export function calculateScore(
  han: number,
  fu: number,
  isDealer: boolean,
  yakumanCount = 0
): { ron: number; tsumoDealer: number; tsumoNonDealer: number } {
  const base = getBasePoints(han, fu, yakumanCount)
  if (isDealer) {
    const ron = roundUp100(base * 6)
    const tsumo = roundUp100(base * 2)
    return { ron, tsumoDealer: tsumo, tsumoNonDealer: tsumo }
  }
  const ron = roundUp100(base * 4)
  const tsumoDealer = roundUp100(base * 2)
  const tsumoNonDealer = roundUp100(base)
  return { ron, tsumoDealer, tsumoNonDealer }
}

export function calculateHand(
  concealedTiles: Tile[],
  exposedMelds: Meld[],
  winTile: Tile,
  options: GameOptions
): CalcResult | null {
  const fullConcealed = [...concealedTiles, winTile]
  const allTiles = [...fullConcealed, ...exposedMelds.flatMap((m) => m.tiles)]
  const combinations = findAllCombinations(fullConcealed, exposedMelds)

  if (combinations.length === 0) return null

  let bestResult: CalcResult | null = null

  for (const combo of combinations) {
    const tries = generateTries(combo, winTile)

    for (const trial of tries) {
      const yakuList = detectYaku(trial, allTiles, winTile, options)
      if (!yakuList.some((y) => y.name !== '宝牌')) continue

      const isYakuman = yakuList.some((y) => y.isYakuman)
      const yakumanCount = yakuList.filter((y) => y.isYakuman).length

      let han: number
      let fu: number
      let fuDetails: { reason: string; fu: number }[] = []

      if (isYakuman) {
        han = yakumanCount * 13
        fu = 0
      } else {
        han = yakuList.reduce((sum, y) => sum + y.han, 0)
        const fuResult = calculateFu(trial, winTile, options)
        fu = fuResult.fu
        fuDetails = fuResult.details
      }

      const isDealer = options.zifeng === 1
      const score = calculateScore(han, fu, isDealer, isYakuman ? yakumanCount : 0)

      const result: CalcResult = { han, fu, yakuList, fuDetails, isYakuman, yakumanCount, score }

      if (!bestResult || compareResults(result, bestResult) > 0) {
        bestResult = result
      }
    }
  }

  return bestResult
}

function generateTries(combo: HandCombination, winTile: Tile): HandCombination[] {
  if (combo.isKokushi || combo.isChiitoitsu) return [combo]

  const matchingIndices: number[] = []
  combo.melds.forEach((m, idx) => {
    if (!m.isOpen && m.tiles.some((t) => t.equals(winTile))) {
      matchingIndices.push(idx)
    }
  })

  if (matchingIndices.length <= 1) {
    if (matchingIndices.length === 1) {
      const melds = combo.melds.map((m, i) => (i === matchingIndices[0] ? { ...m, completedByWin: true } : m))
      return [{ ...combo, melds }]
    }
    return [combo]
  }

  return matchingIndices.map((idx) => {
    const melds = combo.melds.map((m, i) => (i === idx ? { ...m, completedByWin: true } : m))
    return { ...combo, melds }
  })
}

function compareResults(a: CalcResult, b: CalcResult): number {
  if (a.score.ron !== b.score.ron) return a.score.ron - b.score.ron
  if (a.han !== b.han) return a.han - b.han
  return b.fu - a.fu
}
