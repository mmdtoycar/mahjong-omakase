import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <img src="/logo.png" alt="Mahjong Omakase" className="landing-logo" />
        <h1 className="landing-title">Mahjong Omakase</h1>
        <p className="landing-subtitle">Let's NB!</p>
        <div className="landing-actions">
          <Link to="/game" className="btn btn-accent btn-large btn-hero-shine">麻将，启动!</Link>
        </div>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">🀄</div>
          <h3>多种模式</h3>
          <p>国标麻将, 东北麻将, 立直麻将 — 选择你最爱的玩法。</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>实时计分</h3>
          <p>逐局记录分数，实时查看总分和排名。</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>排行榜</h3>
          <p>查看历史战绩、胜率和赛季冠军。</p>
        </div>
      </div>
    </div>
  )
}
