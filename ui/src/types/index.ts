export interface Player {
  id: number
  userName: string
  firstName: string
  lastName: string
  createdAt: string
}

export type GameModeKey = 'DONGBEI' | 'RIICHI' | 'GUOBIAO'

export const GAME_MODES: { key: GameModeKey; label: string; fanTableTitle: string; fanTableSubtitle: string }[] = [
  {
    key: 'GUOBIAO',
    label: '国标麻将',
    fanTableTitle: '国标麻将番表',
    fanTableSubtitle: '快速对照查询中国麻将竞赛规则（国标麻将）的81种番型及分数。',
  },
  {
    key: 'DONGBEI',
    label: '东北麻将',
    fanTableTitle: '东北麻将规则',
    fanTableSubtitle: '学习和查询带有闭门、飘、手把一、旋风杠等浓厚地方特色的沈阳穷胡规则。',
  },
  {
    key: 'RIICHI',
    label: '立直麻将',
    fanTableTitle: '立直麻将番表',
    fanTableSubtitle: '快速对照查询立直麻将（以M.League规则为准）的各级役种及番数。',
  },
]

export interface GameSession {
  id: number
  name: string
  gameMode: GameModeKey
  gameModeDisplayName: string
  playerCount: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  createdAt: string
  roundCount: number
  rankings?: PlayerPerformance[]
  isOnline?: boolean
}

export interface PlayerPerformance {
  userName: string
  totalScore: number
  rp: number
  rank: number
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
  riichiPlayerIds?: number[]
  backfill?: boolean
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
  playerBonuses?: Record<number, number>
  isOnline?: boolean
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
  riichiPlayerIds?: number[] // players who declared riichi
  winHand?: string
  fanDetails?: string
  fanCount?: number
  prevalentWind?: number
  backfill?: boolean
  chombo?: boolean
}

export interface PlayerStats {
  playerId: number
  userName: string
  displayName: string
  gamesPlayed: number
  totalScore: number
  totalRP: number
  baseRP: number
  tieredBonus: number
  adminBonus: number
  fanDiscoveryBonus: number
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
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
  })
  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '', 10)
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '', 10)
  return { year, month, label: getSeasonLabel(year, month) }
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
  exampleHand: string | null
  discoveredAt: string
  bonusRp: number | null
  season: string
}
