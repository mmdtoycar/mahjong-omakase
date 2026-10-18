import { describe, it, expect } from 'vitest'
import { Tile } from '../tiles'
import { toRiichiMelds } from '../importedHand'

const t = (s: string) => Tile.fromString(s)

describe('toRiichiMelds', () => {
  it('puts a called sequence in order, whichever tile was called', () => {
    const [meld] = toRiichiMelds([{ type: 'chi', tiles: [t('4s'), t('2s'), t('3s')], isOpen: true }])
    expect(meld.type).toBe('shunzi')
    expect(meld.tiles.map(String)).toEqual(['2s', '3s', '4s'])
  })

  it('leaves triplets and kans as they are', () => {
    const melds = toRiichiMelds([
      { type: 'pon', tiles: [t('5z'), t('5z'), t('5z')], isOpen: true },
      { type: 'kan', tiles: [t('1m'), t('1m'), t('1m'), t('1m')], isOpen: false },
    ])
    expect(melds.map((m) => m.type)).toEqual(['kezi', 'gangzi'])
  })
})
