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

  if (loading) return <div className="empty-state"><p>加载中...</p></div>

  return (
    <div className="card">
      <div className="flex-between">
        <h2>游戏记录</h2>
        <Link to="/new-session" className="btn btn-primary">+ 新建游戏</Link>
      </div>
      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>暂无游戏记录。开始你的第一局吧！</p>
        </div>
      ) : (
        sessions.map(s => (
          <Link to={`/session/${s.id}`} key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="session-list-item">
              <div className="session-info">
                <h3>{s.name || `Game #${s.id}`}</h3>
                <span className="session-meta">
                  {s.gameModeDisplayName} &middot; {s.playerCount}玩家 &middot; {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span className={`badge ${s.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                {s.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
              </span>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
