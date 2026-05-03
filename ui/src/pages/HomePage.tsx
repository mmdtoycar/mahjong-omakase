import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSessions, fetchSessionDetail, fetchStats, fetchBestRounds } from '../api'
import { GameSession, SessionDetail, PlayerStats, BestRound, GAME_MODES, getCurrentSeason } from '../types'
import { ActiveGameCard } from '../components/ActiveGameCard'

export default function HomePage() {
  const [activeSessions, setActiveSessions] = useState<SessionDetail[]>([])
  const [rankings, setRankings] = useState<Record<string, { top: PlayerStats[]; best: BestRound | null }>>({})
  const [loading, setLoading] = useState(true)

  const currentSeason = getCurrentSeason()

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>
    let isActive = true
    let inFlight = false
    const controller = new AbortController()

    async function loadData() {
      if (inFlight) return
      inFlight = true

      try {
        // 1. Fetch sessions and filter for IN_PROGRESS
        const sessions = await fetchSessions()
        const active = sessions.filter((s) => s.status === 'IN_PROGRESS')

        // 2. Fetch details for active sessions (using allSettled to prevent single failure from crashing all)
        const settledDetails = await Promise.allSettled(active.map((s) => fetchSessionDetail(s.id)))
        const details = settledDetails
          .filter((res): res is PromiseFulfilledResult<SessionDetail> => res.status === 'fulfilled')
          .map((res) => res.value)

        if (isActive) setActiveSessions(details)

        // 3. Fetch stats for each mode
        const rankingData: Record<string, { top: PlayerStats[]; best: BestRound | null }> = {}

        await Promise.all(
          GAME_MODES.map(async (mode) => {
            try {
              const [stats, bestRounds] = await Promise.all([
                fetchStats(mode.key, currentSeason.year, currentSeason.month),
                fetchBestRounds(mode.key, currentSeason.year, currentSeason.month, controller.signal),
              ])

              rankingData[mode.key] = {
                top: stats.sort((a, b) => b.totalRP - a.totalRP).slice(0, 3),
                best:
                  bestRounds.length > 0 ? bestRounds.sort((a, b) => (b.fanCount || 0) - (a.fanCount || 0))[0] : null,
              }
            } catch (err) {
              if ((err as Error).name !== 'AbortError') {
                console.error(`Failed to fetch stats for ${mode.key}:`, err)
              }
              rankingData[mode.key] = { top: [], best: null }
            }
          })
        )

        if (isActive) setRankings(rankingData)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error('Failed to load hub data:', e)
      } finally {
        inFlight = false
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadData()
    intervalId = setInterval(loadData, 10000)

    return () => {
      isActive = false
      clearInterval(intervalId)
      controller.abort()
    }
  }, [currentSeason.year, currentSeason.month])

  if (loading) {
    return (
      <div className="empty-state">
        <p>加载枢纽数据中...</p>
      </div>
    )
  }

  return (
    <div className="home-hub">
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <Link
          to="/new-session"
          className="btn btn-accent btn-hero-shine"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '1.1rem',
            padding: '12px 24px',
            borderRadius: '50px',
          }}
        >
          <img src="/logo-header.png" alt="" style={{ height: '24px', width: 'auto' }} />
          麻将，启动！
        </Link>
      </div>

      <div className="active-games-section">
        <h2 style={{ marginBottom: '16px' }}>正在进行的对局</h2>
        {activeSessions.length === 0 ? (
          <div
            className="empty-state"
            style={{ background: 'white', borderRadius: '12px', padding: '40px', boxShadow: 'var(--shadow)' }}
          >
            <p style={{ color: 'var(--text-light)', marginBottom: '12px' }}>当前没有正在进行的对局</p>
            <Link to="/new-session" style={{ color: 'var(--mj-green)', fontWeight: 'bold', textDecoration: 'none' }}>
              + 开启一局新游戏
            </Link>
          </div>
        ) : (
          <div className="active-games-grid">
            {activeSessions.map((s) => (
              <ActiveGameCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>

      <div className="rankings-section" style={{ marginTop: '48px' }}>
        <h2 style={{ marginBottom: '16px' }}>本月荣誉殿堂</h2>
        <div className="hall-of-fame-grid">
          {GAME_MODES.map((mode) => {
            const data = rankings[mode.key]
            return (
              <div key={mode.key} className="mode-rank-column">
                <h3 className="mode-rank-title">{mode.label}</h3>
                <div className="rank-list">
                  {!data || data.top.length === 0 ? (
                    <p className="empty-state" style={{ padding: '20px 0' }}>
                      暂无本月排名
                    </p>
                  ) : (
                    data.top.map((player, idx) => (
                      <div key={player.playerId} className="rank-item">
                        <span className={`rank-number rank-tag-${idx + 1}`}>#{idx + 1}</span>
                        <div className="rank-info">
                          <span className="player-name">{player.userName}</span>
                          <span className="player-score">{player.totalRP.toFixed(1)} RP</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {data?.best && (
                  <div className="best-hand-summary">
                    <span className="best-hand-label">🏆 本月最高和牌</span>
                    <div className="best-hand-value">
                      {data.best.fanCount} 番 · {data.best.winnerName}
                      <div
                        style={{
                          fontSize: '0.75rem',
                          marginTop: '4px',
                          color: 'var(--sol-base01)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {data.best.fanDetails}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: '60px', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>
        <p>© 2026 Mahjong Omakase Team · Let's NB!</p>
      </div>
    </div>
  )
}
