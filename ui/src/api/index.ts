import {
  Player,
  GameSession,
  SessionDetail,
  PlayerStats,
  PlayerDetail,
  AddRoundData,
  BestRound,
  FanDiscovery,
} from '../types'
import { MSG } from '../constants'

const API = '/api'

const cache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_TTL = 30_000

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') cache.clear()
})

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiry) return entry.data as T
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL })
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: MSG.REQUEST_FAILED }))
    throw new Error(error.message || `${MSG.REQUEST_FAILED} (${res.status})`)
  }
  return res.json()
}

async function cachedFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const cached = getCached<T>(url)
  if (cached) return cached
  const res = await fetch(url, signal ? { signal } : undefined)
  const data = await handleResponse<T>(res)
  setCache(url, data)
  return data
}

export async function fetchPlayers(): Promise<Player[]> {
  return cachedFetch(`${API}/players`)
}

export async function createPlayer(userName: string, firstName: string, lastName: string): Promise<Player> {
  const res = await fetch(`${API}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, firstName, lastName }),
  })
  return handleResponse(res)
}

export async function checkUserName(userName: string): Promise<boolean> {
  const res = await fetch(`${API}/players/check-username?userName=${encodeURIComponent(userName)}`)
  const data = await handleResponse<{ available: boolean }>(res)
  return data.available
}

export async function fetchSessions(): Promise<GameSession[]> {
  return cachedFetch(`${API}/sessions`)
}

export async function createSession(name: string, gameMode: string, playerIds: number[]): Promise<GameSession> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gameMode, playerIds }),
  })
  const data = await handleResponse<GameSession>(res)
  invalidateCache()
  return data
}

export async function fetchSessionDetail(id: number): Promise<SessionDetail> {
  return cachedFetch(`${API}/sessions/${id}`)
}

export async function addRound(sessionId: number, data: AddRoundData): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: MSG.ADD_FAILED }))
    throw new Error(error.message || MSG.ADD_FAILED)
  }
  invalidateCache()
}

export async function deleteRound(sessionId: number, roundNumber: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds/${roundNumber}`, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: MSG.DELETE_FAILED }))
    throw new Error(error.message || MSG.DELETE_FAILED)
  }
  invalidateCache()
}

export async function completeSession(id: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${id}/complete`, { method: 'PUT' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: MSG.ACTION_FAILED }))
    throw new Error(error.message || MSG.ACTION_FAILED)
  }
  invalidateCache()
}

export async function fetchActiveSeasons(): Promise<{ year: number; month: number }[]> {
  return cachedFetch(`${API}/stats/seasons`)
}

export async function fetchStats(gameMode?: string, year?: number, month?: number): Promise<PlayerStats[]> {
  const params = new URLSearchParams()
  if (gameMode) params.set('gameMode', gameMode)
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  return cachedFetch(`${API}/stats${qs ? `?${qs}` : ''}`)
}

export async function fetchPlayerDetail(id: number): Promise<PlayerDetail> {
  return cachedFetch(`${API}/players/${id}/detail`)
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
  return cachedFetch(`${API}/stats/best-rounds${qs ? `?${qs}` : ''}`, signal)
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
  return cachedFetch(`${API}/stats/fan-discoveries${qs ? `?${qs}` : ''}`, signal)
}
