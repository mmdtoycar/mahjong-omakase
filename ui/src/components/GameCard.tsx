import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { scoreClass, seatRankMedal } from '../utils/format'
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
  const [fullscreen, setFullscreen] = useState(false)

  // Esc 关闭全屏; 打开时锁滚动.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [fullscreen])

  return (
    <>
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
            {isActive && (
              <button
                type="button"
                className="game-card-fs-btn"
                aria-label="全屏查看"
                title="全屏查看"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setFullscreen(true)
                }}
              >
                ⛶
              </button>
            )}
          </div>
        </div>
        <div className="session-card-players">
          {players.map((p, idx) => (
            <div key={idx} className="player-rank-item">
              <span className="player-name-with-rank">
                <span className={`rank-number${p.rank <= 4 ? ` rank-tag-${p.rank}` : ''}`}>
                  {seatRankMedal(p.rank) ?? `#${p.rank}`}
                </span>
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

      {fullscreen && (
        <div className="game-fs" role="dialog" aria-modal="true" onClick={() => setFullscreen(false)}>
          <div className="game-fs-panel" onClick={(e) => e.stopPropagation()}>
            <div className="game-fs-header">
              <span className="mode-text">{gameModeDisplayName}</span>
              <TableStrengthTag table={tableStrength} size="md" />
              <button type="button" className="game-fs-close" aria-label="关闭" onClick={() => setFullscreen(false)}>
                ✕
              </button>
            </div>
            <div className="game-fs-players">
              {players.map((p, idx) => (
                <div key={idx} className="game-fs-row">
                  <span className={`game-fs-rank${p.rank <= 4 ? ` rank-tag-${p.rank}` : ''}`}>
                    {seatRankMedal(p.rank) ?? `#${p.rank}`}
                  </span>
                  {p.wind && <span className={`wind-tag ${p.isDealer ? 'wind-tag-dealer' : ''}`}>{p.wind}</span>}
                  <span className="game-fs-name">{p.name}</span>
                  <span className={`game-fs-score ${scoreClass(p.score)}`}>
                    {p.score > 0 ? `+${p.score}` : p.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
