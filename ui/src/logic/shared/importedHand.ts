import { Tile } from './tiles'
import { Meld as GuobiaoMeld } from '../guobiao/types'
import { Meld as RiichiMeld } from '../riichi/types'

/** A meld straight out of photo recognition — `type` is whatever label the model produced. */
export interface RecognizedMeld {
  type: string
  tiles: Tile[]
  isOpen: boolean
}

/**
 * A hand handed down to a calculator. `trigger` is a counter the calculator compares
 * against, so re-importing an identical hand still applies.
 */
export interface ImportedHand<M> {
  concealed: Tile[]
  melds: M[]
  trigger: number
}

type MeldKind = 'shun' | 'ke' | 'gang'

/**
 * Decides the meld kind from its tiles, using the model's label only as a tiebreak.
 *
 * The label is free-form ("ankou", "koutsu", "minko", "toitsu", …), so trusting it alone
 * silently turns triplets into sequences and mis-scores the hand. The tiles are unambiguous:
 * four tiles is a gang, three identical is a ke.
 */
function meldKind(rawType: string, tiles: Tile[]): MeldKind {
  if (tiles.length >= 4) return 'gang'
  if (tiles.length === 3 && tiles.every((t) => t.equals(tiles[0]))) return 'ke'

  const lower = rawType.toLowerCase()
  if (lower.includes('ke') || lower.includes('ko') || lower.includes('pon') || lower.includes('peng')) return 'ke'
  if (lower.includes('gang') || lower.includes('kan')) return 'gang'
  return 'shun'
}

export function toGuobiaoMelds(melds: RecognizedMeld[]): GuobiaoMeld[] {
  return melds.map((m) => ({ type: meldKind(m.type, m.tiles), tiles: m.tiles, isOpen: m.isOpen }))
}

const RIICHI_MELD_TYPE = { shun: 'shunzi', ke: 'kezi', gang: 'gangzi' } as const

export function toRiichiMelds(melds: RecognizedMeld[]): RiichiMeld[] {
  return melds.map((m) => ({
    type: RIICHI_MELD_TYPE[meldKind(m.type, m.tiles)],
    tiles: m.tiles,
    isOpen: m.isOpen,
  }))
}
