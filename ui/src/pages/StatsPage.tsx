import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { PlayerStats, Player, GameModeKey, GAME_MODES, getCurrentSeason, BestRound } from '../types'
import { fetchStats, fetchPlayers, fetchBestRounds } from '../api'
import { MahjongHand } from '../components/MahjongHand'
import { RankBadge } from '../components/RankBadge'

type Tab = 'games' | 'players'

const currentSeason = getCurrentSeason()

import { statFontSize } from '../utils/fontSize'
import { abbrName, parseError } from '../utils/format'
import { MSG } from '../constants'
import { useActiveSeasons } from '../hooks/useActiveSeasons'

export default function StatsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'games'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bestRounds, setBestRounds] = useState<BestRound[]>([])
  const [bestRoundsError, setBestRoundsError] = useState('')
  const [monthlyBestRounds, setMonthlyBestRounds] = useState<BestRound[]>([])
  const [monthlyBestRoundsError, setMonthlyBestRoundsError] = useState('')
  const { seasons, error: seasonsError } = useActiveSeasons()

  const [gameMode, setGameMode] = useState<GameModeKey>(GAME_MODES[0].key)
  const [seasonKey, setSeasonKey] = useState<string>(`${currentSeason.year}-${currentSeason.month}`)

  const loadStats = (mode: GameModeKey, sKey: string) => {
    setError('')
    setLoading(true)
    let year: number | undefined
    let month: number | undefined
    if (sKey !== 'all') {
      const [y, m] = sKey.split('-').map(Number)
      year = y
      month = m
    }
    fetchStats(mode, year, month)
      .then((s) => {
        setStats(s.sort((a, b) => b.totalRP - a.totalRP || b.totalScore - a.totalScore))
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(parseError(e))
        setLoading(false)
      })
  }

  const loadPlayers = (mode: GameModeKey, sKey: string) => {
    setError('')
    setLoading(true)
    let year: number | undefined
    let month: number | undefined
    if (sKey !== 'all') {
      const [y, m] = sKey.split('-').map(Number)
      year = y
      month = m
    }
    Promise.all([fetchPlayers(), fetchStats(mode, year, month)])
      .then(([p, s]) => {
        setPlayers(p)
        setStats(s)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(parseError(e))
        setLoading(false)
      })
  }

  // Snap seasonKey to the first available season once seasons load,
  // unless the current selection is still valid.
  useEffect(() => {
    if (seasons.length === 0) return
    setSeasonKey((prev) =>
      seasons.some((s) => `${s.year}-${s.month}` === prev) ? prev : `${seasons[0].year}-${seasons[0].month}`
    )
  }, [seasons])

  useEffect(() => {
    if (tab === 'games') {
      loadStats(gameMode, seasonKey)
    } else {
      loadPlayers(gameMode, seasonKey)
    }
  }, [gameMode, seasonKey, tab])

  useEffect(() => {
    const controller = new AbortController()
    if (tab === 'games') {
      setBestRoundsError('')
      fetchBestRounds(gameMode, undefined, undefined, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setBestRounds(data)
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) setBestRoundsError(parseError(e))
        })
    }
    return () => controller.abort()
  }, [tab, gameMode])

  useEffect(() => {
    const controller = new AbortController()
    if (tab === 'games' && seasonKey !== 'all') {
      setMonthlyBestRoundsError('')
      setMonthlyBestRounds([])
      const [y, m] = seasonKey.split('-').map(Number)
      fetchBestRounds(gameMode, y, m, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setMonthlyBestRounds(data)
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) {
            setMonthlyBestRoundsError(parseError(e))
            setMonthlyBestRounds([])
          }
        })
    } else {
      setMonthlyBestRounds([])
      setMonthlyBestRoundsError('')
    }
    return () => controller.abort()
  }, [tab, seasonKey, gameMode])

  const activeStats = stats.filter((s) => s.gamesPlayed > 0)
  const selectedSeason = seasons.find((s) => `${s.year}-${s.month}` === seasonKey)

  // Sort by skillRating descending so top performers show first.
  const playerRows = players
    .map((p) => {
      const stat = stats.find((s) => s.playerId === p.id)
      return {
        ...p,
        tier: stat?.tier ?? 'UNRANKED',
        skillRating: stat?.skillRating,
        totalGames: stat?.gamesPlayed ?? 0,
        gamesNeeded: stat?.gamesNeeded,
      }
    })
    .sort((a, b) => (b.skillRating ?? 0) - (a.skillRating ?? 0))

  if (loading)
    return (
      <div className="empty-state">
        <p>{MSG.LOADING}</p>
      </div>
    )
  if (error || seasonsError)
    return (
      <div className="empty-state">
        <p>{error || seasonsError}</p>
      </div>
    )

  const totalGames = activeStats.length > 0 ? Math.max(...activeStats.map((s) => s.gamesPlayed)) : 0
  const topScorer = activeStats[0]
  const topWinner = activeStats.length > 0 ? [...activeStats].sort((a, b) => b.wins - a.wins)[0] : null

  return (
    <>
      <div className="card">
        <div className="flex-between">
          <h2>统计</h2>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'games' ? 'tab-active' : ''}`} onClick={() => setTab('games')}>
              游戏
            </button>
            <button className={`tab-btn ${tab === 'players' ? 'tab-active' : ''}`} onClick={() => setTab('players')}>
              玩家
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between">
          <h2>赛季</h2>
          <select value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} className="select-inline">
            {seasons.map((s) => (
              <option key={`${s.year}-${s.month}`} value={`${s.year}-${s.month}`}>
                {s.label}
              </option>
            ))}
            <option value="all">全部赛季</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="flex-between">
          <h2>游戏模式</h2>
          <select
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value as GameModeKey)}
            className="select-inline"
          >
            {GAME_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'games' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{activeStats.length}</div>
              <div className="stat-label">参与玩家</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalGames}</div>
              <div className="stat-label">游戏场次</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: statFontSize(topScorer?.userName || '-') }}>
                {topScorer?.userName || '-'}
              </div>
              <div className="stat-label">🏆 积分冠军</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: statFontSize(topWinner?.userName || '-') }}>
                {topWinner?.userName || '-'}
              </div>
              <div className="stat-label">👑 最多胜场</div>
            </div>
          </div>

          {activeStats.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p>
                  暂无{selectedSeason?.label || ''} {GAME_MODES.find((m) => m.key === gameMode)?.label}的统计数据。
                </p>
                <p>先来一局吧！</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>排行榜</h2>
              <div className="score-table">
                <table>
                  <thead>
                    <tr>
                      <th>名次</th>
                      <th>玩家</th>
                      <th className="text-right">场次</th>
                      <th className="text-right">胜场</th>
                      <th className="text-right">积分(RP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStats.map((s, i) => (
                      <tr
                        key={s.playerId}
                        onClick={() => navigate(`/player/${s.playerId}?from=games`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          {i < 3 ? <span className={`rank-number rank-tag-${i + 1}`}>#{i + 1}</span> : <>#{i + 1}</>}
                        </td>
                        <td>
                          <span className="player-name-with-rank">
                            <RankBadge
                              tier={s.tier}
                              size="sm"
                              gamesNeeded={s.tier === 'UNRANKED' ? s.gamesNeeded : undefined}
                            />
                            <span className="player-name">{s.userName}</span>
                          </span>
                        </td>
                        <td className="text-right">{s.gamesPlayed}</td>
                        <td className="text-right">{s.wins}</td>
                        <td className="num-cell-rp">
                          {s.totalRP > 0 ? `+${s.totalRP.toFixed(1)}` : s.totalRP.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {seasonKey !== 'all' && (
            <div className="card best-hand-card">
              <div className="best-hand-header">
                <span className="best-hand-crown">🌟</span>
                <h2>{selectedSeason?.label}最高和牌</h2>
              </div>
              {monthlyBestRoundsError && <p className="error-text">{monthlyBestRoundsError}</p>}
              {!monthlyBestRoundsError && monthlyBestRounds.length === 0 && (
                <div className="empty-state empty-state-compact">
                  <p>本月无记录</p>
                </div>
              )}
              <div className="best-hand-list">
                {monthlyBestRounds.map((round) => (
                  <div key={`${round.sessionId}-${round.roundNumber}`} className="best-hand-item">
                    <div className="best-hand-meta">
                      <span className="best-hand-fan-count">{round.fanCount} 番</span>
                      <span className="best-hand-players">
                        <span className="winner-label">赢家:</span> {round.winnerName}
                        <span className="win-type-label ml-2">({round.dealInPlayerId != null ? '点炮' : '自摸'})</span>
                        <span className="session-link-label ml-2">
                          <Link to={`/session/${round.sessionId}`}>查看对局</Link>
                        </span>
                      </span>
                    </div>
                    <div className="best-hand-display">
                      <MahjongHand hand={round.winHand} details={round.fanDetails} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(bestRounds.length > 0 || !!bestRoundsError) && (
            <div className="card best-hand-card">
              <div className="best-hand-header">
                <span className="best-hand-crown">👑</span>
                <h2>历史最高和牌</h2>
              </div>
              {bestRoundsError && <p className="error-text">{bestRoundsError}</p>}
              <div className="best-hand-list">
                {bestRounds.map((round) => (
                  <div key={`${round.sessionId}-${round.roundNumber}`} className="best-hand-item">
                    <div className="best-hand-meta">
                      <span className="best-hand-fan-count">{round.fanCount} 番</span>
                      <span className="best-hand-players">
                        <span className="winner-label">赢家:</span> {round.winnerName}
                        <span className="win-type-label ml-2">({round.dealInPlayerId != null ? '点炮' : '自摸'})</span>
                        <span className="session-link-label ml-2">
                          <Link to={`/session/${round.sessionId}`}>查看对局</Link>
                        </span>
                      </span>
                    </div>
                    <div className="best-hand-display">
                      <MahjongHand hand={round.winHand} details={round.fanDetails} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'players' && (
        <>
          <div className="card">
            <h2>全部玩家</h2>
            <div className="score-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>用户名</th>
                    <th>姓名</th>
                    <th>段位</th>
                    <th>注册日期</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((p, i) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/player/${p.id}?from=players`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{i + 1}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{p.userName}</td>
                      <td>{abbrName(p.firstName + ' ' + p.lastName)}</td>
                      <td>
                        <span className="player-name-with-rank">
                          <RankBadge
                            tier={p.tier ?? 'UNRANKED'}
                            size="sm"
                            gamesNeeded={p.tier === 'UNRANKED' || !p.tier ? p.gamesNeeded : undefined}
                          />
                          {p.tier && p.tier !== 'UNRANKED' && (
                            <span className="player-tier-rating">{p.skillRating?.toFixed(0)}</span>
                          )}
                        </span>
                      </td>
                      <td>{new Date(p.createdAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {playerRows.length === 0 && (
              <div className="empty-state">
                <p>暂无注册玩家。</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
