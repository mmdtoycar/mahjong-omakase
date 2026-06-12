import React from 'react'
import { Link } from 'react-router-dom'
import { scoreClass } from '../utils/format'
import { TierKey } from '../types'
import { RankBadge } from './RankBadge'
import { TableStrengthTag } from './TableStrengthTag'

interface PlayerEntry {
  rank: number
  name: string
  score: number
  wind?: string
  isDealer?: boolean
  tier?: TierKey | null
}

interface Props {
  id: number
  gameModeDisplayName: string
  createdAt: string
  roundLabel: string
  isActive: boolean
  players: PlayerEntry[]
  tableStrength?: string | null
}

export const GameCard: React.FC<Props> = ({
  id,
  gameModeDisplayName,
  createdAt,
  roundLabel,
  isActive,
  players,
  tableStrength,
}) => {
  return (
    <Link to={`/session/${id}`} className="game-card">
      <div className="session-card-header">
        <div>
          <span className="mode-text">{gameModeDisplayName}</span>
          <TableStrengthTag table={tableStrength} />
        </div>
        <div className="session-card-meta">
          <span className="session-card-date">
            {new Date(createdAt).toLocaleString([], {
              timeZone: 'America/Los_Angeles',
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
              <RankBadge tier={p.tier} size="sm" />
              <span className="player-name">{p.name}</span>
            </div>
            <span className={`player-score ${scoreClass(p.score)}`}>{p.score > 0 ? `+${p.score}` : p.score}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}
