import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSessions, fetchSessionDetail, fetchStats, fetchBestRounds } from '../api'
import { GameSession, SessionDetail, PlayerStats, BestRound, GAME_MODES, getCurrentSeason } from '../types'
import { GameCard } from '../components/GameCard'
import { deriveGameState, getWindName } from '../utils/gameState'
import { MSG } from '../constants'

export default function HomePage() {
  const [activeSessions, setActiveSessions] = useState<SessionDetail[]>([])
  const [rankings, setRankings] = useState<Record<string, { top: PlayerStats[]; best: BestRound | null }>>({})
  const [loading, setLoading] = useState(true)

  const currentSeason = getCurrentSeason()

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    async function loadData() {
      try {
        const sessions = await fetchSessions()
        const active = sessions.filter((s) => s.status === 'IN_PROGRESS')

        const settledDetails = await Promise.allSettled(active.map((s) => fetchSessionDetail(s.id)))
        const details = settledDetails
          .filter((res): res is PromiseFulfilledResult<SessionDetail> => res.status === 'fulfilled')
          .map((res) => res.value)

        if (isActive) setActiveSessions(details)

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
            } catch (err: unknown) {
              if (err instanceof Error && err.name !== 'AbortError') {
                console.error(`Failed to fetch stats for ${mode.key}:`, err)
              }
              rankingData[mode.key] = { top: [], best: null }
            }
          })
        )

        if (isActive) setRankings(rankingData)
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') console.error('Failed to load hub data:', e)
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadData()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [currentSeason.year, currentSeason.month])

  if (loading) {
    return (
      <div className="empty-state">
        <p>{MSG.LOADING}</p>
      </div>
    )
  }

  return (
    <div className="home-hub">
      <div className="hero-section">
        <Link to="/new-session" className="hero-logo-link">
          <div className="hero-logo-ring">
            <img src="/logo-header.png" alt="" className="hero-logo-img" />
          </div>
          <span className="hero-cta">
            麻将，启动<span style={{ marginLeft: '-0.005em' }}>!</span>
          </span>
        </Link>
      </div>

      <div className="card active-games-section">
        <h2 style={{ marginBottom: '16px' }}>正在进行的对局</h2>
        {activeSessions.length === 0 ? (
          <div className="empty-state">
            <p>当前没有正在进行的对局</p>
          </div>
        ) : (
          <div className="active-games-grid">
            {activeSessions.map((s) => {
              const state = deriveGameState(s)
              const sortedPlayers = [...s.players].sort(
                (a, b) => (s.totalScores[b.id] || 0) - (s.totalScores[a.id] || 0)
              )
              const sortedScores = sortedPlayers.map((p) => s.totalScores[p.id] || 0)
              return (
                <GameCard
                  key={s.id}
                  id={s.id}
                  gameModeDisplayName={s.gameModeDisplayName}
                  createdAt={s.createdAt}
                  roundLabel={`${state.displayName} 进行中`}
                  isActive={true}
                  players={sortedPlayers.map((p) => {
                    const score = s.totalScores[p.id] || 0
                    const rank = sortedScores.indexOf(score) + 1
                    const seat = p.seat ?? s.players.findIndex((op) => op.id === p.id) + 1
                    const menfeng = ((seat - state.dealerSeat + state.playerCount) % state.playerCount) + 1
                    return {
                      rank,
                      name: p.userName,
                      score,
                      wind: getWindName(menfeng),
                      isDealer: p.id === state.dealerPlayerId,
                    }
                  })}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="card rankings-section">
        <h2 style={{ marginBottom: '16px' }}>本月荣誉殿堂</h2>
        <div className="hall-of-fame-grid">
          {GAME_MODES.map((mode) => {
            const data = rankings[mode.key]
            return (
              <div key={mode.key} className="mode-rank-column">
                <h3 className="mode-rank-title">{mode.label}</h3>
                <div className="rank-list">
                  {!data || data.top.length === 0 ? (
                    <div className="empty-state empty-state-compact">
                      <p>暂无本月排名</p>
                    </div>
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
