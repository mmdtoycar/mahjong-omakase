import { useEffect, useState } from 'react'
import { fetchStats } from '../api'
import { PlayerStats, GameModeKey, GAME_MODES } from '../types'

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [gameMode, setGameMode] = useState<GameModeKey>(GAME_MODES[0].key)

  const loadStats = (mode: GameModeKey) => {
    setLoading(true)
    fetchStats(mode).then(s => {
      setStats(s.sort((a, b) => b.totalScore - a.totalScore))
      setLoading(false)
    })
  }

  useEffect(() => {
    loadStats(gameMode)
  }, [gameMode])

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
          <div className="stat-value">{topScorer?.displayName || '-'}</div>
          <div className="stat-label">Top Scorer</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{topWinner?.displayName || '-'}</div>
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
                <tr key={s.playerId}>
                  <td className={i < 3 ? `rank-${i + 1}` : ''}>#{i + 1}</td>
                  <td>
                    {s.displayName}
                    <span className="table-username">@{s.userName}</span>
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
  )
}
