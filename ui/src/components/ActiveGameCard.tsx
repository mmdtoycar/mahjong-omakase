import React from 'react'
import { Link } from 'react-router-dom'
import { SessionDetail } from '../types'
import { deriveGameState, getWindName } from '../utils/gameState'

interface Props {
  session: SessionDetail
}

export const ActiveGameCard: React.FC<Props> = ({ session }) => {
  const state = deriveGameState(session)

  const sortedScores = session.players.map((p) => session.totalScores[p.id] || 0).sort((a, b) => b - a)
  const getRank = (score: number) => sortedScores.indexOf(score) + 1

  return (
    <Link to={`/session/${session.id}`} className="active-game-card">
      <div className="active-game-header">
        <span className="active-game-mode">{session.gameModeDisplayName}</span>
        <div className="session-card-meta">
          <span className="session-card-date">
            {new Date(session.createdAt).toLocaleString([], {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="badge badge-progress">{state.displayName} 进行中</span>
        </div>
      </div>
      <div className="active-game-players">
        {[...session.players]
          .sort((a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0))
          .map((p) => {
            const score = session.totalScores[p.id] || 0
            const rank = getRank(score)
            const seat = p.seat ?? session.players.findIndex((op) => op.id === p.id) + 1
            const menfeng = ((seat - state.dealerSeat + state.playerCount) % state.playerCount) + 1
            const isDealer = p.id === state.dealerPlayerId
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
