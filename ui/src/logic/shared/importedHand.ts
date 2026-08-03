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

/** Maps the model's free-form meld label ("pon", "kezi", "kan", …) onto our three kinds. */
function meldKind(rawType: string): MeldKind {
  const lower = rawType.toLowerCase()
  if (lower.includes('ke') || lower.includes('pon') || lower.includes('peng')) return 'ke'
  if (lower.includes('gang') || lower.includes('kan')) return 'gang'
  return 'shun'
}

export function toGuobiaoMelds(melds: RecognizedMeld[]): GuobiaoMeld[] {
  return melds.map((m) => ({ type: meldKind(m.type), tiles: m.tiles, isOpen: m.isOpen }))
}

const RIICHI_MELD_TYPE = { shun: 'shunzi', ke: 'kezi', gang: 'gangzi' } as const

export function toRiichiMelds(melds: RecognizedMeld[]): RiichiMeld[] {
  return melds.map((m) => ({
    type: RIICHI_MELD_TYPE[meldKind(m.type)],
    tiles: m.tiles,
    isOpen: m.isOpen,
  }))
}
