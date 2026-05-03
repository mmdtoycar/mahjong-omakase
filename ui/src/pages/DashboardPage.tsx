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

  const renderPlayerCell = (rankings: PlayerPerformance[] | undefined, index: number) => {
    const p = rankings?.[index]
    if (!p) return <td className="cell-rank">-</td>

    return (
      <td className="cell-rank">
        <div className="cell-player-box">
          <span className="cell-player-name">{p.userName}</span>
          <span
            className={`cell-player-stats ${
              p.totalScore > 0 ? 'score-positive' : p.totalScore < 0 ? 'score-negative' : ''
            }`}
            style={{ fontWeight: 700 }}
          >
            {p.totalScore > 0 ? `+${p.totalScore}` : p.totalScore}
          </span>
        </div>
      </td>
    )
  }

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
        <div className="dashboard-table-container">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>模式</th>
                <th className="rank-tag-1">#1</th>
                <th className="rank-tag-2">#2</th>
                <th className="rank-tag-3">#3</th>
                <th className="rank-tag-4">#4</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/session/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/session/${s.id}`)
                    }
                  }}
                  tabIndex={0}
                  role="row"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="cell-mode">{s.gameModeDisplayName}</td>
                  {renderPlayerCell(s.rankings, 0)}
                  {renderPlayerCell(s.rankings, 1)}
                  {renderPlayerCell(s.rankings, 2)}
                  {renderPlayerCell(s.rankings, 3)}
                  <td className="cell-date">
                    {new Date(s.createdAt).toLocaleDateString([], {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="cell-status">
                    <span
                      className={`cell-status-badge badge ${
                        s.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'
                      }`}
                    >
                      {s.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
