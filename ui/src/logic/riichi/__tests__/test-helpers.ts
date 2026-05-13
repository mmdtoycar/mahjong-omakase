import { Tile } from '../../shared/tiles'
import { GameOptions } from '../types'

export function tiles(s: string): Tile[] {
  const result: Tile[] = []
  let nums: number[] = []
  for (const ch of s) {
    if ('0123456789'.includes(ch)) {
      nums.push(parseInt(ch))
    } else if ('mpsz'.includes(ch)) {
      for (const n of nums) result.push(new Tile(ch as any, n))
      nums = []
    }
  }
  return result
}

export function defaultOptions(overrides: Partial<GameOptions> = {}): GameOptions {
  return {
    isTsumo: false,
    changfeng: 1,
    zifeng: 2,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isChankan: false,
    isRinshan: false,
    isHaitei: false,
    isTenhou: false,
    isChiihou: false,
    doraCount: 0,
    ...overrides,
  }
}
