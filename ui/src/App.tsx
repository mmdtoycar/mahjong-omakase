import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'
import StatsPage from './pages/StatsPage'
import SignUpPage from './pages/SignUpPage'
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

  const userDisplayName = me ? [me.firstName, me.lastName].filter(Boolean).join(' ') || me.userName || '' : ''

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
        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/home">首页</Link>
          <Link to="/game">游戏</Link>
          <Link to="/stats">统计</Link>
          <Link to="/calculator">算番器</Link>
          <Link to="/fan-table">番表</Link>
          {token && me ? (
            /* 升级为高度清晰、对比强烈的用户身份栏，使用与登录按钮完全一致的金色品牌底色 */
            <div
              className="user-profile-capsule"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: '15px',
                background: 'var(--accent)',
                padding: '5px 12px',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'background-color 0.2s',
              }}
            >
              <Link
                to="/profile"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: '#ffffff',
                }}
              >
                {/* 使用极佳白字对比度，增加 CSS 截断防止溢出，彻底移除圆形头像/缩写以保持绝对扁平极简 */}
                <span
                  style={{
                    fontSize: '13px',
                    color: '#ffffff',
                    fontWeight: 600,
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {userDisplayName}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  marginLeft: '4px',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginLeft: '15px',
              }}
            >
              <Link
                to="/signup"
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  background: 'none',
                }}
              >
                注册
              </Link>
              <Link to="/login" className="btn-signup">
                登录
              </Link>
            </div>
          )}
        </nav>
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
          <Route path="/signup" element={<SignUpPage />} />
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
