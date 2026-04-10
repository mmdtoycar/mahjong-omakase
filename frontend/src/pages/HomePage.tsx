import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <img src="/logo.png" alt="Mahjong Omakase" className="landing-logo" />
        <h1 className="landing-title">Mahjong Omakase</h1>
        <p className="landing-subtitle">Let's NB!</p>
        <p className="landing-desc">
          Track scores, compete with friends, and view stats across multiple mahjong variants.
        </p>
        <div className="landing-actions">
          <Link to="/game" className="btn btn-accent btn-large">Start Playing</Link>
          <Link to="/signup" className="btn btn-outline btn-large">Sign Up</Link>
        </div>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">🀄</div>
          <h3>Multiple Modes</h3>
          <p>国标麻将, 抗日麻将, 立直麻将 — play your favorite variant.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Live Scoring</h3>
          <p>Track scores round by round with real-time totals and rankings.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>Leaderboard</h3>
          <p>See who dominates with historical stats, win rates, and averages.</p>
        </div>
      </div>
    </div>
  )
}
