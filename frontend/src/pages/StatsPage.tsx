import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchStats, fetchPlayers } from '../api'
import { PlayerStats, Player, GameModeKey, GAME_MODES } from '../types'

type Tab = 'games' | 'players'

export default function StatsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'games'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [gameMode, setGameMode] = useState<GameModeKey>(GAME_MODES[0].key)

  const loadStats = (mode: GameModeKey) => {
    setLoading(true)
    fetchStats(mode).then(s => {
      setStats(s.sort((a, b) => b.totalScore - a.totalScore))
      setLoading(false)
    })
  }

  const loadPlayers = () => {
    setLoading(true)
    fetchPlayers().then(p => {
      setPlayers(p)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (tab === 'games') loadStats(gameMode)
    else loadPlayers()
  }, [gameMode, tab])

  const abbr = (s: PlayerStats) => `${s.displayName.split(' ')[0][0]}.${s.displayName.split(' ').slice(1).join(' ')}`

  const activeStats = stats.filter(s => s.gamesPlayed > 0)

  if (loading) return <div className="empty-state"><p>Loading...</p></div>

  const totalGames = activeStats.length > 0 ? Math.max(...activeStats.map(s => s.gamesPlayed)) : 0
  const topScorer = activeStats[0]
  const topWinner = activeStats.length > 0 ? [...activeStats].sort((a, b) => b.wins - a.wins)[0] : null

  return (
    <>
      <div className="card">
        <div className="flex-between">
          <h2>Stats</h2>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'games' ? 'tab-active' : ''}`} onClick={() => setTab('games')}>Games</button>
            <button className={`tab-btn ${tab === 'players' ? 'tab-active' : ''}`} onClick={() => setTab('players')}>Players</button>
          </div>
        </div>
      </div>

      {tab === 'games' && (
        <>
          <div className="card">
            <div className="flex-between">
              <h2>Game Mode</h2>
              <select
                value={gameMode}
                onChange={e => setGameMode(e.target.value as GameModeKey)}
                style={{ width: 'auto' }}
              >
                {GAME_MODES.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{activeStats.length}</div>
              <div className="stat-label">Players</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalGames}</div>
              <div className="stat-label">Games Played</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{topScorer?.userName || '-'}</div>
              <div className="stat-label">Top Scorer</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{topWinner?.userName || '-'}</div>
              <div className="stat-label">Most Wins</div>
            </div>
          </div>

          {activeStats.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p>No stats yet for {GAME_MODES.find(m => m.key === gameMode)?.label}. Play some games first!</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>Leaderboard</h2>
              <div className="score-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th style={{ textAlign: 'right' }}>Games</th>
                    <th style={{ textAlign: 'right' }}>Wins</th>
                    <th style={{ textAlign: 'right' }}>Total Score</th>
                    <th style={{ textAlign: 'right' }}>Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStats.map((s, i) => (
                    <tr key={s.playerId} onClick={() => navigate(`/player/${s.playerId}?from=games`)} style={{ cursor: 'pointer' }}>
                      <td className={i < 3 ? `rank-${i + 1}` : ''}>#{i + 1}</td>
                      <td>
                        {s.userName}
                        <span className="table-username">{abbr(s)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{s.gamesPlayed}</td>
                      <td style={{ textAlign: 'right' }}>{s.wins}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.totalScore}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {s.avgScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'players' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{players.length}</div>
              <div className="stat-label">Total Registered</div>
            </div>
          </div>

          <div className="card">
            <h2>All Players</h2>
            <div className="score-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id} onClick={() => navigate(`/player/${p.id}?from=players`)} style={{ cursor: 'pointer' }}>
                    <td>{i + 1}</td>
                    <td>{p.userName}</td>
                    <td>{p.firstName[0]}.{p.lastName}</td>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {players.length === 0 && (
              <div className="empty-state">
                <p>No players registered yet.</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
