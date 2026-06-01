import { Routes, Route, Link, Navigate } from 'react-router-dom'
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

function App() {
  const token = localStorage.getItem('mahjong_token')
  const rawMe = sessionStorage.getItem('mahjong_me')
  const me = rawMe ? JSON.parse(rawMe) : null

  const handleLogout = () => {
    localStorage.removeItem('mahjong_token')
    sessionStorage.removeItem('mahjong_me')
    window.location.href = '/login'
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
            <div
              className="user-profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginLeft: '15px',
                borderLeft: '1px solid #eee',
                paddingLeft: '15px',
              }}
            >
              {me.pictureUrl && (
                <img
                  src={me.pictureUrl}
                  alt={me.displayName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                />
              )}
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>{me.displayName}</span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  background: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-signup" style={{ marginLeft: '15px' }}>
              测试登录
            </Link>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<LoginPage />} />
          {/* 暂时移除 ProtectedRoute 包装，保持原有路由完全免密访问，降低重构割接风险 */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/game" element={<DashboardPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/new-session" element={<NewSessionPage />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/fan-table" element={<FanTablePage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/player/:id" element={<PlayerDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
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
