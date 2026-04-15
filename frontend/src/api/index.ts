import { Player, GameSession, SessionDetail, PlayerStats, PlayerDetail, AddRoundData } from '../types';

const API = '/api';

export async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch(`${API}/players`);
  return res.json();
}

export async function createPlayer(userName: string, firstName: string, lastName: string): Promise<Player> {
  const res = await fetch(`${API}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, firstName, lastName }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || 'Registration failed');
  }
  return res.json();
}

export async function checkUserName(userName: string): Promise<boolean> {
  const res = await fetch(`${API}/players/check-username?userName=${encodeURIComponent(userName)}`);
  const data = await res.json();
  return data.available;
}

export async function fetchSessions(): Promise<GameSession[]> {
  const res = await fetch(`${API}/sessions`);
  return res.json();
}

export async function createSession(name: string, gameMode: string, playerIds: number[]): Promise<GameSession> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gameMode, playerIds }),
  });
  return res.json();
}

export async function fetchSessionDetail(id: number): Promise<SessionDetail> {
  const res = await fetch(`${API}/sessions/${id}`);
  return res.json();
}

export async function addRound(sessionId: number, data: AddRoundData): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteRound(sessionId: number, roundNumber: number): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/rounds/${roundNumber}`, { method: 'DELETE' });
}

export async function completeSession(id: number): Promise<void> {
  await fetch(`${API}/sessions/${id}/complete`, { method: 'PUT' });
}

export async function fetchStats(gameMode?: string, year?: number, quarter?: number): Promise<PlayerStats[]> {
  const params = new URLSearchParams();
  if (gameMode) params.set('gameMode', gameMode);
  if (year != null && quarter != null) {
    params.set('year', String(year));
    params.set('quarter', String(quarter));
  }
  const qs = params.toString();
  const res = await fetch(`${API}/stats${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function fetchPlayerDetail(id: number): Promise<PlayerDetail> {
  const res = await fetch(`${API}/players/${id}/detail`);
  return res.json();
}
