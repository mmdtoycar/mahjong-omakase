import React, { useState } from 'react'
import { Player } from '../types'
import { cardFontSize } from '../utils/fontSize'
import { useIsMobile } from '../hooks/useIsMobile'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface SeatAssignmentModalProps {
  players: Player[]
  onCancel: () => void
  onConfirm: (orderedPlayerIds: number[]) => void
  creating: boolean
  error: string
}

const SeatCard: React.FC<{ name: string; wind: string; isMobile: boolean }> = ({ name, wind, isMobile }) => (
  <div className="seat-card">
    <div className="seat-card-wind">{wind}</div>
    <div className="seat-card-name" style={{ fontSize: cardFontSize(name, isMobile) }}>
      {name}
    </div>
  </div>
)

/** Mount only while open — the shuffle below runs once, on mount. */
export const SeatAssignmentModal: React.FC<SeatAssignmentModalProps> = ({
  players,
  onCancel,
  onConfirm,
  creating,
  error,
}) => {
  const isMobile = useIsMobile()
  const [seated] = useState(() => shuffle(players))

  return (
    <div className="modal-backdrop" onClick={creating ? undefined : onCancel}>
      <div
        className="modal-card seat-assign-modal"
        role="dialog"
        aria-modal="true"
        aria-label="座位分配"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="photo-rec-title">
            <span className="photo-rec-icon">🀄</span>
            <div>
              <h3>座位已分配</h3>
            </div>
          </div>
          <button className="btn-close" onClick={onCancel} disabled={creating}>
            ✕
          </button>
        </div>

        <div className="seat-assign-body">
          <div className="seat-compass">
            <div className="seat-compass-slot seat-compass-north">
              <SeatCard name={seated[0].userName} wind="🀀" isMobile={isMobile} />
            </div>
            <div className="seat-compass-slot seat-compass-south">
              <SeatCard name={seated[1].userName} wind="🀁" isMobile={isMobile} />
            </div>
            <div className="seat-compass-slot seat-compass-east">
              {seated[3] && <SeatCard name={seated[3].userName} wind="🀃" isMobile={isMobile} />}
            </div>
            <div className="seat-compass-slot seat-compass-west">
              <SeatCard name={seated[2].userName} wind="🀂" isMobile={isMobile} />
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-accent btn-large seat-assign-confirm-btn"
            onClick={() => onConfirm(seated.map((p) => p.id))}
            disabled={creating}
          >
            {creating ? '创建中...' : '确定，开始游戏'}
          </button>
        </div>
      </div>
    </div>
  )
}
