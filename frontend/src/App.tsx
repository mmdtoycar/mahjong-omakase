import { Routes, Route, Link, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'
import StatsPage from './pages/StatsPage'
import SignUpPage from './pages/SignUpPage'
import PlayerDetailPage from './pages/PlayerDetailPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/home" className="logo-link">
          <img src="/logo-header.png" alt="Mahjong Omakase" className="logo" />
          <h1>Mahjong Omakase</h1>
        </Link>
        <nav>
          <Link to="/home">HOME</Link>
          <Link to="/game">GAME</Link>
          <Link to="/stats">STATS</Link>
          <Link to="/signup" className="btn-signup">SIGN UP</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/game" element={<DashboardPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/new-session" element={<NewSessionPage />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/player/:id" element={<PlayerDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
