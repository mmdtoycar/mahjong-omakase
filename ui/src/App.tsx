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
import ProfilePage from './pages/ProfilePage'

function App() {
  const token = localStorage.getItem('mahjong_token')
  const rawMe = sessionStorage.getItem('mahjong_me')
  const me = rawMe ? JSON.parse(rawMe) : null

  const userDisplayName = me ? (me.firstName ? `${me.firstName} ${me.lastName}`.trim() : me.userName) : ''

  // 计算玩家名字首字母缩写 (Initial) 的辅助函数
  const getUserInitial = (player: any) => {
    if (!player) return '👤'
    if (player.firstName) {
      const f = player.firstName.charAt(0).toUpperCase()
      const l = player.lastName ? player.lastName.charAt(0).toUpperCase() : ''
      return f + l
    }
    return player.userName.charAt(0).toUpperCase()
  }

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
            /* 升级为精美的磨砂胶囊盒 (Capsule Box)，提供完美的视觉区隔 */
            <div
              className="user-profile-capsule"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: '15px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                background: 'rgba(0, 0, 0, 0.03)',
                padding: '5px 12px',
                borderRadius: '20px',
              }}
            >
              <Link
                to="/profile"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {me.pictureUrl ? (
                  <img
                    src={me.pictureUrl}
                    alt={userDisplayName}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  /* 无头像时降级渲染精致的名字缩写 (Initial)，确保绝不溢出 */
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#1d976c',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  >
                    {getUserInitial(me)}
                  </div>
                )}
                {/* 增加 CSS 截断，最大宽度 80px，超长自动 ellipsis 缩略，彻底防止溢出 */}
                <span
                  style={{
                    fontSize: '13px',
                    color: '#1a1a1a',
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
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: '#ffffff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: '#666',
                  marginLeft: '4px',
                  fontWeight: 500,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
          <Route path="/profile" element={<ProfilePage />} />
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
