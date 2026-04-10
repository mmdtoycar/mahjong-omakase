import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchPlayers, createSession } from '../api'
import { Player, GameModeKey, GAME_MODES } from '../types'

export default function NewSessionPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [gameMode, setGameMode] = useState<GameModeKey | ''>('')
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPlayers().then(setPlayers)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const availablePlayers = players.filter(p => !selectedIds.includes(p.id))
  const filteredPlayers = availablePlayers.filter(p => {
    const q = search.toLowerCase()
    return p.firstName.toLowerCase().includes(q)
      || p.lastName.toLowerCase().includes(q)
      || p.userName.toLowerCase().includes(q)
  })

  const selectedPlayers = players.filter(p => selectedIds.includes(p.id))

  const addPlayer = (id: number) => {
    setSelectedIds(prev => [...prev, id])
    setSearch('')
    setDropdownOpen(false)
  }

  const removePlayer = (id: number) => {
    setSelectedIds(prev => prev.filter(i => i !== id))
  }

  const canStart = selectedIds.length >= 3 && gameMode !== ''

  const handleStart = async () => {
    if (!canStart) return
    const now = new Date()
    const defaultName = `Game ${now.toLocaleDateString()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
    const session = await createSession(defaultName, gameMode, selectedIds)
    navigate(`/session/${session.id}`)
  }

  return (
    <div className="card">
      <h2>New Game Session</h2>

      <div className="form-group">
        <label>Game Mode</label>
        <select
          value={gameMode}
          onChange={e => setGameMode(e.target.value as GameModeKey)}
        >
          <option value="">-- Select Game Mode --</option>
          {GAME_MODES.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Players ({selectedIds.length} selected)</label>

        {selectedPlayers.length > 0 && (
          <div className="player-chips" style={{ marginBottom: 10 }}>
            {selectedPlayers.map(p => (
              <span className="chip selected" key={p.id}>
                {p.firstName} {p.lastName}
                <span className="chip-username">@{p.userName}</span>
                <span className="remove" onClick={() => removePlayer(p.id)}>&times;</span>
              </span>
            ))}
          </div>
        )}

        <div className="player-search-dropdown" ref={dropdownRef}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
            onFocus={() => { if (search.trim()) setDropdownOpen(true) }}
            placeholder="Search players by name or username..."
          />
          {dropdownOpen && (
            <div className="dropdown-list">
              {filteredPlayers.length === 0 ? (
                <div className="dropdown-empty">
                  {availablePlayers.length === 0 ? 'All players selected' : 'No match found'}
                </div>
              ) : (
                filteredPlayers.map(p => (
                  <div
                    key={p.id}
                    className="dropdown-item"
                    onClick={() => addPlayer(p.id)}
                  >
                    <span>{p.firstName} {p.lastName}</span>
                    <span className="dropdown-username">@{p.userName}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {players.length === 0 && (
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: 8 }}>
            No players registered. <Link to="/signup">Sign up players</Link> first.
          </p>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        {selectedIds.length > 0 && selectedIds.length < 3 && (
          <p className="warning-text">At least 3 players are needed to start a game.</p>
        )}
        <button
          className="btn btn-accent"
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Game ({selectedIds.length} players)
        </button>
      </div>
    </div>
  )
}
