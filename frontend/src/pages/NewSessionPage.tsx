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
      <h2>新建游戏</h2>

      <div className="form-group">
        <label>游戏模式</label>
        <select
          value={gameMode}
          onChange={e => setGameMode(e.target.value as GameModeKey)}
        >
          <option value="">-- 选择游戏模式 --</option>
          {GAME_MODES.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>玩家 (已选{selectedIds.length}人)</label>

        {selectedPlayers.length > 0 && (
          <div className="player-chips" style={{ marginBottom: 10 }}>
            {selectedPlayers.map(p => (
              <span className="chip selected" key={p.id}>
                {p.userName}
                <span className="chip-username">{p.firstName[0]}.{p.lastName}</span>
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
            placeholder="搜索玩家..."
          />
          {dropdownOpen && (
            <div className="dropdown-list">
              {filteredPlayers.length === 0 ? (
                <div className="dropdown-empty">
                  {availablePlayers.length === 0 ? '已选择全部玩家' : '未找到匹配玩家'}
                </div>
              ) : (
                filteredPlayers.map(p => (
                  <div
                    key={p.id}
                    className="dropdown-item"
                    onClick={() => addPlayer(p.id)}
                  >
                    <span>{p.userName}</span>
                    <span className="dropdown-username">{p.firstName[0]}.{p.lastName}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {players.length === 0 && (
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: 8 }}>
            暂无玩家。请先<Link to="/signup">注册</Link>。
          </p>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        {selectedIds.length > 0 && selectedIds.length < 3 && (
          <p className="warning-text">至少需要3名玩家才能开始游戏。</p>
        )}
        <button
          className="btn btn-accent"
          onClick={handleStart}
          disabled={!canStart}
        >
          开始游戏 ({selectedIds.length}人)
        </button>
      </div>
    </div>
  )
}
