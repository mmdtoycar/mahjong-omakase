import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameSession, Season, getCurrentSeason, getSeasonLabel } from '../types'
import { fetchSessions, fetchActiveSeasons } from '../api'
import { GameCard } from '../components/GameCard'
import { MSG } from '../constants'

export default function DashboardPage() {
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
      .catch((e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : MSG.ERROR)
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

  const filteredSessions = sessions
    .filter((s) => s.status === 'COMPLETED')
    .filter((s) => {
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
        <p>{MSG.LOADING}</p>
      </div>
    )
  if (error)
    return (
      <div className="empty-state">
        <p>{error}</p>
      </div>
    )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="flex-between dashboard-header"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}
      >
        <h2 style={{ margin: 0, whiteSpace: 'nowrap' }}>历史对局</h2>
        <div className="dashboard-header-actions">
          <select value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} className="select-inline">
            <option value="all">全部赛季</option>
            {seasons.map((s) => (
              <option key={`${s.year}-${s.month}`} value={`${s.year}-${s.month}`}>
                {s.label}
              </option>
            ))}
          </select>
          <Link to="/new-session" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            + 新建游戏
          </Link>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <p>{seasonKey === 'all' ? '暂无对局记录。开始你的第一局吧！' : '该赛季暂无对局记录。'}</p>
        </div>
      ) : (
        <div className="dashboard-sessions-list">
          {paginatedSessions.map((s) => (
            <GameCard
              key={s.id}
              id={s.id}
              gameModeDisplayName={s.gameModeDisplayName}
              createdAt={s.createdAt}
              roundLabel={`${s.roundCount}局 已结束`}
              isActive={false}
              players={
                s.rankings
                  ? s.rankings.map((p, idx) => ({
                      rank: idx + 1,
                      name: p.userName,
                      score: p.totalScore,
                    }))
                  : []
              }
            />
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
