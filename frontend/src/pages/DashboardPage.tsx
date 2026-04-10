import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSessions } from '../api'
import { GameSession } from '../types'

export default function DashboardPage() {
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions().then(s => {
      setSessions(s)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state"><p>Loading...</p></div>

  return (
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
  )
}
