import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  PlayerStats,
  Player,
  GameModeKey,
  GAME_MODES,
  Season,
  getCurrentSeason,
  getAvailableSeasons,
  BestRound,
} from '../types'
import { fetchStats, fetchPlayers, fetchBestRounds } from '../api'
import { MahjongHand } from '../components/MahjongHand'

type Tab = 'games' | 'players'

const seasons = getAvailableSeasons()
const currentSeason = getCurrentSeason()

import { statFontSize } from '../utils/fontSize'
import { abbrName } from '../utils/format'

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
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }

  const loadPlayers = () => {
    setError('')
    setLoading(true)
    fetchPlayers()
      .then((p) => {
        setPlayers(p)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    if (tab === 'games') {
      loadStats(gameMode, seasonKey)
    } else {
      loadPlayers()
    }
  }, [gameMode, seasonKey, tab])

  useEffect(() => {
    if (tab === 'games') {
      setBestRoundsError('')
      fetchBestRounds()
        .then(setBestRounds)
        .catch((e) => setBestRoundsError(e.message))
    }
  }, [tab])

  useEffect(() => {
    if (tab === 'games' && seasonKey !== 'all') {
      setMonthlyBestRoundsError('')
      setMonthlyBestRounds([])
      const [y, m] = seasonKey.split('-').map(Number)
      fetchBestRounds(y, m)
        .then(setMonthlyBestRounds)
        .catch((e) => {
          setMonthlyBestRoundsError(e.message)
          setMonthlyBestRounds([])
        })
    } else {
      setMonthlyBestRounds([])
      setMonthlyBestRoundsError('')
    }
  }, [tab, seasonKey])

  const abbr = (s: PlayerStats) => abbrName(s.displayName)

  const activeStats = stats.filter((s) => s.gamesPlayed > 0)
  const selectedSeason = seasons.find((s) => `${s.year}-${s.month}` === seasonKey)

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

      {tab === 'games' && (
        <>
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
                      <th style={{ textAlign: 'right' }}>场次</th>
                      <th style={{ textAlign: 'right' }}>胜场</th>
                      <th style={{ textAlign: 'right' }}>
                        积分(RP)
                        <div className="th-subtitle">含局数奖励</div>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        纯积分
                        <div className="th-subtitle">刨除奖励</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStats.map((s, i) => (
                      <tr
                        key={s.playerId}
                        onClick={() => navigate(`/player/${s.playerId}?from=games`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className={i < 3 ? `rank-${i + 1}` : ''}>#{i + 1}</td>
                        <td>
                          {s.userName}
                          <span className="table-username">{abbr(s)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{s.gamesPlayed}</td>
                        <td style={{ textAlign: 'right' }}>{s.wins}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 'bold',
                            color: 'var(--primary)',
                          }}
                        >
                          {s.totalRP > 0 ? `+${s.totalRP.toFixed(1)}` : s.totalRP.toFixed(1)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                          }}
                        >
                          {s.baseRP > 0 ? `+${s.baseRP.toFixed(1)}` : s.baseRP.toFixed(1)}
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
              {monthlyBestRoundsError && <p className="error-text">加载月度最高和牌失败: {monthlyBestRoundsError}</p>}
              {!monthlyBestRoundsError && monthlyBestRounds.length === 0 && (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <p>本月无记录</p>
                </div>
              )}
              <div className="best-hand-list">
                {monthlyBestRounds.map((round, idx) => (
                  <div key={idx} className="best-hand-item">
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

          {bestRounds.length > 0 && (
            <div className="card best-hand-card">
              <div className="best-hand-header">
                <span className="best-hand-crown">👑</span>
                <h2>历史最高和牌</h2>
              </div>
              {bestRoundsError && <p className="error-text">加载历史最高和牌失败: {bestRoundsError}</p>}
              <div className="best-hand-list">
                {bestRounds.map((round, idx) => (
                  <div key={idx} className="best-hand-item">
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
                    <th>注册日期</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/player/${p.id}?from=players`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{i + 1}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{p.userName}</td>
                      <td>{abbrName(p.firstName + ' ' + p.lastName)}</td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {players.length === 0 && (
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
