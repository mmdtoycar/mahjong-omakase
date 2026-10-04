import React from 'react'
import { Tile } from '../../logic/shared/tiles'
import { DiscardAnalysis } from '../../logic/efficiency/ukeire'
import { TileComponent } from '../shared/TileComponent'

interface Props {
  userDiscard: Tile
  optimalDiscard: Tile
  userAnalysis: DiscardAnalysis | null
  optimalAnalysis: DiscardAnalysis
  isUserOptimal: boolean
  isUserViable?: boolean
  mistakeExplanation?: string
}

export const DiscardDuelCard: React.FC<Props> = ({
  userDiscard,
  optimalDiscard,
  userAnalysis,
  optimalAnalysis,
  isUserOptimal,
  isUserViable,
  mistakeExplanation,
}) => {
  const userUkeire = userAnalysis?.totalUkeire ?? 0
  const optUkeire = optimalAnalysis.totalUkeire
  const gap = optUkeire - userUkeire
  const userPercent = Math.min(100, Math.round((userUkeire / Math.max(optUkeire, 1)) * 100))

  // Find tiles present in optimal but missing from user
  const missingTiles = userAnalysis
    ? optimalAnalysis.acceptanceTiles.filter(
        (ot) => !userAnalysis.acceptanceTiles.some((ut) => ut.tile.equals(ot.tile))
      )
    : []

  return (
    <div className="practice-duel-card card">
      <div className="duel-header">
        <div className="duel-title-group">
          <span className="duel-icon">⚔️</span>
          <h4 className="duel-title">切牌效率 PK 擂台</h4>
        </div>
        <div className="duel-status-badge">
          {isUserOptimal ? (
            <span className="badge-optimal">👑 完美正解（0损耗）</span>
          ) : isUserViable ? (
            <span className="badge-viable">💡 次优方案（损耗 {gap} 张）</span>
          ) : (
            <span className="badge-blunder">⚠️ 明显损耗（少 {gap} 张进张）</span>
          )}
        </div>
      </div>

      <div className="duel-arena-grid">
        {/* Left: User Choice */}
        <div className={`duel-combatant-box ${isUserOptimal ? 'box-champion' : 'box-challenger'}`}>
          <div className="combatant-tag">{isUserOptimal ? '你的选择（与正解英雄所见略同）' : '你的切牌选择'}</div>

          <div className="combatant-tile-row">
            <TileComponent tile={userDiscard} size="normal" />
            <div className="combatant-tile-meta">
              <span className="combatant-tile-name">切 {userDiscard.toString()}</span>
              <span className="combatant-shanten-tag">{userAnalysis ? `${userAnalysis.shanten}向听` : '向听未知'}</span>
            </div>
          </div>

          {/* Energy Bar & Numbers */}
          <div className="combatant-stats-box">
            <div className="stat-line">
              <span className="stat-label">有效进张总数:</span>
              <span className="stat-number">
                <strong>{userUkeire}</strong> 张 ({userAnalysis?.acceptanceTiles.length ?? 0} 种)
              </span>
            </div>

            <div className="duel-progress-bar-bg">
              <div
                className={`duel-progress-bar-fill ${
                  isUserOptimal ? 'fill-perfect' : userPercent > 70 ? 'fill-medium' : 'fill-low'
                }`}
                style={{ width: `${userPercent}%` }}
              />
            </div>

            {userAnalysis?.goodShapeRate !== undefined && (
              <div className="stat-line sub-stat">
                <span className="stat-label">听牌好形率:</span>
                <span className="stat-number text-highlight">{Math.round(userAnalysis.goodShapeRate * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Center VS & Gap */}
        <div className="duel-vs-divider">
          <div className="vs-circle">VS</div>
          <div className="vs-gap-tag">
            {isUserOptimal ? (
              <span className="gap-text text-success">完美同步</span>
            ) : (
              <span className="gap-text text-danger">少 {gap} 张</span>
            )}
          </div>
        </div>

        {/* Right: Optimal Choice */}
        <div className="duel-combatant-box box-champion">
          <div className="combatant-tag">教练推荐最佳切牌</div>

          <div className="combatant-tile-row">
            <TileComponent tile={optimalDiscard} size="normal" />
            <div className="combatant-tile-meta">
              <span className="combatant-tile-name">切 {optimalDiscard.toString()}</span>
              <span className="combatant-shanten-tag">{optimalAnalysis.shanten}向听</span>
            </div>
          </div>

          {/* Energy Bar & Numbers */}
          <div className="combatant-stats-box">
            <div className="stat-line">
              <span className="stat-label">有效进张总数:</span>
              <span className="stat-number">
                <strong className="text-success">{optUkeire}</strong> 张 ({optimalAnalysis.acceptanceTiles.length} 种)
              </span>
            </div>

            <div className="duel-progress-bar-bg">
              <div className="duel-progress-bar-fill fill-perfect" style={{ width: '100%' }} />
            </div>

            {optimalAnalysis.goodShapeRate !== undefined && (
              <div className="stat-line sub-stat">
                <span className="stat-label">听牌好形率:</span>
                <span className="stat-number text-highlight">{Math.round(optimalAnalysis.goodShapeRate * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duel Post-Match Analysis */}
      <div className="duel-verdict-box">
        {isUserOptimal ? (
          <div className="verdict-line verdict-perfect">
            🌟 <strong>一招制敌！</strong> 你精准锁定了全手牌最冗余的牌，保留了最高进张数与最大成长空间，效率拉满！
          </div>
        ) : (
          <div className="verdict-line verdict-gap">
            <div className="gap-headline">
              🔍 <strong>牌效差额诊断：</strong> 切除 {userDiscard.toString()} 相比最佳切牌 {optimalDiscard.toString()}
              ， 直接丢失了 <strong>{gap} 张</strong> 关键进张牌！
            </div>
            {missingTiles.length > 0 && (
              <div className="missing-tiles-list">
                <span className="missing-label">错失进张牌：</span>
                {missingTiles.map((mt, idx) => (
                  <span key={idx} className="missing-tile-pill">
                    {mt.tile.toString()} ({mt.remaining}张)
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {mistakeExplanation && (
          <div className="duel-mistake-callout">
            <span className="callout-badge">💡 针对切 {userDiscard.toString()} 的专项点拨</span>
            <p className="callout-content">{mistakeExplanation}</p>
          </div>
        )}
      </div>
    </div>
  )
}
