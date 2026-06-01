import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchPlayers, createSession } from '../api'
import { Player, GameModeKey, GAME_MODES } from '../types'
import { cardFontSize } from '../utils/fontSize'
import { MSG } from '../constants'
import { abbrName } from '../utils/format'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 4

export default function NewSessionPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [gameMode, setGameMode] = useState<GameModeKey | ''>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    fetchPlayers()
      .then((p) => {
        setPlayers(p)
        setLoaded(true)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : MSG.ERROR))
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

  const handleStart = async () => {
    if (!canStart) return
    setCreating(true)
    setError('')
    try {
      const now = new Date()
      const defaultName = `Game ${now.toLocaleDateString()} ${now.getHours()}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}`
      const session = await createSession(defaultName, gameMode, selectedIds, isOnline)
      navigate(`/session/${session.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : MSG.ERROR)
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
        <label>对局属性</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>线上练习赛</span>
          </label>
        </div>
      </div>

      <div className="form-group">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <label style={{ margin: 0 }}>
            选择玩家{' '}
            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'normal' }}>
              (请按照东南西北顺序点击玩家)
            </span>{' '}
            (已选 {selectedIds.length}/{MIN_PLAYERS}-{MAX_PLAYERS})
          </label>
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
                  <div style={{ fontWeight: 600, fontSize: cardFontSize(p.userName), marginBottom: 4 }}>
                    {p.userName}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: isSelected ? 0.9 : 0.6 }}>
                    {abbrName(p.firstName + ' ' + p.lastName)}
                  </div>
                  {isSelected && (
                    <div className="player-card-wind">{['东', '南', '西', '北'][selectedIds.indexOf(p.id)]}</div>
                  )}
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
        {selectedIds.length < MIN_PLAYERS && (
          <p className="warning-text" style={{ marginBottom: 16 }}>
            至少需要{MIN_PLAYERS}名玩家才能开始游戏。(还差 {MIN_PLAYERS - selectedIds.length} 人)
          </p>
        )}
        <button
          className="btn btn-accent btn-large"
          onClick={handleStart}
          disabled={!canStart || creating}
          style={{ justifyContent: 'center' }}
        >
          {creating ? '创建中...' : `开始游戏 (${selectedIds.length}人)`}
        </button>
      </div>
    </div>
  )
}
