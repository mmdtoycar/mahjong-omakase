import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchStats, fetchPlayers } from '../api'
import { PlayerStats, Player, GameModeKey, GAME_MODES, Season, getCurrentSeason, getAvailableSeasons } from '../types'

type Tab = 'games' | 'players'

const seasons = getAvailableSeasons()
const currentSeason = getCurrentSeason()

export default function StatsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'games'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [gameMode, setGameMode] = useState<GameModeKey>(GAME_MODES[0].key)
  const [seasonKey, setSeasonKey] = useState<string>(`${currentSeason.year}-${currentSeason.quarter}`)

  const loadStats = (mode: GameModeKey, sKey: string) => {
    setLoading(true)
    let year: number | undefined
    let quarter: number | undefined
    if (sKey !== 'all') {
      const [y, q] = sKey.split('-').map(Number)
      year = y
      quarter = q
    }
    fetchStats(mode, year, quarter).then(s => {
      setStats(s.sort((a, b) => b.totalScore - a.totalScore))
      setLoading(false)
    })
  }

  const loadPlayers = () => {
    setLoading(true)
    fetchPlayers().then(p => {
      setPlayers(p)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (tab === 'games') loadStats(gameMode, seasonKey)
    else loadPlayers()
  }, [gameMode, seasonKey, tab])

  const abbr = (s: PlayerStats) => `${s.displayName.split(' ')[0][0]}.${s.displayName.split(' ').slice(1).join(' ')}`

  const activeStats = stats.filter(s => s.gamesPlayed > 0)
  const selectedSeason = seasons.find(s => `${s.year}-${s.quarter}` === seasonKey)

  if (loading) return <div className="empty-state"><p>加载中...</p></div>

  const totalGames = activeStats.length > 0 ? Math.max(...activeStats.map(s => s.gamesPlayed)) : 0
  const topScorer = activeStats[0]
  const topWinner = activeStats.length > 0 ? [...activeStats].sort((a, b) => b.wins - a.wins)[0] : null

  return (
    <>
      <div className="card">
        <div className="flex-between">
          <h2>统计</h2>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'games' ? 'tab-active' : ''}`} onClick={() => setTab('games')}>游戏</button>
            <button className={`tab-btn ${tab === 'players' ? 'tab-active' : ''}`} onClick={() => setTab('players')}>玩家</button>
          </div>
        </div>
      </div>

      {tab === 'games' && (
        <>
          <div className="card">
            <div className="flex-between">
              <h2>赛季</h2>
              <select
                value={seasonKey}
                onChange={e => setSeasonKey(e.target.value)}
                style={{ width: 'auto', minWidth: 160 }}
              >
                {seasons.map(s => (
                  <option key={`${s.year}-${s.quarter}`} value={`${s.year}-${s.quarter}`}>{s.label}</option>
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
                onChange={e => setGameMode(e.target.value as GameModeKey)}
                style={{ width: 'auto', minWidth: 120 }}
              >
                {GAME_MODES.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
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
              <div className="stat-value">{topScorer?.userName || '-'}</div>
              <div className="stat-label">🏆 赛季冠军</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{topWinner?.userName || '-'}</div>
              <div className="stat-label">👑 最多胜场</div>
            </div>
          </div>

          {activeStats.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p>暂无{selectedSeason?.label || ''} {GAME_MODES.find(m => m.key === gameMode)?.label}的统计数据。先来一局吧！</p>
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
                    <th style={{ textAlign: 'right' }}>总分</th>
                    <th style={{ textAlign: 'right' }}>均分</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStats.map((s, i) => (
                    <tr key={s.playerId} onClick={() => navigate(`/player/${s.playerId}?from=games`)} style={{ cursor: 'pointer' }}>
                      <td className={i < 3 ? `rank-${i + 1}` : ''}>#{i + 1}</td>
                      <td>
                        {s.userName}
                        <span className="table-username">{abbr(s)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{s.gamesPlayed}</td>
                      <td style={{ textAlign: 'right' }}>{s.wins}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.totalScore}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {s.avgScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <tr key={p.id} onClick={() => navigate(`/player/${p.id}?from=players`)} style={{ cursor: 'pointer' }}>
                    <td>{i + 1}</td>
                    <td>{p.userName}</td>
                    <td>{p.firstName[0]}.{p.lastName}</td>
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
