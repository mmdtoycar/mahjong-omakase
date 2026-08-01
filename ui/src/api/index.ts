import {
  Player,
  GameSession,
  SessionDetail,
  PlayerStats,
  PlayerDetail,
  PlayerTierResponse,
  AddRoundData,
  BestRound,
  FanDiscovery,
  HomeSummary,
} from '../types'
import { MSG } from '../constants'

const API = '/api'

function getAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('mahjong_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse<T = void>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || body.message || MSG.ERROR)
  }
  const text = await res.text()
  if (!text.trim()) return undefined as T
  return JSON.parse(text)
}

async function authFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: getAuthHeaders() })
  return handleResponse<T>(res)
}

export type PendingAuthProfile = {
  email: string
  firstName: string
  lastName: string
  picture: string | null
}

export type LoginResponse =
  | { pendingAuth: false; token: string; player: Player }
  | { pendingAuth: true; profile: PendingAuthProfile }

export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const res = await fetch(`${API}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  const data = await handleResponse<{
    pendingAuth?: boolean
    profile?: PendingAuthProfile
    token?: string
    player?: Player
  }>(res)
  if (data.pendingAuth) {
    return { pendingAuth: true, profile: data.profile as PendingAuthProfile }
  }
  return { pendingAuth: false, token: data.token as string, player: data.player as Player }
}

export async function fetchCurrentUser(): Promise<Player> {
  const res = await fetch(`${API}/auth/me`, {
    headers: getAuthHeaders(),
  })
  return handleResponse<Player>(res)
}

export async function fetchPlayers(): Promise<Player[]> {
  return authFetch(`${API}/players`)
}

export async function createPlayer(userName: string, firstName: string, lastName: string): Promise<Player> {
  const res = await fetch(`${API}/players`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userName, firstName, lastName }),
  })
  return handleResponse<Player>(res)
}

export async function checkUserName(userName: string): Promise<boolean> {
  const res = await fetch(`${API}/players/check-username?userName=${encodeURIComponent(userName)}`, {
    headers: getAuthHeaders(),
  })
  const data = await handleResponse<{ available: boolean }>(res)
  return data.available
}

export async function fetchSessions(signal?: AbortSignal): Promise<GameSession[]> {
  return authFetch(`${API}/sessions`, signal)
}

export async function createSession(name: string, gameMode: string, playerIds: number[]): Promise<GameSession> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, gameMode, playerIds }),
  })
  return handleResponse<GameSession>(res)
}

export async function fetchSessionDetail(id: number, signal?: AbortSignal): Promise<SessionDetail> {
  return authFetch(`${API}/sessions/${id}`, signal)
}

export async function addRound(sessionId: number, data: AddRoundData): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  await handleResponse(res)
}

export async function deleteRound(sessionId: number, roundNumber: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds/${roundNumber}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse(res)
}

export async function completeSession(id: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${id}/complete`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  })
  await handleResponse(res)
}

export async function fetchActiveSeasons(): Promise<{ year: number; month: number }[]> {
  return authFetch(`${API}/stats/seasons`)
}

export async function fetchStats(
  gameMode?: string,
  year?: number,
  month?: number,
  signal?: AbortSignal
): Promise<PlayerStats[]> {
  const params = new URLSearchParams()
  if (gameMode) params.set('gameMode', gameMode)
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  return authFetch(`${API}/stats${qs ? `?${qs}` : ''}`, signal)
}

export async function fetchPlayerDetail(id: number): Promise<PlayerDetail> {
  return authFetch(`${API}/players/${id}/detail`)
}

export async function fetchPlayerTier(id: number): Promise<PlayerTierResponse> {
  return authFetch(`${API}/players/${id}/tier`)
}

export async function fetchBestRounds(
  gameMode?: string,
  year?: number,
  month?: number,
  signal?: AbortSignal
): Promise<BestRound[]> {
  const params = new URLSearchParams()
  if (gameMode) params.set('gameMode', gameMode)
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  return authFetch(`${API}/stats/best-rounds${qs ? `?${qs}` : ''}`, signal)
}

export async function fetchHomeSummary(year?: number, month?: number, signal?: AbortSignal): Promise<HomeSummary> {
  const params = new URLSearchParams()
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  return authFetch(`${API}/home-summary${qs ? `?${qs}` : ''}`, signal)
}

export async function fetchFanDiscoveries(
  year?: number,
  month?: number,
  signal?: AbortSignal
): Promise<FanDiscovery[]> {
  if ((year != null) !== (month != null)) {
    throw new Error('Both year and month must be provided together')
  }
  const params = new URLSearchParams()
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  return authFetch(`${API}/stats/fan-discoveries${qs ? `?${qs}` : ''}`, signal)
}

export async function setupProfile(
  credential: string,
  userName: string,
  firstName: string,
  lastName: string
): Promise<{ token: string; player: Player }> {
  const res = await fetch(`${API}/auth/setup-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, userName, firstName, lastName }),
  })
  return handleResponse<{ token: string; player: Player }>(res)
}

export async function lookupClaimablePlayer(userName: string, firstName: string, lastName: string): Promise<boolean> {
  const params = new URLSearchParams({ userName, firstName, lastName })
  const res = await fetch(`${API}/auth/lookup-claimable?${params.toString()}`, {
    headers: getAuthHeaders(),
  })
  const data = await handleResponse<{ exists: boolean }>(res)
  return data.exists
}

export interface ServerCalibrationDTO {
  id?: number
  imagePreview: string
  handText: string
  isFull34Set?: boolean
  createdAt?: string
}

export async function fetchActiveServerCalibration(): Promise<ServerCalibrationDTO | null> {
  const res = await fetch(`${API}/calibration/active`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 204) return null
  return handleResponse<ServerCalibrationDTO>(res)
}

export async function saveServerCalibration(data: ServerCalibrationDTO): Promise<ServerCalibrationDTO> {
  const res = await fetch(`${API}/calibration`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  return handleResponse<ServerCalibrationDTO>(res)
}

export async function deleteServerCalibration(): Promise<void> {
  const res = await fetch(`${API}/calibration`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  await handleResponse(res)
}
