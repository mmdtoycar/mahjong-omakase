import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'
import StatsPage from './pages/StatsPage'
import PlayerDetailPage from './pages/PlayerDetailPage'
import AdminPage from './pages/AdminPage'
import FanTablePage from './pages/FanTablePage'
import CalculatorPage from './pages/CalculatorPage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import { fetchCurrentUser } from './api'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const navigate = useNavigate()

  const [token, setToken] = useState<string | null>(localStorage.getItem('mahjong_token'))
  const [me, setMe] = useState<any>(() => {
    const rawMe = sessionStorage.getItem('mahjong_me')
    return rawMe ? JSON.parse(rawMe) : null
  })

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem('mahjong_token'))
      const rawMe = sessionStorage.getItem('mahjong_me')
      setMe(rawMe ? JSON.parse(rawMe) : null)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'mahjong_token') return
      if (!event.newValue) {
        sessionStorage.removeItem('mahjong_me')
        setToken(null)
        setMe(null)
        return
      }
      setToken(event.newValue)
      fetchCurrentUser()
        .then((player) => {
          sessionStorage.setItem('mahjong_me', JSON.stringify(player))
          setMe(player)
        })
        .catch(() => {
          localStorage.removeItem('mahjong_token')
          sessionStorage.removeItem('mahjong_me')
          setToken(null)
          setMe(null)
        })
    }

    window.addEventListener('auth-change', handleAuthChange)
    window.addEventListener('storage', handleStorage)

    const storedToken = localStorage.getItem('mahjong_token')
    if (storedToken && !me) {
      fetchCurrentUser()
        .then((player) => {
          sessionStorage.setItem('mahjong_me', JSON.stringify(player))
          setMe(player)
          window.dispatchEvent(new Event('auth-change'))
        })
        .catch(() => {
          localStorage.removeItem('mahjong_token')
          sessionStorage.removeItem('mahjong_me')
          setToken(null)
          setMe(null)
          window.dispatchEvent(new Event('auth-change'))
        })
    }

    return () => {
      window.removeEventListener('auth-change', handleAuthChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('mahjong_token')
    sessionStorage.removeItem('mahjong_me')
    window.dispatchEvent(new Event('auth-change'))
    navigate('/login')
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/home" className="logo-link">
          <img src="/logo-header.png" alt="Mahjong Omakase" className="logo" />
          <h1>Mahjong Omakase</h1>
        </Link>
        <nav>
          <Link to="/home">首页</Link>
          <Link to="/game">游戏</Link>
          <Link to="/stats">统计</Link>
          <Link to="/calculator">算番器</Link>
          <Link to="/fan-table">番表</Link>
        </nav>
        <div className="auth-actions">
          {token && me ? (
            <div className="user-profile-capsule">
              <Link to="/profile">
                <span className="user-display-name">我的</span>
              </Link>
              <button onClick={handleLogout} className="btn-logout">
                退出
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-signup">
              登录
            </Link>
          )}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/home" element={<HomePage />} />
          <Route
            path="/game"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-session"
            element={
              <ProtectedRoute>
                <NewSessionPage />
              </ProtectedRoute>
            }
          />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/fan-table" element={<FanTablePage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/player/:id" element={<PlayerDetailPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <p>页面不存在</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
