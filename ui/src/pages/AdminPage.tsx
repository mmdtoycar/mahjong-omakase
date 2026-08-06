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

  useEffect(() => {
    Promise.all([loadPlayers(), loadSessions()])
      .then((results) => setAuthorized(results.every(Boolean)))
      .finally(() => setLoading(false))
  }, [])

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
        <h2>Players ({players.length})</h2>
        <div className="admin-swipe-shell">
          <div className="table-wrap">
            <table className="auto-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Joined</th>
                  <th className="col-action"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
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
                    <td style={{ whiteSpace: 'nowrap' }}>
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
                    <td className="col-action">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Completed Sessions ({sessions.length})</h2>
        <div className="admin-swipe-shell">
          <div className="table-wrap">
            <table className="auto-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Game Name</th>
                  <th>Mode</th>
                  <th>Rnds</th>
                  <th className="col-action"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.gameModeDisplayName}</td>
                    <td>{s.roundCount}</td>
                    <td className="col-action">
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
      </div>
    </>
  )
}
