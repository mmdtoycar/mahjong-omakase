import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchPlayerDetail } from '../api'
import { PlayerDetail } from '../types'

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromTab = searchParams.get('from') || 'games'
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayerDetail(Number(id)).then(p => {
      setPlayer(p)
      setLoading(false)
    })
  }, [id])

  if (loading || !player) return <div className="empty-state"><p>Loading...</p></div>

  return (
    <>
      <div className="card">
        <h2>{player.userName}</h2>
        <span className="session-meta">{player.firstName[0]}.{player.lastName}</span>
      </div>

      <div className="card">
        <h2>Game History ({player.games.length})</h2>
        {player.games.length === 0 ? (
          <div className="empty-state">
            <p>No games played yet.</p>
          </div>
        ) : (
          <div className="score-table">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {player.games.map(g => (
                  <tr
                    key={g.sessionId}
                    onClick={() => navigate(`/session/${g.sessionId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{g.sessionName || `Game #${g.sessionId}`}</td>
                    <td>{g.gameModeDisplayName}</td>
                    <td>{new Date(g.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${g.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                        {g.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                      </span>
                    </td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: g.totalScore > 0 ? 'var(--success)' : g.totalScore < 0 ? 'var(--danger)' : undefined
                    }}>
                      {g.totalScore > 0 ? `+${g.totalScore}` : g.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-outline btn-small" onClick={() => navigate(`/stats?tab=${fromTab}`)}>
          Back to Stats
        </button>
      </div>
    </>
  )
}
