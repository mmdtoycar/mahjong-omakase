import React, { useState, useMemo } from 'react'
import { Tile } from '../../logic/shared/tiles'
import { DiscardAnalysis } from '../../logic/efficiency/ukeire'
import { PracticeQuestion } from '../../data/practiceQuestions'
import { getWhatIfScenarios, SimulationResult } from '../../logic/efficiency/whatIfEngine'
import { TileComponent } from '../shared/TileComponent'

interface Props {
  handTiles: Tile[]
  effectiveDiscard: Tile
  analyses: DiscardAnalysis[]
  question?: PracticeQuestion
  userDiscard?: Tile | null
}

export const WhatIfSimulator: React.FC<Props> = ({ handTiles, effectiveDiscard, analyses, question, userDiscard }) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0)

  const scenarios: SimulationResult[] = useMemo(() => {
    return getWhatIfScenarios(handTiles, effectiveDiscard, analyses, question, userDiscard)
  }, [handTiles, effectiveDiscard, analyses, question, userDiscard])

  // Safeguard if index out of bounds
  const currentScenario = scenarios[selectedIdx] || scenarios[0]

  if (!currentScenario) return null

  return (
    <div className="practice-whatif-simulator card">
      <div className="whatif-header">
        <div className="whatif-title-group">
          <span className="whatif-icon">🔮</span>
          <div className="whatif-title-box">
            <h4 className="whatif-title">摸牌推演沙盘（实战动态演练）</h4>
            <p className="whatif-subtitle">点击下方不同推演卡片，推演手牌若摸入这些牌时的成型形态与向听跃迁：</p>
          </div>
        </div>
      </div>

      {/* Scenario Pills Selector */}
      <div className="whatif-pills-row">
        {scenarios.map((sc, idx) => {
          const isSelected = idx === selectedIdx
          const tagClass =
            sc.tag === 'optimal'
              ? 'pill-tag-optimal'
              : sc.tag === 'good'
              ? 'pill-tag-good'
              : sc.tag === 'trap'
              ? 'pill-tag-trap'
              : 'pill-tag-neutral'

          return (
            <button
              key={idx}
              className={`whatif-pill-btn ${tagClass} ${isSelected ? 'pill-active' : ''}`}
              onClick={() => setSelectedIdx(idx)}
            >
              <span className="pill-dot" />
              <span className="pill-text">{sc.label}</span>
            </button>
          )
        })}
      </div>

      {/* Simulation Stage */}
      <div className="whatif-stage-box">
        <div className="stage-top-meta">
          <div className="stage-tag-badge">
            <span className="badge-draw-label">
              当前推演：切除 <strong>{effectiveDiscard.toString()}</strong> ➔ 摸入{' '}
              <strong className="text-draw-highlight">{currentScenario.drawTile.toString()}</strong>
            </span>
          </div>
          <div className={`stage-status-badge badge-${currentScenario.tag}`}>{currentScenario.statusBadge}</div>
        </div>

        {/* Hand Display with Drawn Tile highlighted */}
        <div className="whatif-hand-table">
          <div className="whatif-tiles-row">
            {currentScenario.newHandTiles.map((tile, tidx) => {
              const isNewlyDrawn = tile.equals(currentScenario.drawTile)
              return (
                <div key={tidx} className={`whatif-tile-wrapper ${isNewlyDrawn ? 'tile-newly-drawn' : ''}`}>
                  <TileComponent tile={tile} size="normal" />
                  {isNewlyDrawn && <div className="draw-badge-flag">新摸入 ✨</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Outcome Feedback Box */}
        <div className="stage-outcome-card">
          <div className="outcome-icon-col">
            {currentScenario.tag === 'optimal'
              ? '🌟'
              : currentScenario.tag === 'good'
              ? '👍'
              : currentScenario.tag === 'trap'
              ? '⚠️'
              : '💡'}
          </div>
          <div className="outcome-text-col">
            <div className="outcome-heading">
              {currentScenario.tag === 'optimal'
                ? '高光进张推演点评'
                : currentScenario.tag === 'good'
                ? '良好进张推演点评'
                : currentScenario.tag === 'trap'
                ? '失误/陷阱对比点评'
                : '常规推演点评'}
            </div>
            <p className="outcome-content-text">{currentScenario.outcomeText}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
