export interface Player {
  id: number
  userName: string
  firstName: string
  lastName: string
  createdAt: string
}

export type GameModeKey = 'DONGBEI' | 'RIICHI' | 'GUOBIAO'

export const GAME_MODES: { key: GameModeKey; label: string }[] = [
  { key: 'GUOBIAO', label: '国标麻将' },
  { key: 'DONGBEI', label: '东北麻将' },
  { key: 'RIICHI', label: '立直麻将' },
]

export interface GameSession {
  id: number
  name: string
  gameMode: GameModeKey
  gameModeDisplayName: string
  playerCount: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  createdAt: string
}

export interface PlayerInfo {
  id: number
  userName: string
  firstName: string
  lastName: string
  displayName: string
  seat: number
}

export interface RoundInfo {
  roundNumber: number
  scores: Record<number, number>
  winnerId?: number
  winHand?: string
  fanDetails?: string
  fanCount?: number
  dealInPlayerId?: number | null
  dealInPlayerName?: string | null
  prevalentWind?: number
}

export interface SessionDetail {
  id: number
  name: string
  gameMode: GameModeKey
  gameModeDisplayName: string
  playerCount: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  createdAt: string
  players: PlayerInfo[]
  rounds: RoundInfo[]
  totalScores: Record<number, number>
  rpFactor: number
  rpOrigin: number
  umaDist: number[]
}

export interface AddRoundData {
  roundType?: 'WIN' | 'DRAWN_GAME' // default WIN
  winnerId?: number
  score?: number // for Guobiao
  fan?: number // for Riichi / Dongbei (番)
  fu?: number // for Riichi
  dealerId?: number // for Riichi/Dongbei: table dealer
  honba?: number // for Riichi: 本場 count
  kyoutaku?: number // for Riichi: 供托 points
  bimenPlayerIds?: number[] // for Dongbei: 闭门 players
  dealInPlayerId?: number | null // null = 自摸
  tenpaiPlayerIds?: number[] // for drawn games
  winHand?: string
  fanDetails?: string
  fanCount?: number
  prevalentWind?: number
}

export const FAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
export const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]

export interface PlayerStats {
  playerId: number
  userName: string
  displayName: string
  gamesPlayed: number
  totalScore: number
  totalRP: number
  baseRP: number
  avgScore: number
  wins: number
}

export interface Season {
  year: number
  month: number
  label: string
}

const MONTH_NAMES: Record<number, string> = {
  1: '1月',
  2: '2月',
  3: '3月',
  4: '4月',
  5: '5月',
  6: '6月',
  7: '7月',
  8: '8月',
  9: '9月',
  10: '10月',
  11: '11月',
  12: '12月',
}

export function getCurrentSeason(): Season {
  const now = new Date()
  const month = now.getMonth() + 1
  return { year: now.getFullYear(), month, label: `${now.getFullYear()} ${MONTH_NAMES[month]}` }
}

export function getAvailableSeasons(startYear: number = 2026): Season[] {
  const seasons: Season[] = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  for (let y = currentYear; y >= startYear; y--) {
    const maxM = y === currentYear ? currentMonth : 12
    for (let m = maxM; m >= 1; m--) {
      seasons.push({ year: y, month: m, label: `${y} ${MONTH_NAMES[m]}` })
    }
  }
  return seasons
}

export interface PlayerGameEntry {
  sessionId: number
  sessionName: string
  gameMode: GameModeKey
  gameModeDisplayName: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  createdAt: string
  totalScore: number
}

export interface PlayerDetail {
  playerId: number
  userName: string
  firstName: string
  lastName: string
  games: PlayerGameEntry[]
}
export interface BestRound {
  sessionId: number
  roundNumber: number
  winnerId: number
  winnerName: string
  winHand: string
  fanDetails: string
  fanCount: number
  scores: Record<number, number>
  dealInPlayerId: number | null
  dealInPlayerName: string | null
}
