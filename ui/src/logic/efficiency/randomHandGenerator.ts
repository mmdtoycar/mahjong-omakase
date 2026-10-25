import { Tile } from '../shared/tiles'
import { calculateShanten } from './shanten'

/**
 * Creates a standard full 136-tile Mahjong deck.
 */
export function createDeck(): Tile[] {
  const deck: Tile[] = []
  for (const t of Tile.all) {
    for (let i = 0; i < 4; i++) {
      deck.push(new Tile(t.suit, t.rank))
    }
  }
  return deck
}

/**
 * Shuffles an array in place with Fisher-Yates.
 */
export function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

/**
 * Generates an instructive 14-tile practice hand.
 * Filters for shanten in desired range (default 1-shanten or 2-shanten).
 */
export function generateRandomPracticeHand(targetMaxShanten: number = 2): Tile[] {
  let attempts = 0
  const maxAttempts = 150

  while (attempts < maxAttempts) {
    attempts++
    const deck = shuffle(createDeck())
    const candidate14 = deck.slice(0, 14)
    const shanten = calculateShanten(candidate14)

    // Hands with shanten 1 or 2 are ideal for discard training
    if (shanten <= targetMaxShanten && shanten >= 0) {
      return candidate14
    }
  }

  // Fallback: return any 14 tiles
  const deck = shuffle(createDeck())
  return deck.slice(0, 14)
}
