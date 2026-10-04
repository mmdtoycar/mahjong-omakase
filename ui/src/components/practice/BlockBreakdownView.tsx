import React, { useState } from 'react'
import { HandStructure, HandBlock } from '../../logic/efficiency/blockAnalyzer'
import { TileComponent } from '../shared/TileComponent'

interface Props {
  structure: HandStructure
}

export const BlockBreakdownView: React.FC<Props> = ({ structure }) => {
  const [showDeepDetails, setShowDeepDetails] = useState<boolean>(false)

  const getStatusClass = (status: HandStructure['status']) => {
    switch (status) {
      case 'over-blocks':
        return 'status-warning'
      case 'five-blocks':
        return 'status-success'
      case 'under-blocks':
        return 'status-info'
    }
  }

  // Separate blocks into "Core Skeleton" (melds, good taatsus, pairs) vs "Surplus / Chop Candidates" (isolated, bad taatsus)
  const coreBlocks: HandBlock[] = []
  const surplusBlocks: HandBlock[] = []

  structure.blocks.forEach((b) => {
    if (
      b.type === 'isolated' ||
      b.quality === 'redundant' ||
      (structure.status === 'over-blocks' && b.quality === 'bad')
    ) {
      surplusBlocks.push(b)
    } else {
      coreBlocks.push(b)
    }
  })

  return (
    <div className="practice-block-breakdown-card card">
      <div className="block-breakdown-header">
        <div className="block-header-left">
          <span className="block-section-icon">🧱</span>
          <div className="block-header-titles">
            <h4 className="block-section-title">面子/搭子五块透视器（五面子理论）</h4>
            <span className="block-section-subtitle">日麻核心模型：4组面子 + 1组雀头 = 5块定型。</span>
          </div>
        </div>
        <div className={`block-status-pill ${getStatusClass(structure.status)}`}>{structure.statusTitle}</div>
      </div>

      <div className="block-status-compact-summary">
        <span className="summary-status-tag">
          {structure.status === 'five-blocks'
            ? '🎯 五块已齐：核心搭子已满，立即清理浮牌'
            : structure.status === 'over-blocks'
            ? '⚠️ 搭子超额：搭子总数 > 5块，需淘汰最弱搭'
            : '🌱 搭子不足：搭子总数 < 5块，需靠中张增生'}
        </span>
        <p className="summary-explanation-text">{structure.statusExplanation}</p>
      </div>

      {/* Decluttered Two-Zone Structure: Core vs Surplus */}
      <div className="block-decluttered-container">
        {/* Core Zone */}
        <div className="block-zone-column zone-core">
          <div className="zone-header">
            <span className="zone-icon">🛡️</span>
            <span className="zone-title">手牌核心面子与搭子（{coreBlocks.length} 块）</span>
            <span className="zone-desc">构成 4面子1雀头 的基本盘</span>
          </div>
          <div className="zone-blocks-list">
            {coreBlocks.map((b, idx) => (
              <div key={idx} className={`compact-block-chip chip-${b.quality}`}>
                <div className="chip-tiles-row">
                  {b.tiles.map((t, tidx) => (
                    <TileComponent key={tidx} tile={t} size="small" />
                  ))}
                </div>
                <div className="chip-meta">
                  <span className="chip-name">{b.name}</span>
                  <span className="chip-label">{b.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Surplus / Chop Candidates Zone */}
        {surplusBlocks.length > 0 && (
          <div className="block-zone-column zone-surplus">
            <div className="zone-header">
              <span className="zone-icon">✂️</span>
              <span className="zone-title">待淘汰候选区（{surplusBlocks.length} 块）</span>
              <span className="zone-desc">多余浮牌或最弱搭子（切牌首选）</span>
            </div>
            <div className="zone-blocks-list">
              {surplusBlocks.map((b, idx) => (
                <div key={idx} className="compact-block-chip chip-surplus">
                  <div className="chip-tiles-row">
                    {b.tiles.map((t, tidx) => (
                      <TileComponent key={tidx} tile={t} size="small" />
                    ))}
                  </div>
                  <div className="chip-meta">
                    <span className="chip-name text-danger">{b.name}</span>
                    <span className="chip-label">{b.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Deep Details Drawer */}
      <div className="block-details-drawer">
        <button className="btn-toggle-details" onClick={() => setShowDeepDetails((prev) => !prev)}>
          {showDeepDetails ? '收起详尽面子参数 ▲' : '展开各块进张详尽参数与改良分析 ▼'}
        </button>

        {showDeepDetails && (
          <div className="deep-details-grid">
            {structure.blocks.map((b, idx) => (
              <div key={idx} className={`deep-block-box block-${b.quality}`}>
                <div className="deep-box-header">
                  <span className="deep-box-name">{b.name}</span>
                  <span className={`deep-box-quality quality-${b.quality}`}>{b.quality}</span>
                </div>
                <div className="deep-box-tiles">
                  {b.tiles.map((t, tidx) => (
                    <TileComponent key={tidx} tile={t} size="small" />
                  ))}
                </div>
                <div className="deep-box-label">{b.label}</div>
                <div className="deep-box-desc">{b.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
