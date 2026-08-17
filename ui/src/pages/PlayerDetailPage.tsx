import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPlayerDetail, fetchPlayerTier } from '../api'
import { PlayerDetail, PlayerTierResponse, GameModeKey, GAME_MODES } from '../types'
import { abbrName, scoreClass, parseError } from '../utils/format'
import { MSG } from '../constants'
import { RankBadge } from '../components/RankBadge'

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [tier, setTier] = useState<PlayerTierResponse | null>(null)
  const [statsMode, setStatsMode] = useState<GameModeKey>(GAME_MODES[0].key)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setPlayer(null)
    setTier(null)
    setError('')
    setLoading(true)
    Promise.all([fetchPlayerDetail(Number(id)), fetchPlayerTier(Number(id))])
      .then(([p, t]) => {
        setPlayer(p)
        setTier(t)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(parseError(e))
        setLoading(false)
      })
  }, [id])

  if (loading)
    return (
      <div className="empty-state">
        <p>{MSG.LOADING}</p>
      </div>
    )
  if (error || !player)
    return (
      <div className="empty-state">
        <p>{error || '玩家不存在'}</p>
      </div>
    )

  return (
    <>
      <div className="card">
        <div className="player-detail-header">
          <div className="player-detail-name">
            <h2>{player.userName}</h2>
            <span className="session-meta">{abbrName(player.firstName + ' ' + player.lastName)}</span>
          </div>
          {tier && (
            <div className="player-detail-tiers">
              {(
                [
                  ['国标', tier.guobiao],
                  ['立直', tier.riichi],
                  ['东北', tier.dongbei],
                ] as const
              ).map(([label, info]) => (
                <div key={label} className="player-detail-tier-cell">
                  <span className="player-detail-tier-mode">{label}</span>
                  <RankBadge
                    tier={info.tier}
                    size="md"
                    userName={tier.userName}
                    rating={info.rating}
                    gamesNeeded={info.gamesNeeded}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>🪪 数据统计</h2>
          <select
            value={statsMode}
            onChange={(e) => setStatsMode(e.target.value as GameModeKey)}
            className="select-inline"
          >
            {GAME_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {(() => {
          const stats = player.statsByMode?.[statsMode]
          if (!stats || stats.roundsPlayed === 0) {
            return (
              <div className="empty-state empty-state-compact">
                <p>本模式暂无数据统计。</p>
              </div>
            )
          }
          return (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">
                  {((stats.handWins / stats.roundsPlayed) * 100).toFixed(1)}%
                  {stats.handWins > 0 && (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        color: 'var(--text-light)',
                        verticalAlign: 'bottom',
                        marginLeft: 2,
                      }}
                    >
                      ({((stats.tsumoWins / stats.handWins) * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div className="stat-label">和牌率(自摸率)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{((stats.dealIns / stats.roundsPlayed) * 100).toFixed(1)}%</div>
                <div className="stat-label">放铳率</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.handWins > 0 ? Math.round(stats.avgWinPoints).toLocaleString() : '-'}
                </div>
                <div className="stat-label">平均打点</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.dealIns > 0 ? Math.round(stats.avgDealInPoints).toLocaleString() : '-'}
                </div>
                <div className="stat-label">平均铳点</div>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="card">
        <h2>游戏记录 ({player.games.length})</h2>
        {player.games.length === 0 ? (
          <div className="empty-state">
            <p>暂无游戏记录。</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="auto-table">
              <thead>
                <tr>
                  <th>游戏</th>
                  <th style={{ whiteSpace: 'nowrap' }}>模式</th>
                  <th style={{ whiteSpace: 'nowrap' }}>日期</th>
                  <th>状态</th>
                  <th className="text-right">分数</th>
                </tr>
              </thead>
              <tbody>
                {player.games.map((g) => (
                  <tr key={g.sessionId} onClick={() => navigate(`/session/${g.sessionId}`)}>
                    <td>#{g.sessionId}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{g.gameModeDisplayName}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(g.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                    </td>
                    <td>
                      <span className={`badge ${g.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                        {g.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
                      </span>
                    </td>
                    <td className={`${scoreClass(g.totalScore)} num-cell`}>
                      {g.totalScore > 0 ? `+${g.totalScore}` : g.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
