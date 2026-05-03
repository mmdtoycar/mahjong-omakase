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
  avgScore: number
  wins: number
}

export interface Season {
  year: number
  month: number
  label: string
}

const SEASON_NAMES: Record<number, string> = {
  1: '大寒赛季',
  2: '立春赛季',
  3: '春分赛季',
  4: '清明赛季',
  5: '立夏赛季',
  6: '夏至赛季',
  7: '大暑赛季',
  8: '立秋赛季',
  9: '秋分赛季',
  10: '霜降赛季',
  11: '立冬赛季',
  12: '冬至赛季',
}

export function getSeasonLabel(year: number, month: number): string {
  return `${year} ${SEASON_NAMES[month]}`
}

export function getCurrentSeason(): Season {
  const now = new Date()
  const month = now.getMonth() + 1
  return { year: now.getFullYear(), month, label: getSeasonLabel(now.getFullYear(), month) }
}

export function getAvailableSeasons(startYear: number): Season[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const seasons: Season[] = []

  for (let year = currentYear; year >= startYear; year--) {
    const endMonth = year === currentYear ? currentMonth : 12
    for (let month = endMonth; month >= 1; month--) {
      seasons.push({ year, month, label: getSeasonLabel(year, month) })
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

export interface FanDiscovery {
  fanName: string
  playerId: number
  playerName: string
  exampleHand: string
  discoveredAt: string
  bonusRp: number
  season: string
}
