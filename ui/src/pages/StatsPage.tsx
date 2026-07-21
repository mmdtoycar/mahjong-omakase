import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { PlayerStats, Player, GameModeKey, GAME_MODES, getCurrentSeason, BestRound } from '../types'
import { fetchStats, fetchPlayers, fetchBestRounds } from '../api'
import { MahjongHand } from '../components/MahjongHand'
import { RankBadge } from '../components/RankBadge'

type Tab = 'games' | 'players'

const currentSeason = getCurrentSeason()

import { statFontSize, nameFontSize } from '../utils/fontSize'
import { parseError, rankMedal } from '../utils/format'
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

  // 全部赛季门槛随赛季数增长(5 + 赛季数): 抬高全时段榜的样本要求, 让持续活跃的玩家够线、
  // 只打过几场就消失的旧玩家随时间被筛掉; 单个赛季不设门槛.
  const allSeasonMinGames = 5 + seasons.length
  const activeStats = stats.filter(
    (s) => s.gamesPlayed > 0 && (seasonKey !== 'all' || s.gamesPlayed >= allSeasonMinGames)
  )
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
        avgRank: stat?.avgRank,
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

  // 赛季奖项. 单赛季无局数门槛; 全部赛季沿用 activeStats 的 ≥10 场门槛. 自摸率=自摸/和牌, 胡牌率=和牌/局数, 铳率=放铳/局数.
  const withRounds = activeStats.filter((s) => s.roundsPlayed > 0)
  const withWins = activeStats.filter((s) => s.handWins > 0)
  const winRate = (s: PlayerStats) => s.handWins / s.roundsPlayed
  const tsumoRate = (s: PlayerStats) => s.tsumoWins / s.handWins
  const dealInRate = (s: PlayerStats) => s.dealIns / s.roundsPlayed
  const pick = (arr: PlayerStats[], rate: (s: PlayerStats) => number, dir: 'max' | 'min') =>
    arr.length === 0 ? null : [...arr].sort((a, b) => (dir === 'max' ? rate(b) - rate(a) : rate(a) - rate(b)))[0]
  const topTsumo = pick(withWins, tsumoRate, 'max')
  const topWinRate = pick(withRounds, winRate, 'max')
  const topDealIn = pick(withRounds, dealInRate, 'max')
  const lowDealIn = pick(withRounds, dealInRate, 'min')
  const lowWinRate = pick(withRounds, winRate, 'min')
  const lowTsumo = pick(withWins, tsumoRate, 'min')

  const statCard = (value: number | string, label: string) => (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )

  const awardCard = (name: string, sub: string, winner: PlayerStats | null, rate?: number) => (
    <div className="stat-card">
      <div className="stat-value" style={{ fontSize: statFontSize(winner?.userName || '-') }}>
        {winner?.userName || '-'}
      </div>
      <div className="stat-label">{name}</div>
      <div className="stat-sublabel">
        {sub}
        {winner && rate != null ? ` · ${(rate * 100).toFixed(0)}%` : ''}
      </div>
    </div>
  )

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
            {awardCard('🧿 真•赤木', '最高胡牌率', topWinRate, topWinRate ? winRate(topWinRate) : undefined)}
            {awardCard('🪣 水缸坐穿', '最低胡牌率', lowWinRate, lowWinRate ? winRate(lowWinRate) : undefined)}
            {awardCard('🐕 人是打不过狗的', '最高自摸率', topTsumo, topTsumo ? tsumoRate(topTsumo) : undefined)}
            {awardCard('⚰️ 我的牌去哪儿了', '最低自摸率', lowTsumo, lowTsumo ? tsumoRate(lowTsumo) : undefined)}
            {awardCard('💣 二营长', '最高铳率', topDealIn, topDealIn ? dealInRate(topDealIn) : undefined)}
            {awardCard('🐢 龟仙人', '最低铳率', lowDealIn, lowDealIn ? dealInRate(lowDealIn) : undefined)}
            {statCard(activeStats.length, '参与玩家')}
            {statCard(totalGames, '游戏场次')}
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
              <div className="table-wrap">
                <table className="fixed-table">
                  <thead>
                    <tr>
                      <th className="col-rank">排名</th>
                      <th className="col-name">玩家</th>
                      <th className="col-num">胜场</th>
                      <th className="col-num">场均</th>
                      <th className="col-num-wide">积分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStats.map((s, i) => (
                      <tr
                        key={s.playerId}
                        onClick={() => navigate(`/player/${s.playerId}?from=games`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{rankMedal(i + 1) ?? <>#{i + 1}</>}</td>
                        <td>
                          <span className="player-name-with-rank">
                            <RankBadge
                              tier={s.tier}
                              size="sm"
                              userName={s.userName}
                              gamesNeeded={s.tier === 'UNRANKED' ? s.gamesNeeded : undefined}
                            />
                            <span className="player-name" style={{ fontSize: nameFontSize(s.userName) }}>
                              {s.userName}
                            </span>
                          </span>
                        </td>
                        <td className="num-cell">
                          {s.wins}
                          <span
                            style={{
                              fontSize: '0.6rem',
                              color: 'var(--text-light)',
                              verticalAlign: 'bottom',
                              marginLeft: 2,
                            }}
                          >
                            ({((s.wins / s.gamesPlayed) * 100).toFixed(0)}%)
                          </span>
                        </td>
                        <td
                          className="num-cell"
                          style={{
                            color: s.avgScore > 0 ? 'var(--success)' : s.avgScore < 0 ? 'var(--danger)' : undefined,
                          }}
                        >
                          {s.avgScore > 0 ? `+${s.avgScore.toFixed(0)}` : s.avgScore.toFixed(0)}
                        </td>
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
              <div>
                {monthlyBestRounds.map((round) => (
                  <div key={`${round.sessionId}-${round.roundNumber}`} className="best-hand-item">
                    <div className="best-hand-meta">
                      <span className="best-hand-fan-count">{round.fanCount} 番</span>
                      <span className="best-hand-players">
                        <span className="winner-label">赢家:</span> {round.winnerName}
                        <span className="ml-2">({round.dealInPlayerId != null ? '点炮' : '自摸'})</span>
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
              <div>
                {bestRounds.map((round) => (
                  <div key={`${round.sessionId}-${round.roundNumber}`} className="best-hand-item">
                    <div className="best-hand-meta">
                      <span className="best-hand-fan-count">{round.fanCount} 番</span>
                      <span className="best-hand-players">
                        <span className="winner-label">赢家:</span> {round.winnerName}
                        <span className="ml-2">({round.dealInPlayerId != null ? '点炮' : '自摸'})</span>
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
            <div className="table-wrap">
              <table className="fixed-table">
                <thead>
                  <tr>
                    <th className="col-rank">排名</th>
                    <th className="col-name">玩家</th>
                    <th className="col-num-wide">平均排名</th>
                    <th className="col-num-wide">段位分</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((p, i) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/player/${p.id}?from=players`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{rankMedal(i + 1) ?? <>#{i + 1}</>}</td>
                      <td>
                        <span className="player-name-with-rank">
                          <RankBadge
                            tier={p.tier ?? 'UNRANKED'}
                            size="sm"
                            userName={p.userName}
                            gamesNeeded={p.tier === 'UNRANKED' || !p.tier ? p.gamesNeeded : undefined}
                          />
                          <span className="player-name" style={{ fontSize: nameFontSize(p.userName) }}>
                            {p.userName}
                          </span>
                        </span>
                      </td>
                      <td className="num-cell">{p.totalGames > 0 ? p.avgRank?.toFixed(2) : '-'}</td>
                      <td className="num-cell-rp">
                        {p.tier && p.tier !== 'UNRANKED' ? p.skillRating?.toFixed(0) : '-'}
                      </td>
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
