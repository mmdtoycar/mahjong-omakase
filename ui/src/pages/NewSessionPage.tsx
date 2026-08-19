import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchPlayers, createSession } from '../api'
import { Player, GameModeKey, GAME_MODES } from '../types'
import { cardFontSize } from '../utils/fontSize'
import { MSG } from '../constants'
import { abbrName, parseError } from '../utils/format'
import { useIsMobile } from '../hooks/useIsMobile'
import { SeatAssignmentModal } from '../components/SeatAssignmentModal'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 4

export default function NewSessionPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [gameMode, setGameMode] = useState<GameModeKey | ''>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [seatModalOpen, setSeatModalOpen] = useState(false)
  const [seatError, setSeatError] = useState('')

  useEffect(() => {
    fetchPlayers()
      .then((p) => {
        setPlayers(p)
        setLoaded(true)
      })
      .catch((e: unknown) => setError(parseError(e)))
  }, [])

  const togglePlayer = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id)
      } else {
        if (prev.length < MAX_PLAYERS) {
          return [...prev, id]
        }
        return prev
      }
    })
  }

  const canStart = selectedIds.length >= MIN_PLAYERS && selectedIds.length <= MAX_PLAYERS && gameMode !== ''

  const filteredPlayers = players.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.userName.toLowerCase().includes(q)
    )
  })

  const handleStart = () => {
    if (!canStart) return
    setSeatError('')
    setSeatModalOpen(true)
  }

  const handleConfirmSeats = async (orderedPlayerIds: number[]) => {
    setCreating(true)
    setSeatError('')
    try {
      const now = new Date()
      // 'en-US' pins the output format (M/D/YYYY, 24h HH:mm) — an empty locale array instead
      // resolves to the phone's own language/region, so the same code produced "8/16/2026" on an
      // English-region phone and "2026/8/16" on a Chinese-region one.
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const defaultName = `Game ${dateStr} ${timeStr}`
      const session = await createSession(defaultName, gameMode, orderedPlayerIds)
      navigate(`/session/${session.id}`)
    } catch (e: unknown) {
      setSeatError(parseError(e))
      setCreating(false)
    }
  }

  return (
    <div className="card">
      <h2>新建游戏</h2>

      <div className="form-group">
        <label>游戏模式</label>
        <div className="tab-bar" style={{ marginTop: 8 }} role="tablist" aria-label="游戏模式选择">
          {GAME_MODES.map((m) => (
            <button
              key={m.key}
              className={`tab-btn${gameMode === m.key ? ' tab-active' : ''}`}
              onClick={() => setGameMode(m.key)}
              type="button"
              role="tab"
              aria-selected={gameMode === m.key}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <div style={{ display: 'block', marginBottom: 12 }}>
          选择玩家 (已选 {selectedIds.length}/{MIN_PLAYERS}-{MAX_PLAYERS})
        </div>

        {players.length > 0 && (
          <div className="filter-bar">
            <input type="text" placeholder="搜索玩家..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        {error ? (
          <p className="error-text">{error}</p>
        ) : !loaded ? (
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: 8 }}>{MSG.LOADING}</p>
        ) : players.length > 0 ? (
          <div className="player-select-grid">
            {filteredPlayers.map((p) => {
              const isSelected = selectedIds.includes(p.id)
              const isDisabled = !isSelected && selectedIds.length >= MAX_PLAYERS

              return (
                <div
                  key={p.id}
                  onClick={() => !isDisabled && togglePlayer(p.id)}
                  className={`player-select-card${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                >
                  <div style={{ fontWeight: 600, fontSize: cardFontSize(p.userName, isMobile), marginBottom: 4 }}>
                    {p.userName}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: isSelected ? 0.9 : 0.6 }}>
                    {abbrName(p.firstName + ' ' + p.lastName)}
                  </div>
                </div>
              )
            })}

            {filteredPlayers.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                没有找到匹配的玩家
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: 8 }}>
            暂无玩家。请先<Link to="/signup">注册</Link>。
          </p>
        )}
      </div>

      <div className="new-session-actions">
        {gameMode === '' && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠</span>
            <span className="alert-body">请先选择游戏模式。</span>
          </div>
        )}
        {selectedIds.length < MIN_PLAYERS && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠</span>
            <span className="alert-body">
              至少需要{MIN_PLAYERS}名玩家才能开始游戏。(还差 {MIN_PLAYERS - selectedIds.length} 人)
            </span>
          </div>
        )}
        <button className="btn btn-accent btn-large" onClick={handleStart} disabled={!canStart}>
          开始游戏 ({selectedIds.length}人)
        </button>
      </div>

      {seatModalOpen && (
        <SeatAssignmentModal
          players={players.filter((p) => selectedIds.includes(p.id))}
          onCancel={() => setSeatModalOpen(false)}
          onConfirm={handleConfirmSeats}
          creating={creating}
          error={seatError}
        />
      )}
    </div>
  )
}
