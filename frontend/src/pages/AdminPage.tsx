import { useState, useEffect } from 'react'
import { Player } from '../types'

const API = '/api/admin'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Invalid password')
        return
      }
      setAuthenticated(true)
    } catch {
      setError('Login failed')
    }
  }

  const loadPlayers = async () => {
    setLoading(true)
    const res = await fetch(`${API}/players`, {
      headers: { 'X-Admin-Password': password },
    })
    if (res.ok) {
      setPlayers(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    if (authenticated) loadPlayers()
  }, [authenticated])

  const handleDelete = async (id: number, userName: string) => {
    if (!confirm(`Delete ${userName}? This cannot be undone. Game scores will be kept but player will be removed from stats.`)) return
    const res = await fetch(`${API}/players/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': password },
    })
    if (res.ok) {
      setPlayers(players.filter(p => p.id !== id))
    } else {
      const data = await res.json().catch(() => ({ message: 'Delete failed' }))
      alert(data.message || 'Delete failed')
    }
  }

  const startEdit = (p: Player) => {
    setEditingId(p.id)
    setEditFirst(p.firstName)
    setEditLast(p.lastName)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditFirst('')
    setEditLast('')
  }

  const handleSave = async (id: number) => {
    if (!editFirst.trim() || !editLast.trim()) return
    const res = await fetch(`${API}/players/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
      },
      body: JSON.stringify({ firstName: editFirst.trim(), lastName: editLast.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPlayers(players.map(p => p.id === id ? updated : p))
      cancelEdit()
    } else {
      const data = await res.json().catch(() => ({ message: 'Update failed' }))
      alert(data.message || 'Update failed')
    }
  }

  if (!authenticated) {
    return (
      <div className="signup-container">
        <div className="card signup-card">
          <p className="signup-title">Admin Access</p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary signup-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state"><p>Loading...</p></div>

  return (
    <>
      <div className="card">
        <h2>Admin Panel</h2>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
          Deleting a player removes them from stats and player list. Game round scores are preserved.
        </p>
      </div>

      <div className="card">
        <h2>Players ({players.length})</h2>
        <div className="score-table">
          <table>
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
              {players.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.userName}</td>
                  <td>
                    {editingId === p.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={editFirst}
                          onChange={e => setEditFirst(e.target.value)}
                          style={{ width: 80 }}
                          placeholder="First"
                          autoFocus
                        />
                        <input
                          value={editLast}
                          onChange={e => setEditLast(e.target.value)}
                          style={{ width: 80 }}
                          placeholder="Last"
                          onKeyDown={e => e.key === 'Enter' && handleSave(p.id)}
                        />
                      </div>
                    ) : (
                      <>{p.firstName} {p.lastName}</>
                    )}
                  </td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
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
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleDelete(p.id, p.userName)}
                        >
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
    </>
  )
}
