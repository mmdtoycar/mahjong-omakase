import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Player, GameSession } from '../types'

const API = '/api/admin'

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('mahjong_token')
  if (token) extra.Authorization = `Bearer ${token}`
  return extra
}

export default function AdminPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [bonus, setBonus] = useState('0')
  const [savedBonus, setSavedBonus] = useState('0')
  const [savingSettings, setSavingSettings] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null)

  const loadPlayers = async (): Promise<boolean> => {
    const res = await fetch(`${API}/players`, { headers: authHeaders() })
    if (res.ok) {
      setPlayers(await res.json())
      return true
    }
    return false
  }

  const loadSessions = async (): Promise<boolean> => {
    const res = await fetch(`${API}/sessions`, { headers: authHeaders() })
    if (res.ok) {
      setSessions(await res.json())
      return true
    }
    return false
  }

  const loadSettings = async (): Promise<boolean> => {
    const res = await fetch(`${API}/settings`, { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json()
      if (data.participation_bonus !== undefined) {
        const val = parseFloat(data.participation_bonus)
        if (!isNaN(val)) {
          setBonus(String(val))
          setSavedBonus(String(val))
        }
      }
      return true
    }
    return false
  }

  useEffect(() => {
    Promise.all([loadPlayers(), loadSessions(), loadSettings()])
      .then((results) => setAuthorized(results.every(Boolean)))
      .finally(() => setLoading(false))
  }, [])

  const handleSaveSettings = async () => {
    if (!/^\d+(\.\d+)?$/.test(bonus.trim())) {
      alert('请输入有效的非负数值')
      return
    }
    const bonusVal = parseFloat(bonus)
    if (bonusVal < 0) {
      alert('请输入有效的非负数值')
      return
    }
    setSavingSettings(true)
    const res = await fetch(`${API}/settings`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ participation_bonus: bonusVal }),
    })
    if (res.ok) {
      const persisted = String(bonusVal)
      setBonus(persisted)
      setSavedBonus(persisted)
    } else {
      alert('Failed to save settings')
    }
    setSavingSettings(false)
  }

  const handleDelete = async (id: number, userName: string) => {
    if (!confirm(`Delete ${userName}?`)) return
    const res = await fetch(`${API}/players/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      setPlayers(players.filter((p) => p.id !== id))
    } else {
      const data = await res.json().catch(() => ({ message: 'Delete failed' }))
      alert(data.message || 'Delete failed')
    }
  }

  const handleDeleteSession = async (id: number, name: string) => {
    if (
      !confirm(
        `Delete session "${name}"? This cannot be undone. All rounds, scores, and fan discoveries from this session will be permanently removed.`
      )
    )
      return
    setDeletingSessionId(id)
    const res = await fetch(`${API}/sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      setSessions(sessions.filter((s) => s.id !== id))
    } else {
      const data = await res.json().catch(() => ({ message: 'Delete failed' }))
      alert(data.message || 'Delete failed')
    }
    setDeletingSessionId(null)
  }

  const startEdit = (p: Player) => {
    setEditingId(p.id)
    setEditUserName(p.userName)
    setEditFirst(p.firstName)
    setEditLast(p.lastName)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditUserName('')
    setEditFirst('')
    setEditLast('')
  }

  const handleSave = async (id: number) => {
    if (!editUserName.trim() || !editFirst.trim() || !editLast.trim()) return
    const res = await fetch(`${API}/players/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        userName: editUserName.trim(),
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPlayers(players.map((p) => (p.id === id ? updated : p)))
      cancelEdit()
    } else {
      const data = await res.json().catch(() => ({ message: 'Update failed' }))
      alert(data.message || 'Update failed')
    }
  }

  if (loading) return null
  if (!authorized) return <Navigate to="/" replace />

  return (
    <>
      <div className="card">
        <h2>Admin Panel</h2>
      </div>

      <div className="card">
        <h2>Settings</h2>
        <div className="form-group">
          <label>Participation Bonus (RP per game)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              inputMode="decimal"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              style={{ flex: '0 1 120px', minWidth: 0 }}
            />
            <button
              className="btn btn-primary btn-small"
              onClick={handleSaveSettings}
              disabled={savingSettings || bonus === savedBonus}
            >
              {savingSettings ? 'Saving...' : 'Save'}
            </button>
            {bonus !== savedBonus && <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>unsaved</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Players ({players.length})</h2>
        <div className="table-wrap">
          <table className="auto-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                // TODO: 等所有真实玩家都完成 Google 绑定后, 删掉这条标红逻辑
                const unbound = !p.merged && !p.bot
                const cellStyle = unbound ? { color: 'var(--danger, #c0392b)', fontWeight: 600 } : undefined
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td style={cellStyle}>
                      {editingId === p.id ? (
                        <input
                          value={editUserName}
                          onChange={(e) => setEditUserName(e.target.value)}
                          style={{ width: '100%', maxWidth: 120, minWidth: 0 }}
                          placeholder="Username"
                          autoFocus
                        />
                      ) : (
                        p.userName
                      )}
                    </td>
                    <td style={cellStyle}>
                      {editingId === p.id ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            value={editFirst}
                            onChange={(e) => setEditFirst(e.target.value)}
                            style={{ flex: '1 1 70px', minWidth: 0, maxWidth: 100 }}
                            placeholder="First"
                          />
                          <input
                            value={editLast}
                            onChange={(e) => setEditLast(e.target.value)}
                            style={{ flex: '1 1 70px', minWidth: 0, maxWidth: 100 }}
                            placeholder="Last"
                            onKeyDown={(e) => e.key === 'Enter' && handleSave(p.id)}
                          />
                        </div>
                      ) : (
                        <>
                          {p.firstName} {p.lastName}
                        </>
                      )}
                    </td>
                    <td>{new Date(p.createdAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}</td>
                    <td>
                      {editingId === p.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-primary btn-small" onClick={() => handleSave(p.id)}>
                            Save
                          </button>
                          <button className="btn btn-small btn-outline" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-small btn-outline" onClick={() => startEdit(p)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-small" onClick={() => handleDelete(p.id, p.userName)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Completed Sessions ({sessions.length})</h2>
        <p className="page-subtitle">
          Deleting a session permanently removes all of its rounds, round scores, and fan discoveries (achievements).
          This cannot be undone. In-progress sessions are not shown.
        </p>
        <div className="table-wrap">
          <table className="auto-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Mode</th>
                <th>Rounds</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.gameModeDisplayName}</td>
                  <td>{s.roundCount}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteSession(s.id, s.name)}
                      disabled={deletingSessionId === s.id}
                    >
                      {deletingSessionId === s.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
