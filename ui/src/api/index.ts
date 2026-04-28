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

const API = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '请求失败' }))
    throw new Error(error.message || `请求失败 (${res.status})`)
  }
  return res.json()
}

export async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch(`${API}/players`)
  return handleResponse(res)
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
  const res = await fetch(`${API}/sessions`)
  return handleResponse(res)
}

export async function createSession(name: string, gameMode: string, playerIds: number[]): Promise<GameSession> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gameMode, playerIds }),
  })
  return handleResponse(res)
}

export async function fetchSessionDetail(id: number): Promise<SessionDetail> {
  const res = await fetch(`${API}/sessions/${id}`)
  return handleResponse(res)
}

export async function addRound(sessionId: number, data: AddRoundData): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '添加失败' }))
    throw new Error(error.message || '添加失败')
  }
}

export async function deleteRound(sessionId: number, roundNumber: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/rounds/${roundNumber}`, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '删除失败' }))
    throw new Error(error.message || '删除失败')
  }
}

export async function completeSession(id: number): Promise<void> {
  const res = await fetch(`${API}/sessions/${id}/complete`, { method: 'PUT' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '操作失败' }))
    throw new Error(error.message || '操作失败')
  }
}

export async function fetchActiveSeasons(): Promise<{ year: number; month: number }[]> {
  const res = await fetch(`${API}/stats/seasons`)
  return handleResponse(res)
}

export async function fetchStats(gameMode?: string, year?: number, month?: number): Promise<PlayerStats[]> {
  const params = new URLSearchParams()
  if (gameMode) params.set('gameMode', gameMode)
  if (year != null && month != null) {
    params.set('year', String(year))
    params.set('month', String(month))
  }
  const qs = params.toString()
  const res = await fetch(`${API}/stats${qs ? `?${qs}` : ''}`)
  return handleResponse(res)
}

export async function fetchPlayerDetail(id: number): Promise<PlayerDetail> {
  const res = await fetch(`${API}/players/${id}/detail`)
  return handleResponse(res)
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
  const res = await fetch(`${API}/stats/best-rounds${qs ? `?${qs}` : ''}`, { signal })
  return handleResponse<BestRound[]>(res)
}

export async function fetchFanDiscoveries(): Promise<FanDiscovery[]> {
  const res = await fetch(`${API}/stats/fan-discoveries`)
  return handleResponse<FanDiscovery[]>(res)
}
