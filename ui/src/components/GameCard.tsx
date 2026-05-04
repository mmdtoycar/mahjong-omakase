import React from 'react'
import { Link } from 'react-router-dom'
import { scoreClass } from '../utils/format'

interface PlayerEntry {
  rank: number
  name: string
  score: number
  wind?: string
  isDealer?: boolean
}

interface Props {
  id: number
  gameModeDisplayName: string
  createdAt: string
  roundLabel: string
  isActive: boolean
  players: PlayerEntry[]
}

export const GameCard: React.FC<Props> = ({ id, gameModeDisplayName, createdAt, roundLabel, isActive, players }) => {
  return (
    <Link to={`/session/${id}`} className="game-card">
      <div className="session-card-header">
        <div className="session-card-mode">
          <span className="mode-text">{gameModeDisplayName}</span>
        </div>
        <div className="session-card-meta">
          <span className="session-card-date">
            {new Date(createdAt).toLocaleString([], {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className={`badge badge-sm ${isActive ? 'badge-progress' : 'badge-completed'}`}>{roundLabel}</span>
        </div>
      </div>
      <div className="session-card-players">
        {players.map((p, idx) => (
          <div key={idx} className={`player-rank-item rank-${p.rank}`}>
            <div className="player-rank-main">
              <span className="rank-number">#{p.rank}</span>
              {p.wind && <span className={`wind-tag ${p.isDealer ? 'wind-tag-dealer' : ''}`}>{p.wind}</span>}
              <span className="player-name">{p.name}</span>
            </div>
            <span className={`player-score ${scoreClass(p.score)}`}>{p.score > 0 ? `+${p.score}` : p.score}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}
