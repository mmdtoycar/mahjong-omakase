import React from 'react'
import { Link } from 'react-router-dom'
import { scoreClass } from '../utils/format'
import { nameFontSize } from '../utils/fontSize'
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
        <div className="session-card-mode">
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
          <div key={idx} className="player-rank-item">
            <span className="player-name-with-rank">
              <span className={`rank-number${p.rank <= 3 ? ` rank-tag-${p.rank}` : ''}`}>#{p.rank}</span>
              {p.wind && <span className={`wind-tag ${p.isDealer ? 'wind-tag-dealer' : ''}`}>{p.wind}</span>}
              <RankBadge tier={p.tier} size="sm" userName={p.name} />
              <span className="player-name" style={{ fontSize: nameFontSize(p.name) }}>
                {p.name}
              </span>
            </span>
            <span className={`player-score ${scoreClass(p.score)}`}>{p.score > 0 ? `+${p.score}` : p.score}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}
