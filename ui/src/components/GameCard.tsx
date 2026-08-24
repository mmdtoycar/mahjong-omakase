import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scoreClass, seatRankMedal } from '../utils/format'
import { tableNameFontSize } from '../utils/fontSize'
import { useIsMobile } from '../hooks/useIsMobile'
import { TierKey } from '../types'
import { RankBadge } from './RankBadge'
import { TableStrengthTag } from './TableStrengthTag'

// Fullscreen API with webkit fallback + feature-detection (Safari/iPadOS use webkit*; iPhone has neither).
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void }
const fsElement = () => document.fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null
const requestFs = (el: FsEl) => {
  const fn = el.requestFullscreen ?? el.webkitRequestFullscreen
  if (fn) Promise.resolve(fn.call(el)).catch(() => {})
}
const exitFs = () => {
  const fn = document.exitFullscreen ?? (document as FsDoc).webkitExitFullscreen
  if (fn) Promise.resolve(fn.call(document)).catch(() => {})
}

export const GAME_DURATION_MS = 60 * 60 * 1000
export const TIMER_WARNING_MS = 10 * 60 * 1000

export function remainingMs(createdAt: string, now: number): number {
  return GAME_DURATION_MS - (now - new Date(createdAt).getTime())
}

export function timerState(createdAt: string, now: number): 'normal' | 'warning' | 'expired' {
  const remaining = remainingMs(createdAt, now)
  if (remaining <= 0) return 'expired'
  if (remaining <= TIMER_WARNING_MS) return 'warning'
  return 'normal'
}

export function formatRemaining(createdAt: string, now: number): string {
  const remaining = Math.max(0, remainingMs(createdAt, now))
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

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
  const isMobile = useIsMobile()
  const [fullscreen, setFullscreen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!fullscreen || !isActive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [fullscreen, isActive])

  useEffect(() => {
    if (!fullscreen) return
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const handleFsChange = () => {
      if (!fsElement()) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
    }
  }, [fullscreen])

  const openFullscreen = () => {
    setNow(Date.now())
    setFullscreen(true)
    if (!fsElement()) requestFs(document.documentElement)
  }

  const closeFullscreen = () => {
    if (fsElement()) exitFs()
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
      <div className="game-card" onClick={handleCardClick}>
        <div className="session-card-header">
          <div className="session-card-mode">
            <span className="mode-text">{gameModeDisplayName}</span>
            <TableStrengthTag table={tableStrength} />
          </div>
          <div className="session-card-meta">
            <span className="session-card-date">
              {new Date(createdAt).toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
            <span className={`badge badge-sm ${isActive ? 'badge-progress' : 'badge-completed'}`}>{roundLabel}</span>
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
                <span className="player-name" style={{ fontSize: tableNameFontSize(p.name, isMobile) }}>
                  {p.name}
                </span>
              </span>
              <span className={`player-score ${scoreClass(p.score)}`}>{p.score > 0 ? `+${p.score}` : p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {fullscreen && (
        <div
          className={`game-fs-overlay${isActive ? ` game-fs-overlay-${timerState(createdAt, now)}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="全屏看盘"
        >
          <div className="game-fs-topbar">
            <div className="game-fs-title-area">
              <span className="game-fs-mode">{gameModeDisplayName}</span>
              <TableStrengthTag table={tableStrength} />
              <span className="game-fs-date">
                {new Date(createdAt).toLocaleString('en-US', {
                  timeZone: 'America/Los_Angeles',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
            <div className="game-fs-actions">
              <button type="button" className="game-fs-btn game-fs-close-btn" onClick={closeFullscreen}>
                ✕ 退出全屏
              </button>
            </div>
          </div>

          <div className="game-fs-main">
            <div className="game-fs-scoreboard-col">
              <div className={`badge game-fs-round-badge ${isActive ? 'badge-progress' : 'badge-completed'}`}>
                {isActive && <span className="pulse-dot" />}
                {roundLabel}
              </div>
              {isActive && (
                <div className={`game-fs-timer-banner game-fs-timer-${timerState(createdAt, now)}`}>
                  {timerState(createdAt, now) === 'expired' ? '时间到' : `⏱ ${formatRemaining(createdAt, now)}`}
                </div>
              )}
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
          </div>
        </div>
      )}
    </>
  )
}
