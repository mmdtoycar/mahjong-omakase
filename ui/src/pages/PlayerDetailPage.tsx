import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPlayerDetail } from '../api'
import { PlayerDetail } from '../types'
import { abbrName, scoreClass } from '../utils/format'
import { MSG } from '../constants'

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setPlayer(null)
    setError('')
    setLoading(true)
    fetchPlayerDetail(Number(id))
      .then((p) => {
        setPlayer(p)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : MSG.ERROR)
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
        <h2>{player.userName}</h2>
        <span className="session-meta">{abbrName(player.firstName + ' ' + player.lastName)}</span>
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
