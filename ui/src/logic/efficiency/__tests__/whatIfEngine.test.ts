import { describe, it, expect } from 'vitest'
import { Tile } from '../../shared/tiles'
import { simulateDraw, getWhatIfScenarios } from '../whatIfEngine'
import { analyzeAllDiscards } from '../ukeire'

describe('whatIfEngine', () => {
  it('correctly simulates draw that advances shanten to tenpai', () => {
    // 1-shanten hand: 123m 45p 78s 22s 4m 9p 5s with 1z discarded
    const handTiles = [
      Tile.fromString('1m'),
      Tile.fromString('2m'),
      Tile.fromString('3m'),
      Tile.fromString('4p'),
      Tile.fromString('5p'),
      Tile.fromString('7s'),
      Tile.fromString('8s'),
      Tile.fromString('2s'),
      Tile.fromString('2s'),
      Tile.fromString('4m'),
      Tile.fromString('1z'),
      Tile.fromString('9p'),
      Tile.fromString('5s'),
      Tile.fromString('3z'),
    ]

    const discard = Tile.fromString('1z')
    const draw = Tile.fromString('3m') // forming 34m with 4m

    const result = simulateDraw(handTiles, discard, draw, '摸入 3m', 'optimal')

    expect(result.drawTile.toString()).toBe('3m')
    expect(result.tag).toBe('optimal')
    expect(result.newHandTiles.length).toBe(14)
    expect(result.newHandTiles[result.newHandTiles.length - 1].equals(draw)).toBe(true)
    expect(result.newHandTiles.some((t) => t.equals(discard))).toBe(false)
  })

  it('generates dynamic what-if scenarios when question has no curated scenarios', () => {
    const handTiles = [
      Tile.fromString('1m'),
      Tile.fromString('2m'),
      Tile.fromString('3m'),
      Tile.fromString('4p'),
      Tile.fromString('5p'),
      Tile.fromString('7s'),
      Tile.fromString('8s'),
      Tile.fromString('2s'),
      Tile.fromString('2s'),
      Tile.fromString('4m'),
      Tile.fromString('1z'),
      Tile.fromString('9p'),
      Tile.fromString('5s'),
      Tile.fromString('3z'),
    ]

    const analyses = analyzeAllDiscards(handTiles)
    const bestDiscard = Tile.fromString('1z')

    const scenarios = getWhatIfScenarios(handTiles, bestDiscard, analyses)

    expect(scenarios.length).toBeGreaterThanOrEqual(1)
    expect(scenarios.length).toBeLessThanOrEqual(3)
    expect(scenarios[0].drawTile).toBeDefined()
    expect(scenarios[0].outcomeText).toBeDefined()
  })
})
