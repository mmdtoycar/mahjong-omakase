import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchSessions } from '../api'
import { GameSession, PlayerPerformance } from '../types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSessions()
      .then((s) => {
        setSessions(s)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading)
    return (
      <div className="empty-state">
        <p>加载中...</p>
      </div>
    )
  if (error)
    return (
      <div className="empty-state">
        <p>加载失败：{error}</p>
      </div>
    )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0 }}>对局历史</h2>
        <Link to="/new-session" className="btn btn-primary">
          + 新建游戏
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <p>暂无对局记录。开始你的第一局吧！</p>
        </div>
      ) : (
        <div className="dashboard-sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="session-history-card"
              onClick={() => navigate(`/session/${s.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/session/${s.id}`)
                }
              }}
              tabIndex={0}
              role="button"
            >
              <div className="session-card-header">
                <div className="session-card-mode">
                  <span className="mode-text">{s.gameModeDisplayName}</span>
                </div>
                <div className="session-card-meta">
                  <span className="session-card-date">
                    {new Date(s.createdAt).toLocaleString([], {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className={`session-status-tag status-${s.status.toLowerCase()}`}>
                    {s.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
                  </span>
                </div>
              </div>
              <div className="session-card-players">
                {[0, 1, 2, 3].map((idx) => {
                  const p = s.rankings?.[idx]
                  if (!p)
                    return (
                      <div key={idx} className="player-rank-item empty">
                        -
                      </div>
                    )
                  return (
                    <div key={p.userName} className={`player-rank-item rank-${idx + 1}`}>
                      <div className="player-rank-main">
                        <span className="rank-number">#{idx + 1}</span>
                        <span className="player-name">{p.userName}</span>
                      </div>
                      <span
                        className={`player-score ${
                          p.totalScore > 0 ? 'score-positive' : p.totalScore < 0 ? 'score-negative' : ''
                        }`}
                      >
                        {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
