export interface Player {
  id: number
  userName: string
  firstName: string
  lastName: string
  createdAt: string
  email?: string
  pictureUrl?: string
  merged?: boolean
  bot?: boolean
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
    key: 'RIICHI',
    label: '立直麻将',
    fanTableTitle: '立直麻将番表',
    fanTableSubtitle: '快速对照查询立直麻将（以M.League规则为准）的各级役种及番数。',
  },
  {
    key: 'DONGBEI',
    label: '东北麻将',
    fanTableTitle: '东北麻将规则',
    fanTableSubtitle: '学习和查询带有闭门、飘、手把一、旋风杠等浓厚地方特色的沈阳穷胡规则。',
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
  tableStrength?: string | null
}

export type TierKey = 'UNRANKED' | 'LV1' | 'LV2' | 'LV3' | 'LV4_THRONE'

/** 段位与隐藏分信息 (单一模式). */
export interface TierInfo {
  tier: TierKey
  /** 0-4 — maps to /rank/lv{level}.png (level 0 = 未定段, no image). */
  level: number
  rating: number
  /** Games in this mode (国标 / 立直 / 东北). */
  games: number
  /** When unranked: 5 - games (counts down to ranked debut for THIS mode). 0 once ranked. */
  gamesNeeded: number
  peakRating: number
}

export interface PlayerTierResponse {
  playerId: number
  userName: string
  guobiao: TierInfo
  riichi: TierInfo
  dongbei: TierInfo
}

const TIER_LABEL: Record<TierKey, string> = {
  UNRANKED: '未定段',
  LV1: '灵明石猴',
  LV2: '美猴王',
  LV3: '齐天大圣',
  LV4_THRONE: '斗战圣佛',
}

export function tierLabel(tier: TierKey): string {
  return TIER_LABEL[tier]
}

export interface PlayerPerformance {
  playerId?: number
  userName: string
  totalScore: number
  rank: number
  tier?: TierKey | null
}

export interface PlayerInfo {
  id: number
  userName: string
  seat: number
  tier?: TierKey | null
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
  tenpaiPlayerIds?: number[] // for drawn games; undefined on legacy rounds
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
  /** 起始点数 — 立直 25000, 其他模式 0. */
  startingPoints: number
  /** 每位玩家本场对局的段位分变化; 进行中的对局为空. */
  ratingDeltas?: Record<number, number>
  tableStrength?: string | null
}

export interface ConfirmedHand {
  concealed: string[]
  melds: { isOpen: boolean; tiles: string[] }[]
  winningTile: string | null
  isSelfDraw: boolean
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
  chombo?: boolean
  photoSampleIds?: string[] // recognition samples attempted while composing this round
  confirmedHand?: ConfirmedHand // the hand the calculator ended up with, in the recognisers' label shape
}

export interface PlayerStats {
  playerId: number
  userName: string
  gamesPlayed: number
  totalScore: number
  avgRank: number
  wins: number
  fourthPlaces: number
  roundsPlayed: number
  handWins: number
  tsumoWins: number
  dealIns: number
  avgWinPoints: number
  avgDealInPoints: number
  riichiWins: number
  meldWins: number
  recordedHandWins: number
  tier?: TierKey | null
  skillRating?: number
  gamesNeeded?: number
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

export interface PlayerModeStats {
  roundsPlayed: number
  handWins: number
  tsumoWins: number
  dealIns: number
  avgWinPoints: number
  avgDealInPoints: number
}

export interface PlayerDetail {
  playerId: number
  userName: string
  firstName: string
  lastName: string
  games: PlayerGameEntry[]
  statsByMode: Partial<Record<GameModeKey, PlayerModeStats>>
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

export interface HomeSummary {
  activeSessions: SessionDetail[]
  rankings: Record<string, { top: PlayerStats[]; best: BestRound | null }>
}

export interface FanDiscovery {
  fanName: string
  playerId: number
  playerName: string
  exampleHand: string | null
  discoveredAt: string
  season: string
}
