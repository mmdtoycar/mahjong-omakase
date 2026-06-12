import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPlayerDetail, fetchPlayerTier } from '../api'
import { PlayerDetail, PlayerTierResponse } from '../types'
import { abbrName, scoreClass, parseError } from '../utils/format'
import { MSG } from '../constants'
import { RankBadge } from '../components/RankBadge'

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [tier, setTier] = useState<PlayerTierResponse | null>(null)
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
              <div className="player-detail-tier-cell">
                <span className="player-detail-tier-mode">国标</span>
                <RankBadge
                  tier={tier.guobiao.tier}
                  size="md"
                  userName={tier.userName}
                  rating={tier.guobiao.tier === 'UNRANKED' ? undefined : tier.guobiao.rating}
                  gamesNeeded={tier.guobiao.gamesNeeded}
                />
              </div>
              <div className="player-detail-tier-cell">
                <span className="player-detail-tier-mode">立直</span>
                <RankBadge
                  tier={tier.riichi.tier}
                  size="md"
                  userName={tier.userName}
                  rating={tier.riichi.tier === 'UNRANKED' ? undefined : tier.riichi.rating}
                  gamesNeeded={tier.riichi.gamesNeeded}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>游戏记录 ({player.games.length})</h2>
        {player.games.length === 0 ? (
          <div className="empty-state">
            <p>暂无游戏记录。</p>
          </div>
        ) : (
          <div className="score-table">
            <table>
              <thead>
                <tr>
                  <th>游戏</th>
                  <th>模式</th>
                  <th>日期</th>
                  <th>状态</th>
                  <th className="text-right">分数</th>
                </tr>
              </thead>
              <tbody>
                {player.games.map((g) => (
                  <tr
                    key={g.sessionId}
                    onClick={() => navigate(`/session/${g.sessionId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{g.sessionName || `Game #${g.sessionId}`}</td>
                    <td>{g.gameModeDisplayName}</td>
                    <td>{new Date(g.createdAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}</td>
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
