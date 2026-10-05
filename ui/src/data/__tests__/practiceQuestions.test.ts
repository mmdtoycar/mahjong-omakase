import { describe, it, expect } from 'vitest'
import { PRACTICE_QUESTIONS } from '../practiceQuestions'
import { Tile } from '../../logic/shared/tiles'
import { analyzeAllDiscards } from '../../logic/efficiency/ukeire'
import { analyzeHandStructure } from '../../logic/efficiency/blockAnalyzer'

function parseTiles(str: string): Tile[] {
  return str
    .trim()
    .split(/\s+/)
    .map((s) => Tile.fromString(s))
}

describe('PRACTICE_QUESTIONS verification', () => {
  it('validates all 25+ curated questions', () => {
    expect(PRACTICE_QUESTIONS.length).toBeGreaterThanOrEqual(20)

    for (const q of PRACTICE_QUESTIONS) {
      const tiles = parseTiles(q.hand)
      expect(tiles.length, `Question ${q.id} must have exactly 14 tiles`).toBe(14)

      // Verify that optimal discards exist in hand
      for (const d of q.optimalDiscards) {
        const found = tiles.some((t) => t.toString() === d)
        expect(found, `Optimal discard ${d} must be in hand for question ${q.id}`).toBe(true)
      }

      // Verify that ukeire analysis runs smoothly
      const analyses = analyzeAllDiscards(tiles)
      expect(analyses.length).toBeGreaterThan(0)

      // Verify block analyzer runs smoothly
      const blocks = analyzeHandStructure(tiles)
      expect(blocks.blocks.length).toBeGreaterThan(0)
    }
  })
})
