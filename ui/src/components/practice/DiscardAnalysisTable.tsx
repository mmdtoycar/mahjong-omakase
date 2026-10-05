import React from 'react'
import { Tile } from '../../logic/shared/tiles'
import { DiscardAnalysis } from '../../logic/efficiency/ukeire'
import { TileComponent } from '../shared/TileComponent'

interface Props {
  analyses: DiscardAnalysis[]
  selectedDiscard?: Tile | null
  onSelectRow?: (tile: Tile) => void
}

export const DiscardAnalysisTable: React.FC<Props> = ({ analyses, selectedDiscard, onSelectRow }) => {
  const getShantenLabel = (shanten: number) => {
    if (shanten === -1) return '和牌'
    if (shanten === 0) return '听牌 (0向听)'
    return `${shanten}向听`
  }

  const getTagBadge = (tag: DiscardAnalysis['tag']) => {
    switch (tag) {
      case 'optimal':
        return <span className="eval-badge badge-optimal">⭐ 最佳切牌</span>
      case 'viable':
        return <span className="eval-badge badge-viable">💡 次选可考虑</span>
      case 'blunder':
        return <span className="eval-badge badge-blunder">⚠️ 效率亏损</span>
    }
  }

  return (
    <div className="discard-analysis-card">
      <div className="discard-table-header">
        <span className="table-header-icon">📊</span>
        <h4 className="table-header-title">所有切牌方案牌效对比表（纯牌效数据）</h4>
      </div>

      <div className="table-responsive-wrapper">
        <table className="discard-analysis-table">
          <thead>
            <tr>
              <th>切牌</th>
              <th>评级</th>
              <th>向听数</th>
              <th>总进张枚数</th>
              <th>进张牌种类 (受入)</th>
              <th>好形听牌率</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((item, idx) => {
              const isSelected = selectedDiscard && item.discardTile.equals(selectedDiscard)
              return (
                <tr
                  key={idx}
                  className={`discard-table-row ${isSelected ? 'row-user-selected' : ''} ${
                    item.isOptimal ? 'row-optimal' : ''
                  }`}
                  onClick={() => onSelectRow && onSelectRow(item.discardTile)}
                >
                  <td className="cell-tile">
                    <div className="discard-tile-cell">
                      <TileComponent tile={item.discardTile} size="small" disabled={true} />
                      {isSelected && <span className="user-choice-marker">你的选择</span>}
                    </div>
                  </td>
                  <td>{getTagBadge(item.tag)}</td>
                  <td className="cell-shanten">
                    <span className="shanten-pill">{getShantenLabel(item.shanten)}</span>
                  </td>
                  <td className="cell-ukeire-count">
                    <span className={`ukeire-count-num ${item.isOptimal ? 'count-best' : ''}`}>
                      {item.totalUkeire} 张
                    </span>
                  </td>
                  <td className="cell-acceptance-tiles">
                    <div className="acceptance-tiles-list">
                      {item.acceptanceTiles.map((acc, aidx) => (
                        <div key={aidx} className="acceptance-mini-pill">
                          <TileComponent tile={acc.tile} size="small" disabled={true} />
                          <span className="acc-count">×{acc.remaining}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="cell-good-shape">
                    {item.goodShapeRate !== undefined ? (
                      <div className="good-shape-wrapper">
                        <span
                          className={`shape-rate-text ${
                            item.goodShapeRate >= 0.8
                              ? 'rate-high'
                              : item.goodShapeRate >= 0.5
                              ? 'rate-mid'
                              : 'rate-low'
                          }`}
                        >
                          {Math.round(item.goodShapeRate * 100)}%
                        </span>
                        {item.goodShapeUkeire !== undefined && (
                          <span className="shape-subtext">({item.goodShapeUkeire}张好形)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-dash">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
