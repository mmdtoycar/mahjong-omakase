import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchPlayers, createSession } from '../api'
import { Player, GameModeKey, GAME_MODES } from '../types'

export default function NewSessionPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [gameMode, setGameMode] = useState<GameModeKey | ''>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchPlayers().then(setPlayers)
  }, [])

  const togglePlayer = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      } else {
        if (prev.length < 4) {
          return [...prev, id]
        }
        return prev
      }
    })
  }

  const canStart = selectedIds.length === 4 && gameMode !== ''

  const filteredPlayers = players.filter(p => {
    const q = search.toLowerCase()
    return p.firstName.toLowerCase().includes(q)
      || p.lastName.toLowerCase().includes(q)
      || p.userName.toLowerCase().includes(q)
  })

  const handleStart = async () => {
    if (!canStart) return
    const now = new Date()
    const defaultName = `游戏 ${now.toLocaleDateString()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ margin: 0 }}>选择玩家 (已选 {selectedIds.length}/4)</label>
        </div>

        {players.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="搜索玩家..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {players.length > 0 ? (
          <div className="player-select-grid">
            {filteredPlayers.map(p => {
              const isSelected = selectedIds.includes(p.id)
              const isDisabled = !isSelected && selectedIds.length >= 4

              return (
                <div
                  key={p.id}
                  onClick={() => !isDisabled && togglePlayer(p.id)}
                  className={`player-select-card${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                >
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>{p.userName}</div>
                  <div style={{ fontSize: '0.85rem', opacity: isSelected ? 0.9 : 0.6 }}>
                    {p.firstName[0]}.{p.lastName}
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

      <div style={{ marginTop: 24 }}>
        {selectedIds.length !== 4 && (
          <p className="warning-text" style={{ marginBottom: 16 }}>
            需要正好4名玩家才能开始游戏。(还差 {4 - selectedIds.length} 人)
          </p>
        )}
        <button
          className="btn btn-accent btn-large"
          onClick={handleStart}
          disabled={!canStart}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          开始游戏 ({selectedIds.length}/4)
        </button>
      </div>
    </div>
  )
}
