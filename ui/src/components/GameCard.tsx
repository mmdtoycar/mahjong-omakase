import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [fullscreen, setFullscreen] = useState(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreen()
      }
    }
    document.addEventListener('keydown', onKey)
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
    }
  }, [fullscreen])

  const openFullscreen = () => {
    setFullscreen(true)
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  const closeFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    setFullscreen(false)
  }

  const handleCardClick = () => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      openFullscreen()
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      navigate(`/session/${id}`)
    }, 250)
  }

  return (
    <>
      <div
        className="game-card"
        role="button"
        tabIndex={0}
        title="单击查看详情 · 双击全屏看盘"
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/session/${id}`)
          }
        }}
      >
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
            <button
              type="button"
              className="btn-card-fullscreen"
              title="全屏看盘"
              aria-label="全屏看盘"
              onClick={(e) => {
                e.stopPropagation()
                openFullscreen()
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
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
      </div>

      {fullscreen && (
        <div className="game-fs-overlay" role="dialog" aria-modal="true">
          <div className="game-fs-topbar">
            <div className="game-fs-title-area">
              <span className="game-fs-mode">{gameModeDisplayName}</span>
              <TableStrengthTag table={tableStrength} />
              <span className={`badge ${isActive ? 'badge-progress' : 'badge-completed'}`}>
                {isActive && <span className="pulse-dot" />}
                {roundLabel}
              </span>
              <span className="game-fs-date">
                {new Date(createdAt).toLocaleString([], {
                  timeZone: 'America/Los_Angeles',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="game-fs-actions">
              <button
                type="button"
                className="game-fs-btn game-fs-close-btn"
                title="退出全屏 (Esc)"
                onClick={closeFullscreen}
              >
                ✕ 退出全屏
              </button>
            </div>
          </div>

          <div className="game-fs-main">
            <div className="game-fs-scoreboard-col">
              {players.map((p, idx) => (
                <div key={idx} className={`game-fs-player-card ${p.isDealer ? 'is-dealer' : ''} rank-${p.rank}`}>
                  <div className="game-fs-player-left">
                    <div className="game-fs-rank-badge">{seatRankMedal(p.rank) ?? `#${p.rank}`}</div>
                    <div className="game-fs-player-info">
                      <div className="game-fs-player-name-row">
                        {p.wind && (
                          <span className={`wind-tag ${p.isDealer ? 'wind-tag-dealer' : ''}`}>
                            {p.wind} {p.isDealer && '庄'}
                          </span>
                        )}
                        <RankBadge tier={p.tier} size="md" userName={p.name} />
                        <span className="game-fs-player-name">{p.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`game-fs-player-score ${scoreClass(p.score)}`}>
                    {p.score > 0 ? `+${p.score}` : p.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="game-fs-footer">
            <button
              type="button"
              className="game-fs-detail-link"
              onClick={() => {
                closeFullscreen()
                navigate(`/session/${id}`)
              }}
            >
              进入对局详情页 ➔
            </button>
            <span className="game-fs-tip">按 Esc 键可退出全屏</span>
          </div>
        </div>
      )}
    </>
  )
}
