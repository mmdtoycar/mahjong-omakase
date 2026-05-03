import React from 'react'
import { Link } from 'react-router-dom'
import { SessionDetail } from '../types'

interface Props {
  session: SessionDetail
}

export const ActiveGameCard: React.FC<Props> = ({ session }) => {
  const getWindName = (w: number) => ['东', '南', '西', '北'][(w - 1) % 4]

  const nextRoundNum = session.rounds.length + 1
  const qf = (Math.floor((nextRoundNum - 1) / 4) % 4) + 1
  const hand = ((nextRoundNum - 1) % 4) + 1
  const roundStatus = `${getWindName(qf)}${hand}`

  const dealerSeat = ((nextRoundNum - 1) % 4) + 1

  return (
    <Link to={`/session/${session.id}`} className="active-game-card">
      <div className="active-game-header">
        <span className="active-game-mode">{session.gameModeDisplayName}</span>
        <span className="badge badge-progress">{roundStatus} 进行中</span>
      </div>
      <div className="active-game-players">
        {[...session.players]
          .sort((a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0))
          .map((p, idx) => {
            const originalIdx = session.players.findIndex((op) => op.id === p.id)
            const seat = p.seat ?? originalIdx + 1
            const menfeng = ((seat - dealerSeat + 4) % 4) + 1
            const isDealer = seat === dealerSeat
            return (
              <div key={p.id} className="active-game-player-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`rank-tag rank-tag-${idx + 1}`} style={{ minWidth: '24px', fontSize: '0.8rem' }}>
                    #{idx + 1}
                  </span>
                  <span
                    className={isDealer ? 'dealer-tag' : ''}
                    style={{
                      fontSize: '0.75rem',
                      padding: '1px 5px',
                      border: `1.5px solid ${isDealer ? 'var(--mj-red)' : 'var(--mj-gold)'}`,
                      color: isDealer ? '#fff' : 'var(--mj-gold)',
                      backgroundColor: isDealer ? 'var(--mj-red)' : 'transparent',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      minWidth: '24px',
                      textAlign: 'center',
                      display: 'inline-block',
                      lineHeight: '1.2',
                    }}
                  >
                    {getWindName(menfeng)}
                  </span>
                  <span className="player-name">{p.userName}</span>
                </div>
                <span className="player-score">{session.totalScores[p.id] || 0}</span>
              </div>
            )
          })}
      </div>
    </Link>
  )
}
