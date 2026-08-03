import { SessionDetail, GameModeKey, RoundInfo } from '../types'

const WIND_NAMES = ['东', '南', '西', '北']

export interface GameState {
  dealerSeat: number
  dealerPlayerId: number
  prevalentWind: number // 1=东, 2=南, 3=西, 4=北
  handNumber: number // 1-based within current wind
  honba: number // consecutive dealer continuations
  kyoutaku: number // accumulated riichi sticks (in points)
  displayName: string // e.g. "东1" or "第3/4局"
  playerCount: number
}

function getPlayersBySeat(session: SessionDetail) {
  return [...session.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
}

function dealerStaysAfterRound(gameMode: GameModeKey, round: RoundInfo, dealerPlayerId: number): boolean {
  if (round.winnerId === dealerPlayerId) return true
  if (round.winnerId == null) {
    if (gameMode === 'DONGBEI') return true
    if (gameMode === 'RIICHI') {
      // 庄家听牌才连庄, 未听则流庄
      if (round.tenpaiPlayerIds) return round.tenpaiPlayerIds.includes(dealerPlayerId)
      // Legacy rounds have no tenpai list: fall back to the point delta (全员未听 reads as 连庄)
      return (round.scores[dealerPlayerId] ?? 0) >= 0
    }
  }
  return false
}

function totalBaseRounds(gameMode: GameModeKey, playerCount: number): number {
  if (gameMode === 'GUOBIAO') return playerCount
  if (gameMode === 'DONGBEI') return playerCount
  return playerCount * 2 // Riichi 半庄: 2 winds
}

export function deriveGameState(session: SessionDetail): GameState {
  const playersBySeat = getPlayersBySeat(session)
  const playerCount = playersBySeat.length

  if (session.gameMode === 'GUOBIAO') {
    const nextRound = session.rounds.length + 1
    const total = totalBaseRounds('GUOBIAO', playerCount)
    const seatIndex = (nextRound - 1) % playerCount
    const dealer = playersBySeat[seatIndex]
    return {
      dealerSeat: dealer.seat ?? seatIndex + 1,
      dealerPlayerId: dealer.id,
      prevalentWind: 1,
      handNumber: nextRound,
      honba: 0,
      kyoutaku: 0,
      displayName: `第${nextRound}/${total}局`,
      playerCount,
    }
  }

  let seatIndex = 0
  let prevalentWind = 1
  let handNumber = 1
  let honba = 0
  let kyoutaku = 0

  for (const round of session.rounds) {
    const riichiCount = round.riichiPlayerIds?.length ?? 0
    kyoutaku += riichiCount * 1000

    if (round.winnerId != null) {
      kyoutaku = 0
    }

    const dealer = playersBySeat[seatIndex]
    const dealerStays = dealerStaysAfterRound(session.gameMode, round, dealer.id)
    if (!dealerStays) {
      seatIndex = (seatIndex + 1) % playerCount
      handNumber++
      if (handNumber > playerCount) {
        handNumber = 1
        prevalentWind++
      }
    }
    // 流局必定加一本场, 即使流庄
    honba = dealerStays || round.winnerId == null ? honba + 1 : 0
  }

  const dealer = playersBySeat[seatIndex]
  const windHand = `${WIND_NAMES[(prevalentWind - 1) % 4]}${handNumber}`
  return {
    dealerSeat: dealer.seat ?? seatIndex + 1,
    dealerPlayerId: dealer.id,
    prevalentWind,
    handNumber,
    honba,
    kyoutaku,
    displayName: honba > 0 ? `${windHand}(${honba})` : windHand,
    playerCount,
  }
}

export function deriveRoundState(session: SessionDetail, upToRound: number): GameState {
  const trimmed = { ...session, rounds: session.rounds.slice(0, upToRound - 1) }
  return deriveGameState(trimmed)
}

export function getWindName(w: number): string {
  return WIND_NAMES[(w - 1) % 4]
}
