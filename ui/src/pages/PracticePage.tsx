import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Tile } from '../logic/shared/tiles'
import { PRACTICE_QUESTIONS, CHAPTERS, PracticeQuestion } from '../data/practiceQuestions'
import { analyzeAllDiscards, DiscardAnalysis } from '../logic/efficiency/ukeire'
import { analyzeHandStructure, HandStructure } from '../logic/efficiency/blockAnalyzer'
import { generateRandomPracticeHand } from '../logic/efficiency/randomHandGenerator'
import { TileComponent } from '../components/shared/TileComponent'
import { BlockBreakdownView } from '../components/practice/BlockBreakdownView'
import { DiscardAnalysisTable } from '../components/practice/DiscardAnalysisTable'
import { TheoryGuideModal } from '../components/practice/TheoryGuideModal'
import { DiscardDuelCard } from '../components/practice/DiscardDuelCard'
import { CoachDecisionFlow } from '../components/practice/CoachDecisionFlow'
import { WhatIfSimulator } from '../components/practice/WhatIfSimulator'
import { sortTiles } from '../logic/shared/tileUtils'

type PracticeMode = 'curated' | 'infinite'
type HandViewMode = 'compact' | 'xray'

/**
 * Organizes a 14-tile hand in authentic Riichi Mahjong table layout:
 * The first 13 tiles are sorted by suit & rank (万 ➔ 饼 ➔ 条 ➔ 字),
 * and the 14th tile is the newly drawn tile (摸牌), placed at the far right.
 */
function organizeHandWithDrawn(rawTiles: Tile[]): Tile[] {
  if (rawTiles.length <= 1) return rawTiles
  const handPart = sortTiles(rawTiles.slice(0, rawTiles.length - 1))
  const drawnTile = rawTiles[rawTiles.length - 1]
  return [...handPart, drawnTile]
}

function getActualDoraName(indicator: Tile): string {
  if (indicator.suit === 'm' || indicator.suit === 'p' || indicator.suit === 's') {
    const nextRank = indicator.rank === 9 ? 1 : indicator.rank + 1
    const suitName = indicator.suit === 'm' ? '万' : indicator.suit === 'p' ? '饼' : '索'
    return `${nextRank}${suitName}`
  }
  if (indicator.isWind) {
    const windNames = ['东', '南', '西', '北']
    const nextWind = windNames[indicator.rank % 4]
    return `${nextWind}风`
  }
  if (indicator.isDragon) {
    if (indicator.rank === 7) return '发'
    if (indicator.rank === 6) return '中'
    if (indicator.rank === 5) return '白'
  }
  return ''
}

export const PracticePage: React.FC = () => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(
    searchParams?.get('mode') === 'infinite' ? 'infinite' : 'curated'
  )
  const [handViewMode, setHandViewMode] = useState<HandViewMode>(
    searchParams?.get('view') === 'xray' ? 'xray' : 'compact'
  )
  const [isTheoryOpen, setIsTheoryOpen] = useState(searchParams?.get('theory') === '1')

  // Curated Mode State
  const [currentChapterId, setCurrentChapterId] = useState<number>(() => {
    const ch = searchParams?.get('ch')
    return ch ? parseInt(ch, 10) || 1 : 1
  })
  const [questionIndexInChapter, setQuestionIndexInChapter] = useState<number>(() => {
    const q = searchParams?.get('q')
    return q ? parseInt(q, 10) || 0 : 0
  })

  // Infinite Mode State
  const [infiniteHand, setInfiniteHand] = useState<Tile[]>(() => generateRandomPracticeHand(2))
  const [infiniteCount, setInfiniteCount] = useState<number>(1)
  const [infiniteScore, setInfiniteScore] = useState<{ total: number; optimal: number }>({
    total: 0,
    optimal: 0,
  })

  // Common Practice State
  const [userDiscard, setUserDiscard] = useState<Tile | null>(() => {
    const disc = searchParams?.get('discard')
    return disc ? Tile.fromString(disc) : null
  })
  const [hasAnswered, setHasAnswered] = useState<boolean>(() => {
    return Boolean(searchParams?.get('discard'))
  })

  // Questions for active chapter
  const chapterQuestions = useMemo(() => {
    return PRACTICE_QUESTIONS.filter((q) => q.chapterId === currentChapterId)
  }, [currentChapterId])

  const currentCuratedQuestion: PracticeQuestion | undefined = chapterQuestions[questionIndexInChapter]

  // Parse current hand tiles (13 sorted + 1 drawn tile at far right)
  const currentHandTiles: Tile[] = useMemo(() => {
    let raw: Tile[] = []
    if (practiceMode === 'curated') {
      if (!currentCuratedQuestion) return []
      raw = currentCuratedQuestion.hand
        .trim()
        .split(/\s+/)
        .map((s) => Tile.fromString(s))
    } else {
      raw = infiniteHand
    }
    return organizeHandWithDrawn(raw)
  }, [practiceMode, currentCuratedQuestion, infiniteHand])

  // Analyses
  const discardAnalyses: DiscardAnalysis[] = useMemo(() => {
    if (currentHandTiles.length === 0) return []
    return analyzeAllDiscards(currentHandTiles)
  }, [currentHandTiles])

  const handStructure: HandStructure = useMemo(() => {
    if (currentHandTiles.length === 0) {
      return {
        blocks: [],
        status: 'five-blocks',
        statusTitle: '',
        statusExplanation: '',
        totalBlockCount: 0,
      }
    }
    return analyzeHandStructure(currentHandTiles)
  }, [currentHandTiles])

  // Optimal discards list
  const optimalDiscardStrings = useMemo(() => {
    if (practiceMode === 'curated' && currentCuratedQuestion) {
      return currentCuratedQuestion.optimalDiscards
    }
    return discardAnalyses.filter((a) => a.isOptimal).map((a) => a.discardTile.toString())
  }, [practiceMode, currentCuratedQuestion, discardAnalyses])

  // Reset answer when question changes
  const isFirstMount = React.useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setUserDiscard(null)
    setHasAnswered(false)
  }, [practiceMode, currentChapterId, questionIndexInChapter, infiniteCount])

  // Handle tile click
  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (hasAnswered) return
      setUserDiscard(tile)
      setHasAnswered(true)

      const isOpt = optimalDiscardStrings.includes(tile.toString())
      if (practiceMode === 'infinite') {
        setInfiniteScore((prev) => ({
          total: prev.total + 1,
          optimal: prev.optimal + (isOpt ? 1 : 0),
        }))
      }
    },
    [hasAnswered, optimalDiscardStrings, practiceMode]
  )

  // Next Question Handlers
  const handleNextCurated = () => {
    if (questionIndexInChapter < chapterQuestions.length - 1) {
      setQuestionIndexInChapter((prev) => prev + 1)
    } else if (currentChapterId < CHAPTERS.length) {
      setCurrentChapterId((prev) => prev + 1)
      setQuestionIndexInChapter(0)
    } else {
      // Finished all chapters! loop back or stay
      setQuestionIndexInChapter(0)
    }
  }

  const handleNextInfinite = () => {
    setInfiniteHand(generateRandomPracticeHand(2))
    setInfiniteCount((c) => c + 1)
  }

  const handleRetry = () => {
    setUserDiscard(null)
    setHasAnswered(false)
  }

  // Answer Evaluation
  const userAnalysis = useMemo(() => {
    if (!userDiscard) return null
    return discardAnalyses.find((a) => a.discardTile.equals(userDiscard)) || null
  }, [userDiscard, discardAnalyses])

  const optimalAnalysis = useMemo(() => {
    return discardAnalyses.find((a) => a.isOptimal) || discardAnalyses[0] || null
  }, [discardAnalyses])

  const isUserOptimal = useMemo(() => {
    if (!userDiscard) return false
    return optimalDiscardStrings.includes(userDiscard.toString())
  }, [userDiscard, optimalDiscardStrings])

  const isUserViable = useMemo(() => {
    if (!userDiscard || isUserOptimal) return false
    if (practiceMode === 'curated' && currentCuratedQuestion?.viableDiscards) {
      return currentCuratedQuestion.viableDiscards.includes(userDiscard.toString())
    }
    return userAnalysis?.isViable ?? false
  }, [userDiscard, isUserOptimal, practiceMode, currentCuratedQuestion, userAnalysis])

  return (
    <div className="practice-page-container">
      {/* Top Banner & Mode Selector */}
      <div className="practice-header-bar card">
        <div className="practice-header-title-box">
          <div className="title-row">
            <h2>🀄 日麻切牌练习（何切る）</h2>
            <span className="zen-mode-tag">🧘 沉浸思考模式（无倒计时压力）</span>
          </div>
          <p className="practice-subtitle">
            专注门清纯牌效，剖析手牌五块骨架，无论选对选错，都带你探究背后的牌理真相。
          </p>
        </div>

        <div className="practice-top-actions">
          <button className="btn-theory-guide" onClick={() => setIsTheoryOpen(true)}>
            📖 牌效速查手册
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="practice-mode-tabs">
        <button
          className={`mode-tab-btn ${practiceMode === 'curated' ? 'active' : ''}`}
          onClick={() => setPracticeMode('curated')}
        >
          🎓 关卡进阶教学 ({PRACTICE_QUESTIONS.length} 题)
        </button>
        <button
          className={`mode-tab-btn ${practiceMode === 'infinite' ? 'active' : ''}`}
          onClick={() => setPracticeMode('infinite')}
        >
          ♾️ 无限随机演练（算法实时手牌）
        </button>
      </div>

      {/* Curated Chapter Selector */}
      {practiceMode === 'curated' && (
        <div className="chapter-selector-bar">
          <div className="chapter-pills-row">
            {CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                className={`chapter-pill-btn ${currentChapterId === ch.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentChapterId(ch.id)
                  setQuestionIndexInChapter(0)
                }}
              >
                <span className="chapter-pill-icon">{ch.icon}</span>
                <span className="chapter-pill-text">{ch.shortTitle}</span>
              </button>
            ))}
          </div>

          <div className="question-nav-row">
            <span className="question-progress-label">
              第 {currentChapterId} 章：第 {questionIndexInChapter + 1} / {chapterQuestions.length} 题
            </span>
            <div className="question-dots-list">
              {chapterQuestions.map((_, idx) => (
                <button
                  key={idx}
                  className={`dot-btn ${idx === questionIndexInChapter ? 'dot-active' : ''}`}
                  onClick={() => setQuestionIndexInChapter(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Infinite Mode Stats Bar */}
      {practiceMode === 'infinite' && (
        <div className="infinite-stats-bar card">
          <div className="infinite-stat-item">
            <span className="stat-label">已练手数:</span>
            <span className="stat-val">{infiniteCount} 手</span>
          </div>
          <div className="infinite-stat-item">
            <span className="stat-label">最佳切牌命中率:</span>
            <span className="stat-val stat-highlight">
              {infiniteScore.total > 0 ? `${Math.round((infiniteScore.optimal / infiniteScore.total) * 100)}%` : '0%'}
            </span>
            <span className="stat-subval">
              ({infiniteScore.optimal}/{infiniteScore.total})
            </span>
          </div>
          <button className="btn-secondary" onClick={handleNextInfinite}>
            换一手牌 ➔
          </button>
        </div>
      )}

      {/* Question Header Card */}
      <div className="practice-question-card card">
        <div className="question-meta-row">
          <div className="question-title-area">
            <h3 className="question-title">
              {practiceMode === 'curated' && currentCuratedQuestion
                ? currentCuratedQuestion.title
                : `无限演练第 ${infiniteCount} 手（何切る）`}
            </h3>
            <p className="question-subtitle">
              {practiceMode === 'curated' && currentCuratedQuestion
                ? currentCuratedQuestion.subtitle
                : '观察手牌面子与搭子构型，点击你认为此时纯牌效最合理的切牌。'}
            </p>
          </div>

          {practiceMode === 'curated' && currentCuratedQuestion && (
            <div className="concept-tags-list">
              {currentCuratedQuestion.conceptTags.map((tag, idx) => (
                <span key={idx} className="concept-tag-badge">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Game Situation Environment Bar (场风、门风、巡目、宝牌) */}
        <div className="game-context-bar">
          <div className="context-items-group">
            <div className="context-item">
              <span className="context-label">局况场风:</span>
              <span className="context-badge badge-round-wind">
                {practiceMode === 'curated' && currentCuratedQuestion
                  ? `${currentCuratedQuestion.roundWind}场`
                  : '东场'}
              </span>
            </div>
            <div className="context-item">
              <span className="context-label">自家门风:</span>
              <span className="context-badge badge-seat-wind">
                {practiceMode === 'curated' && currentCuratedQuestion
                  ? `${currentCuratedQuestion.seatWind}家 ${
                      currentCuratedQuestion.seatWind === '东' ? '(庄家)' : '(闲家)'
                    }`
                  : '南家 (闲家)'}
              </span>
            </div>
            <div className="context-item">
              <span className="context-label">巡目:</span>
              <span className="context-val">
                第 {practiceMode === 'curated' && currentCuratedQuestion ? currentCuratedQuestion.turnNumber : 4} 巡
              </span>
            </div>
            {practiceMode === 'curated' && currentCuratedQuestion?.doraIndicator && (
              <div className="context-item context-dora">
                <span className="context-label">宝牌指示牌:</span>
                <div className="dora-indicator-box">
                  <TileComponent tile={Tile.fromString(currentCuratedQuestion.doraIndicator)} size="small" />
                  <span className="actual-dora-pill">
                    ➔ 实际宝牌:{' '}
                    <strong>{getActualDoraName(Tile.fromString(currentCuratedQuestion.doraIndicator))}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="context-wind-summary">
            {practiceMode === 'curated' && currentCuratedQuestion ? (
              <span className="wind-tip-text">
                💡 此时役牌：
                <strong>
                  {currentCuratedQuestion.roundWind === currentCuratedQuestion.seatWind
                    ? `双${currentCuratedQuestion.roundWind} (连风2番)`
                    : `${currentCuratedQuestion.roundWind}风(场风)、${currentCuratedQuestion.seatWind}风(自风)`}
                  、中、发、白
                </strong>
                （其余字牌均为无番客风）
              </span>
            ) : (
              <span className="wind-tip-text">💡 役牌：东风(场风)、南风(自风)、中、发、白</span>
            )}
          </div>
        </div>

        {/* Mahjong Felt Table & Interactive Hand */}
        <div className="mahjong-table-felt">
          <div className="felt-header-toolbar">
            <div className="felt-notice-bar">
              {!hasAnswered ? (
                <span className="felt-status-text">👉 请点击你想要切出的手牌</span>
              ) : (
                <span className="felt-status-text felt-status-answered">
                  ✅ 已切出：
                  {userDiscard && <span className="discarded-text-tag">{userDiscard.toString()}</span>}
                  （下滑查看完整牌理复盘）
                </span>
              )}
            </div>

            {/* Hand In-Place View Toggle: 标准理牌 vs 面子/搭子透视 */}
            <div className="felt-view-toggle">
              <button
                className={`felt-toggle-btn ${handViewMode === 'compact' ? 'active' : ''}`}
                onClick={() => setHandViewMode('compact')}
              >
                🀄 标准理牌
              </button>
              <button
                className={`felt-toggle-btn btn-xray ${handViewMode === 'xray' ? 'active' : ''}`}
                onClick={() => setHandViewMode('xray')}
              >
                🧩 面子/搭子透视
              </button>
            </div>
          </div>

          {/* Hand Display */}
          {handViewMode === 'compact' ? (
            <div className="table-hand-row">
              {currentHandTiles.map((tile, idx) => {
                const isSelected = userDiscard && tile.equals(userDiscard)
                const isDrawnTile = idx === currentHandTiles.length - 1
                return (
                  <div
                    key={idx}
                    className={`interactive-tile-wrapper ${isSelected ? 'tile-user-discarded' : ''} ${
                      isDrawnTile ? 'tile-drawn-separated' : ''
                    } ${!hasAnswered ? 'tile-clickable' : ''}`}
                  >
                    <TileComponent tile={tile} size="normal" onClick={() => handleTileClick(tile)} disabled={false} />
                    {isSelected && <div className="discard-indicator-arrow">切</div>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="table-xray-blocks-row">
              {handStructure.blocks.map((block, bIdx) => (
                <div key={bIdx} className={`xray-table-block-group block-${block.quality}`}>
                  <div className="xray-tiles-subgroup">
                    {block.tiles.map((tile, tIdx) => {
                      const isSelected = userDiscard && tile.equals(userDiscard)
                      return (
                        <div
                          key={tIdx}
                          className={`interactive-tile-wrapper ${isSelected ? 'tile-user-discarded' : ''} ${
                            !hasAnswered ? 'tile-clickable' : ''
                          }`}
                        >
                          <TileComponent
                            tile={tile}
                            size="normal"
                            onClick={() => handleTileClick(tile)}
                            disabled={false}
                          />
                          {isSelected && <div className="discard-indicator-arrow">切</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="xray-group-badge">
                    <span className="xray-badge-name">{block.name}</span>
                    {block.type === 'isolated' && <span className="xray-badge-icon">✂️ 浮牌</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Immediate Review and Action Bar after Selection */}
        {hasAnswered && (
          <div className="post-answer-actions-bar">
            <button className="btn-secondary" onClick={handleRetry}>
              🔄 重新作答本题
            </button>
            <button
              className="btn-primary"
              onClick={practiceMode === 'curated' ? handleNextCurated : handleNextInfinite}
            >
              下一题 ➔
            </button>
          </div>
        )}
      </div>

      {/* Evaluation & Pedagogical Feedback Panel (Appears once answered) */}
      {hasAnswered && userDiscard && (
        <div className="practice-feedback-section">
          {/* 1. 切牌 PK 擂台 (The Discard Duel) */}
          <DiscardDuelCard
            userDiscard={userDiscard}
            optimalDiscard={optimalAnalysis?.discardTile || userDiscard}
            userAnalysis={userAnalysis}
            optimalAnalysis={optimalAnalysis || userAnalysis!}
            isUserOptimal={isUserOptimal}
            isUserViable={isUserViable}
            mistakeExplanation={
              practiceMode === 'curated' && currentCuratedQuestion?.mistakeExplanations
                ? currentCuratedQuestion.mistakeExplanations[userDiscard.toString()]
                : undefined
            }
          />

          {/* 2. 进张推演沙盘 (What-If Interactive Draw Simulator) */}
          <WhatIfSimulator
            handTiles={currentHandTiles}
            effectiveDiscard={userDiscard}
            analyses={discardAnalyses}
            question={practiceMode === 'curated' ? currentCuratedQuestion : undefined}
            userDiscard={userDiscard}
          />

          {/* 3. 教练三步决策流 (Coach 3-Step Decision Flow) */}
          <CoachDecisionFlow
            structure={handStructure}
            question={practiceMode === 'curated' ? currentCuratedQuestion : undefined}
            optimalAnalysis={optimalAnalysis || userAnalysis!}
            userDiscard={userDiscard}
            isUserOptimal={isUserOptimal}
          />

          {/* 4. 五块骨架透视器 (Decluttered Five-Block Structure Breakdown) */}
          <BlockBreakdownView structure={handStructure} />

          {/* 5. 全手牌切牌受入一览表 (All Discards Deep Matrix) */}
          <DiscardAnalysisTable
            analyses={discardAnalyses}
            selectedDiscard={userDiscard}
            onSelectRow={(tile) => setUserDiscard(tile)}
          />

          {/* Bottom Next Button */}
          <div className="bottom-action-banner">
            <button className="btn-secondary" onClick={handleRetry}>
              🔄 重新作答本题
            </button>
            <button
              className="btn-primary btn-large-next"
              onClick={practiceMode === 'curated' ? handleNextCurated : handleNextInfinite}
            >
              继续下一题 ➔
            </button>
          </div>
        </div>
      )}

      {/* Theory Guide Modal */}
      <TheoryGuideModal isOpen={isTheoryOpen} onClose={() => setIsTheoryOpen(false)} />
    </div>
  )
}

export default PracticePage
