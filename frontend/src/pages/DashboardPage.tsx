import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSessions, fetchPlayers } from '../api'
import { GameSession, Player } from '../types'

export default function DashboardPage() {
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSessions(), fetchPlayers()]).then(([s, p]) => {
      setSessions(s)
      setPlayers(p)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state"><p>Loading...</p></div>

  return (
    <>
      <div className="card">
        <div className="flex-between">
          <h2>Game Sessions</h2>
          <Link to="/new-session" className="btn btn-primary">+ New Game</Link>
        </div>
        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>No games yet. Start your first mahjong session!</p>
          </div>
        ) : (
          sessions.map(s => (
            <Link to={`/session/${s.id}`} key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="session-list-item">
                <div className="session-info">
                  <h3>{s.name || `Game #${s.id}`}</h3>
                  <span className="session-meta">
                    {s.gameModeDisplayName} &middot; {s.playerCount} players &middot; {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`badge ${s.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                  {s.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="card">
        <div className="flex-between">
          <h2>Registered Players</h2>
          <Link to="/signup" className="btn btn-outline btn-small">+ Sign Up New Player</Link>
        </div>
        <div className="player-chips">
          {players.map(p => (
            <span className="chip" key={p.id}>
              {p.firstName} {p.lastName}
              <span className="chip-username">@{p.userName}</span>
            </span>
          ))}
        </div>
        {players.length === 0 && (
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
            No players registered yet. <Link to="/signup">Sign up</Link> to get started.
          </p>
        )}
      </div>
    </>
  )
}
