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
  const fsCardRef = useRef<HTMLDivElement>(null)
  const [fsScale, setFsScale] = useState(1)

  useEffect(() => {
    if (!fullscreen) return
    const compute = () => {
      const el = fsCardRef.current
      if (!el) return
      const s = Math.min((window.innerWidth - 24) / el.offsetWidth, (window.innerHeight - 24) / el.offsetHeight)
      setFsScale(s)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    // position:fixed body 锁滚动(iOS Safari 上 overflow:hidden 不可靠).
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

  useEffect(
    () => () => {
      if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    },
    []
  )

  // 单一 click 计时判断双击, 兼容手机(onDoubleClick 移动端不可靠).
  const handleClick = () => {
    if (!isActive) {
      navigate(`/session/${id}`)
      return
    }
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      setFullscreen(true)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      navigate(`/session/${id}`)
    }, 250)
  }

  const cardBody = (
    <>
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
    </>
  )

  return (
    <>
      <div
        className="game-card"
        role="button"
        tabIndex={0}
        title={isActive ? '单击查看详情 · 双击全屏' : '单击查看详情'}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/session/${id}`)
          }
        }}
      >
        {cardBody}
      </div>

      {fullscreen && (
        <div className="game-fs" onClick={() => setFullscreen(false)}>
          <button type="button" className="game-fs-close" aria-label="关闭" onClick={() => setFullscreen(false)}>
            ✕
          </button>
          <div
            ref={fsCardRef}
            className="game-card game-card-fs"
            style={{ transform: `scale(${fsScale})` }}
            onClick={(e) => e.stopPropagation()}
          >
            {cardBody}
          </div>
        </div>
      )}
    </>
  )
}
