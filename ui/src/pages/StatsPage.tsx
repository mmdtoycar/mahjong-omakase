import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { PlayerStats, Player, GameModeKey, GAME_MODES, getCurrentSeason, BestRound } from '../types'
import { fetchStats, fetchPlayers, fetchBestRounds } from '../api'
import { MahjongHand } from '../components/MahjongHand'
import { RankBadge } from '../components/RankBadge'

type Tab = 'games' | 'players'

const currentSeason = getCurrentSeason()

import { statFontSize, tableNameFontSize } from '../utils/fontSize'
import { parseError, rankMedal, skillRatingText } from '../utils/format'
import { MSG } from '../constants'
import { useActiveSeasons } from '../hooks/useActiveSeasons'
import { useIsMobile } from '../hooks/useIsMobile'

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
  // 内联字号要跟着视口变化重算, 所以断点走订阅式 hook 而不是现场读 window.innerWidth.
  const isMobile = useIsMobile()

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
        setStats(s.sort((a, b) => (b.skillRating ?? 0) - (a.skillRating ?? 0) || b.totalScore - a.totalScore))
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

  // 打过至少一局的玩家(无门槛) — 用于参与玩家/游戏场次计数 + 排行榜(全部赛季也全展示).
  const playedStats = stats.filter((s) => s.gamesPlayed > 0)
  // 全部赛季奖项门槛 = 赛季数(平均每赛季至少一场); 单赛季不设门槛. 仅用于奖项评选, 不影响排行榜.
  const allSeasonMinGames = seasons.length
  const awardStats = seasonKey === 'all' ? playedStats.filter((s) => s.gamesPlayed >= allSeasonMinGames) : playedStats
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
        handWins: stat?.handWins ?? 0,
        dealIns: stat?.dealIns ?? 0,
        avgWinPoints: stat?.avgWinPoints ?? 0,
        avgDealInPoints: stat?.avgDealInPoints ?? 0,
        riichiWins: stat?.riichiWins ?? 0,
        meldWins: stat?.meldWins ?? 0,
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

  const totalGames = playedStats.length > 0 ? Math.max(...playedStats.map((s) => s.gamesPlayed)) : 0

  // 赛季奖项. 单赛季无局数门槛; 全部赛季沿用 awardStats 的 赛季数 门槛.
  // 率: 自摸=自摸/和牌, 胡牌=和牌/局数, 铳=放铳/局数, 1位=1位/总场, 4位=4位/总场.
  const withRounds = awardStats.filter((s) => s.roundsPlayed > 0)
  const withWins = awardStats.filter((s) => s.handWins > 0)
  const winRate = (s: PlayerStats) => s.handWins / s.roundsPlayed
  const tsumoRate = (s: PlayerStats) => s.tsumoWins / s.handWins
  const dealInRate = (s: PlayerStats) => s.dealIns / s.roundsPlayed
  const firstRate = (s: PlayerStats) => s.wins / s.gamesPlayed
  const fourthRate = (s: PlayerStats) => s.fourthPlaces / s.gamesPlayed
  const pick = (arr: PlayerStats[], rate: (s: PlayerStats) => number, dir: 'max' | 'min') =>
    arr.length === 0 ? null : [...arr].sort((a, b) => (dir === 'max' ? rate(b) - rate(a) : rate(a) - rate(b)))[0]
  const topTsumo = pick(withWins, tsumoRate, 'max')
  const topWinRate = pick(withRounds, winRate, 'max')
  const topDealIn = pick(withRounds, dealInRate, 'max')
  const lowDealIn = pick(withRounds, dealInRate, 'min')
  const topFirstRate = pick(awardStats, firstRate, 'max')
  const topFourthRate = pick(awardStats, fourthRate, 'max')
  const lowWinRate = pick(withRounds, winRate, 'min')
  const lowTsumo = pick(withWins, tsumoRate, 'min')

  // 率: 百分号比数字小一号, 避免窄列换行.
  const rateCell = (numerator: number, denominator: number) =>
    denominator > 0 ? (
      <>
        {((numerator / denominator) * 100).toFixed(1)}
        <span className="stat-unit">%</span>
      </>
    ) : (
      '-'
    )

  const riichiMeldCell = (riichiWins: number, meldWins: number, handWins: number) => {
    const riichiRate = handWins > 0 ? ((riichiWins / handWins) * 100).toFixed(1) : '-'
    const meldRate = handWins > 0 ? ((meldWins / handWins) * 100).toFixed(1) : '-'
    return (
      <>
        {riichiRate}/{meldRate}
        <span className="stat-unit">%</span>
      </>
    )
  }

  /** 平均打点/铳点 — 分母为 0 时给 "-", 避免显示 0 误导. */
  const pointsCell = (value: number, count: number) => (count > 0 ? Math.round(value).toLocaleString() : '-')

  const statCard = (value: number | string, label: string) => (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )

  const awardCard = (name: string, sub: string, winner: PlayerStats | null, rate?: number) => (
    <div className="stat-card">
      <div className="stat-value" style={{ fontSize: statFontSize(winner?.userName || '-', isMobile) }}>
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
            {awardCard('🐶 人是打不过狗的', '最高自摸率', topTsumo, topTsumo ? tsumoRate(topTsumo) : undefined)}
            {awardCard('⚰️ 我的牌去哪儿了', '最低自摸率', lowTsumo, lowTsumo ? tsumoRate(lowTsumo) : undefined)}
            {awardCard('💣 二营长', '最高铳率', topDealIn, topDealIn ? dealInRate(topDealIn) : undefined)}
            {awardCard('🐢 龟仙人', '最低铳率', lowDealIn, lowDealIn ? dealInRate(lowDealIn) : undefined)}
            {awardCard('☠️ 阳寿打牌', '最高1位率', topFirstRate, topFirstRate ? firstRate(topFirstRate) : undefined)}
            {awardCard('🤡 小丑皇', '最高4位率', topFourthRate, topFourthRate ? fourthRate(topFourthRate) : undefined)}
            {statCard(playedStats.length, '参与玩家')}
            {statCard(totalGames, '游戏场次')}
          </div>

          {playedStats.length === 0 ? (
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
                <table className="fixed-table stats-table">
                  <thead>
                    <tr>
                      <th className="col-rank">排名</th>
                      <th className="col-name">玩家</th>
                      <th className="col-num">胡率</th>
                      <th className="col-num">铳率</th>
                      <th className="col-rating">段位分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playedStats.map((s, i) => (
                      <tr key={s.playerId} onClick={() => navigate(`/player/${s.playerId}?from=games`)}>
                        <td>{rankMedal(i + 1) ?? <>#{i + 1}</>}</td>
                        <td>
                          <span className="player-name-with-rank">
                            <RankBadge
                              tier={s.tier}
                              size="sm"
                              userName={s.userName}
                              gamesNeeded={s.tier === 'UNRANKED' ? s.gamesNeeded : undefined}
                            />
                            <span
                              className="player-name"
                              title={s.userName}
                              style={{ fontSize: tableNameFontSize(s.userName, isMobile) }}
                            >
                              {s.userName}
                            </span>
                          </span>
                        </td>
                        <td className="num-cell">{rateCell(s.handWins, s.roundsPlayed)}</td>
                        <td className="num-cell">{rateCell(s.dealIns, s.roundsPlayed)}</td>
                        <td className="num-cell-rank">{skillRatingText(s.skillRating, s.tier)}</td>
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
              <table className="fixed-table stats-table">
                <thead>
                  <tr>
                    <th className="col-rank">排名</th>
                    <th className="col-name">玩家</th>
                    <th className="col-num-wide">均位</th>
                    <th className="col-num-wide">平均打点</th>
                    <th className="col-num-wide">平均铳点</th>
                    {gameMode === 'RIICHI' && <th className="col-num-widest">和牌分布</th>}
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((p, i) => (
                    <tr key={p.id} onClick={() => navigate(`/player/${p.id}?from=players`)}>
                      <td>{rankMedal(i + 1) ?? <>#{i + 1}</>}</td>
                      <td>
                        <span className="player-name-with-rank">
                          <RankBadge
                            tier={p.tier ?? 'UNRANKED'}
                            size="sm"
                            userName={p.userName}
                            gamesNeeded={p.tier === 'UNRANKED' || !p.tier ? p.gamesNeeded : undefined}
                          />
                          <span
                            className="player-name"
                            title={p.userName}
                            style={{ fontSize: tableNameFontSize(p.userName, isMobile) }}
                          >
                            {p.userName}
                          </span>
                        </span>
                      </td>
                      <td className="num-cell">{p.totalGames > 0 ? p.avgRank?.toFixed(2) : '-'}</td>
                      <td className="num-cell">{pointsCell(p.avgWinPoints, p.handWins)}</td>
                      <td className="num-cell">{pointsCell(p.avgDealInPoints, p.dealIns)}</td>
                      {gameMode === 'RIICHI' && (
                        <td className="num-cell">{riichiMeldCell(p.riichiWins, p.meldWins, p.handWins)}</td>
                      )}
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
