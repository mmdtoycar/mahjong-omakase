import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GameSession, Season, getCurrentSeason, getSeasonLabel } from '../types'
import { fetchSessions, fetchActiveSeasons } from '../api'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonKey, setSeasonKey] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)

    fetchSessions()
      .then((sData) => {
        if (!mounted) return
        setSessions(sData)
        // If sessions load successfully, we can already stop the main loading spinner
        // once we also try to get the seasons.
        return fetchActiveSeasons()
      })
      .then((seasonsData) => {
        if (!mounted || !seasonsData) return
        const list = seasonsData.map((s) => ({
          year: s.year,
          month: s.month,
          label: getSeasonLabel(s.year, s.month),
        }))
        setSeasons(list)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Reset to page 1 when season changes
  useEffect(() => {
    setCurrentPage(1)
  }, [seasonKey])

  const filteredSessions = sessions.filter((s) => {
    if (seasonKey === 'all') return true
    const d = new Date(s.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    return key === seasonKey
  })

  const totalPages = Math.ceil(filteredSessions.length / pageSize)
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
      <div
        className="flex-between"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0 }}>对局历史</h2>
          <select value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} className="select-inline">
            <option value="all">全部赛季</option>
            {seasons.map((s) => (
              <option key={`${s.year}-${s.month}`} value={`${s.year}-${s.month}`}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Link to="/new-session" className="btn btn-primary">
          + 新建游戏
        </Link>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <p>{seasonKey === 'all' ? '暂无对局记录。开始你的第一局吧！' : '该赛季暂无对局记录。'}</p>
        </div>
      ) : (
        <div className="dashboard-sessions-list">
          {paginatedSessions.map((s) => (
            <Link
              key={s.id}
              to={`/session/${s.id}`}
              className="session-history-card"
              style={{ textDecoration: 'none' }}
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
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-container">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            上一页
          </button>
          <div className="pagination-info">
            第 {currentPage} 页 / 共 {totalPages} 页
          </div>
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
