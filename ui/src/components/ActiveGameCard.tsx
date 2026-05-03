import React from 'react'
import { Link } from 'react-router-dom'
import { SessionDetail } from '../types'

interface Props {
  session: SessionDetail
}

export const ActiveGameCard: React.FC<Props> = ({ session }) => {
  const getWindName = (w: number) => ['东', '南', '西', '北'][(w - 1) % 4]

  const nextRoundNum = session.rounds.length + 1
  const lastRound = session.rounds.length > 0 ? session.rounds[session.rounds.length - 1] : null
  let qf = (Math.floor((nextRoundNum - 1) / 4) % 4) + 1
  if (lastRound?.prevalentWind != null && lastRound?.roundNum != null) {
    const nextGroup = Math.floor((nextRoundNum - 1) / 4)
    const lastGroup = Math.floor((lastRound.roundNum - 1) / 4)
    qf = ((lastRound.prevalentWind - 1 + (nextGroup - lastGroup)) % 4) + 1
  }
  const hand = ((nextRoundNum - 1) % 4) + 1
  const roundStatus = `${getWindName(qf)}${hand}`

  const dealerSeat = ((nextRoundNum - 1) % 4) + 1

  // Compute stable standard ranks from scores
  const sortedScores = session.players.map((p) => session.totalScores[p.id] || 0).sort((a, b) => b - a)
  const getRank = (score: number) => sortedScores.indexOf(score) + 1

  return (
    <Link to={`/session/${session.id}`} className="active-game-card">
      <div className="active-game-header">
        <span className="active-game-mode">{session.gameModeDisplayName}</span>
        <span className="badge badge-progress">{roundStatus} 进行中</span>
      </div>
      <div className="active-game-players">
        {[...session.players]
          .sort((a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0))
          .map((p) => {
            const score = session.totalScores[p.id] || 0
            const rank = getRank(score)
            const originalIdx = session.players.findIndex((op) => op.id === p.id)
            const seat = p.seat ?? originalIdx + 1
            const menfeng = ((seat - dealerSeat + 4) % 4) + 1
            const isDealer = seat === dealerSeat
            return (
              <div key={p.id} className="active-game-player-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`rank-tag rank-tag-${rank}`} style={{ minWidth: '24px', fontSize: '0.8rem' }}>
                    #{rank}
                  </span>
                  <span className={`wind-tag ${isDealer ? 'wind-tag-dealer' : ''}`}>{getWindName(menfeng)}</span>
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
