import React, { useState } from 'react'
import { HandStructure } from '../../logic/efficiency/blockAnalyzer'
import { PracticeQuestion } from '../../data/practiceQuestions'
import { DiscardAnalysis } from '../../logic/efficiency/ukeire'
import { Tile } from '../../logic/shared/tiles'

interface Props {
  structure: HandStructure
  question?: PracticeQuestion
  optimalAnalysis: DiscardAnalysis
  userDiscard?: Tile | null
  isUserOptimal: boolean
}

export const CoachDecisionFlow: React.FC<Props> = ({
  structure,
  question,
  optimalAnalysis,
  userDiscard,
  isUserOptimal,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1)

  // Hand skeleton counts
  const meldsCount = structure.blocks.filter((b) => b.type === 'mentsu-shunzi' || b.type === 'mentsu-kezi').length
  const taatsuCount = structure.blocks.filter(
    (b) =>
      b.type === 'taatsu-ryanmen' ||
      b.type === 'taatsu-kanchan' ||
      b.type === 'taatsu-penchan' ||
      b.type === 'taatsu-complex'
  ).length
  const pairCount = structure.blocks.filter((b) => b.type === 'jantou').length
  const isolatedCount = structure.blocks.filter((b) => b.type === 'isolated').length

  const getSkeletonSummary = () => {
    const parts: string[] = []
    if (meldsCount > 0) parts.push(`${meldsCount}组面子`)
    if (taatsuCount > 0) parts.push(`${taatsuCount}组搭子`)
    if (pairCount > 0) parts.push(`${pairCount}个雀头/对子`)
    if (isolatedCount > 0) parts.push(`${isolatedCount}张孤张`)
    return parts.join(' + ')
  }

  return (
    <div className="practice-coach-flow-card card">
      <div className="coach-flow-header">
        <div className="coach-flow-title-row">
          <span className="coach-flow-avatar">👨‍🏫</span>
          <div className="coach-flow-title-box">
            <h4 className="coach-flow-title">教练三步决策流（从入门到高手思路）</h4>
            <span className="coach-flow-subtitle">日麻大师的思考模型：1️⃣数面子搭子 ➔ 2️⃣找矛盾 ➔ 3️⃣定决策</span>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="coach-step-pills">
          <button className={`step-pill-btn ${activeStep === 1 ? 'step-active' : ''}`} onClick={() => setActiveStep(1)}>
            1️⃣ 数面子搭子
          </button>
          <button className={`step-pill-btn ${activeStep === 2 ? 'step-active' : ''}`} onClick={() => setActiveStep(2)}>
            2️⃣ 找矛盾
          </button>
          <button className={`step-pill-btn ${activeStep === 3 ? 'step-active' : ''}`} onClick={() => setActiveStep(3)}>
            3️⃣ 定决策
          </button>
        </div>
      </div>

      <div className="coach-flow-body">
        {/* Step 1: Count Blocks */}
        {activeStep === 1 && (
          <div className="flow-step-content step-1-fade">
            <div className="step-tag-row">
              <span className="step-number-badge">步骤 1</span>
              <h5 className="step-heading">盘点面子与搭子：手牌结构全局诊断</h5>
              <span className="step-structure-status-pill">{structure.statusTitle}</span>
            </div>

            <div className="step-skeleton-box">
              <div className="skeleton-numbers-row">
                <div className="skeleton-chip">
                  <span className="chip-label">当前构成</span>
                  <span className="chip-val">{getSkeletonSummary()}</span>
                </div>
                <div className="skeleton-chip">
                  <span className="chip-label">总结构块数</span>
                  <span className="chip-val">{meldsCount + taatsuCount + pairCount + isolatedCount} 块</span>
                </div>
              </div>

              <div className="skeleton-insight-text">
                <p>
                  📌 <strong>构型研判：</strong>
                  {structure.status === 'five-blocks'
                    ? '手牌已经正好具备 5 组核心面子/搭子/雀头，五块已齐！此时所有多余孤张浮牌的靠张价值清零，任务是清理浮牌。'
                    : structure.status === 'over-blocks'
                    ? '手牌搭子数量超过了 5 块（搭子超载）！必须在各个搭子之间进行优劣比拼，果断拆除最弱搭（如死边张或弱坎张）。'
                    : '手牌核心搭子尚未凑齐 5 块（搭子不足）！此时必须依靠手中的中张孤张去靠出新搭子，绝不可乱切有潜力的中张。'}
                </p>
              </div>
            </div>

            <div className="step-action-footer">
              <button className="btn-step-next" onClick={() => setActiveStep(2)}>
                下一步：看核心矛盾 ➔
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Identify Conflict */}
        {activeStep === 2 && (
          <div className="flow-step-content step-2-fade">
            <div className="step-tag-row">
              <span className="step-number-badge">步骤 2</span>
              <h5 className="step-heading">找矛盾：锁定当局核心抉择焦点</h5>
            </div>

            <div className="step-explanation-box">
              {question ? (
                <div className="curated-explanation-text">
                  <p>{question.coachExplanation}</p>
                </div>
              ) : (
                <div className="dynamic-explanation-text">
                  <p>
                    当前局面切除 <strong>{optimalAnalysis.discardTile.toString()}</strong> 是进张最大的分水岭。
                    手牌在向听推进时，切除此牌能够保留最优搭子组合，将总进张维持在最高{' '}
                    <strong>{optimalAnalysis.totalUkeire} 张</strong>！
                  </p>
                </div>
              )}
            </div>

            <div className="step-action-footer">
              <button className="btn-step-prev" onClick={() => setActiveStep(1)}>
                ⬅️ 上一步
              </button>
              <button className="btn-step-next" onClick={() => setActiveStep(3)}>
                下一步：定决策口诀 ➔
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Make Decision & Formula */}
        {activeStep === 3 && (
          <div className="flow-step-content step-3-fade">
            <div className="step-tag-row">
              <span className="step-number-badge">步骤 3</span>
              <h5 className="step-heading">定决策：核心口诀与实战结论</h5>
            </div>

            {/* Formula / Takeaway Box */}
            <div className="step-takeaway-banner">
              <span className="formula-icon">💡</span>
              <div className="formula-content">
                <span className="formula-title">实战黄金口诀</span>
                <p className="formula-text">
                  {question?.coachTakeaway || '牌效基本盘：面子优先，两面次之，中张留靠，字牌先走！'}
                </p>
              </div>
            </div>

            <div className="step-verdict-summary">
              <div className="verdict-highlight-row">
                <span className="verdict-label">最终推荐切出：</span>
                <span className="verdict-tile-pill">
                  {question?.optimalDiscards.join(' 或 ') || optimalAnalysis.discardTile.toString()}
                </span>
                <span className="verdict-reason">（总进张 {optimalAnalysis.totalUkeire} 张，向听数维持最前线）</span>
              </div>

              {userDiscard && (
                <div className="verdict-user-eval" style={{ marginTop: '8px', fontSize: '0.84rem' }}>
                  {isUserOptimal ? (
                    <span className="text-success" style={{ fontWeight: 600 }}>
                      ✅ 你切出的 {userDiscard.toString()} 完美契合正解决策！
                    </span>
                  ) : (
                    <span className="text-danger" style={{ fontWeight: 600 }}>
                      ⚠️ 你切出的 {userDiscard.toString()} 偏离了最优路线，建议结合上述三步重新审视。
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="step-action-footer">
              <button className="btn-step-prev" onClick={() => setActiveStep(2)}>
                ⬅️ 查看矛盾分析
              </button>
              <button className="btn-step-restart" onClick={() => setActiveStep(1)}>
                🔄 重看第一步
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
