import { describe, it, expect } from 'vitest'
import { fanLabel } from '../format'

describe('fanLabel', () => {
  it('shows 役满 for a Riichi yakuman', () => {
    expect(fanLabel('RIICHI', 13, '小四喜(13)')).toBe('役满')
  })

  it('shows the han count for any other Riichi hand', () => {
    expect(fanLabel('RIICHI', 15, '清一色(6), 平和(1), 宝牌(8)')).toBe('15 番')
  })

  it('leaves other modes alone', () => {
    expect(fanLabel('GUOBIAO', 88, '大四喜(88)')).toBe('88 番')
  })
})
