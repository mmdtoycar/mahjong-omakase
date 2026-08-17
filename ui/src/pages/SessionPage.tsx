import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSessionDetail, addRound, deleteRound, completeSession } from '../api'
import { SessionDetail, PlayerInfo, RoundInfo } from '../types'
import { rankByScore } from '../logic/ranking'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'
import { MahjongHand } from '../components/MahjongHand'
import { tableNameFontSize } from '../utils/fontSize'
import { useIsMobile } from '../hooks/useIsMobile'
import { deriveGameState, deriveRoundState, getWindName } from '../utils/gameState'
import { scoreClass, parseError, seatRankMedal } from '../utils/format'
import { MSG } from '../constants'
import { RankBadge } from '../components/RankBadge'
import { TableStrengthTag } from '../components/TableStrengthTag'
import { PhotoRecognitionModal, RecognizedHand, winHandToLabel } from '../components/PhotoRecognitionModal'
import { Meld as GuobiaoMeld } from '../logic/guobiao/types'
import { Meld as RiichiMeld } from '../logic/riichi/types'
import { ImportedHand, toGuobiaoMelds, toRiichiMelds } from '../logic/shared/importedHand'
import { nextWinSelection } from '../logic/shared/winSelection'

const ROUND_COL_PX = 68

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [winnerId, setWinnerId] = useState<string>('')
  const [score, setScore] = useState('')
  const [fan, setFan] = useState<string>('')
  const [isSelfDraw, setIsSelfDraw] = useState(false)
  const [dealInPlayerId, setDealInPlayerId] = useState<string>('')
  const [bimenPlayerIds, setBimenPlayerIds] = useState<number[]>([])
  const [isRyuukyoku, setIsRyuukyoku] = useState(false)
  const [tenpaiPlayerIds, setTenpaiPlayerIds] = useState<number[]>([])
  const [riichiPlayerIds, setRiichiPlayerIds] = useState<number[]>([])
  const [calcResetCount, setCalcResetCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [winHand, setWinHand] = useState<string>('')
  const [fanDetails, setFanDetails] = useState<string>('')
  const [fanCount, setFanCount] = useState<number>(0)
  const [tsumoDetail, setTsumoDetail] = useState<{ dealer: number; nonDealer: number } | null>(null)
  const [isChomboManual, setIsChomboManual] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [error, setError] = useState('')

  // Photo Recognition State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)
  const [gbImportedHand, setGbImportedHand] = useState<ImportedHand<GuobiaoMeld> | null>(null)
  const [riichiImportedHand, setRiichiImportedHand] = useState<ImportedHand<RiichiMeld> | null>(null)
  // Every sample recognised while composing this round, success or miss — a retaken photo included.
  // Confirmed against whatever the calculator ends up with at submission time, not when a result was
  // applied, so corrections made afterward still end up as the training label.
  const [photoSampleIds, setPhotoSampleIds] = useState<string[]>([])

  const handleCalcScoreSelect = useCallback((s: number | null, hand?: string, details?: string, fCount?: number) => {
    if (s !== null) {
      setScore(String(s))
      setWinHand(hand || '')
      setFanDetails(details || '')
      setFanCount(fCount || 0)
    } else {
      setScore('')
      setWinHand('')
      setFanDetails('')
      setFanCount(0)
    }
  }, [])

  const handleCalcError = useCallback((msg: string | null) => {
    setCalcError(msg || '')
  }, [])

  const handleRiichiCalcSelect = useCallback(
    (
      s: number | null,
      hand?: string,
      details?: string,
      fCount?: number,
      tsumo?: { dealer: number; nonDealer: number } | null
    ) => {
      if (s !== null) {
        setScore(String(s))
        setWinHand(hand || '')
        setFanDetails(details || '')
        setFanCount(fCount || 0)
        setTsumoDetail(tsumo || null)
      } else {
        setScore('')
        setWinHand('')
        setFanDetails('')
        setFanCount(0)
        setTsumoDetail(null)
      }
    },
    []
  )

  const load = async () => {
    const detail = await fetchSessionDetail(Number(id))
    setSession(detail)
    setError('')
  }

  useEffect(() => {
    load().catch((e: unknown) => setError(parseError(e)))
  }, [id])

  if (!session)
    return (
      <div className="empty-state">
        <p>{error || MSG.LOADING}</p>
      </div>
    )

  const isRiichi = session.gameMode === 'RIICHI'
  const isDongbei = session.gameMode === 'DONGBEI'
  const isGuobiao = session.gameMode === 'GUOBIAO'

  const resetForm = () => {
    setWinnerId('')
    setScore('')
    setFan('')
    setBimenPlayerIds([])
    setIsSelfDraw(false)
    setDealInPlayerId('')
    setIsRyuukyoku(false)
    setTenpaiPlayerIds([])
    setRiichiPlayerIds([])
    setWinHand('')
    setFanDetails('')
    setFanCount(0)
    setTsumoDetail(null)
    setIsChomboManual(false)
    setCalcError('')
    setCalcResetCount((prev) => prev + 1)
    setGbImportedHand(null)
    setRiichiImportedHand(null)
    setPhotoSampleIds([])
  }

  /**
   * 一个按钮承担"选人"和"定胡法"两件事, 靠点几下区分 —— 循环规则见 nextWinSelection,
   * 那边是纯函数并有穷举测试, 这里只做状态映射。
   */
  const handlePlayerClick = (pid: string) => {
    const next = nextWinSelection(
      {
        winnerId,
        dealInPlayerId,
        kind: isChomboManual ? 'chombo' : isSelfDraw ? 'tsumo' : 'ron',
      },
      pid,
      isGuobiao
    )
    setWinnerId(next.winnerId)
    setDealInPlayerId(next.dealInPlayerId)
    setIsSelfDraw(next.kind === 'tsumo')
    setIsChomboManual(next.kind === 'chombo')
  }

  const canSubmit =
    winnerId &&
    (isChomboManual || (isDongbei ? fan : score && parseInt(score) >= (isGuobiao ? 8 : 100))) &&
    (isChomboManual || isSelfDraw || dealInPlayerId)

  const getValidationHint = (): string | null => {
    if (!winnerId) return isChomboManual ? '请选择诈胡玩家' : '请选择赢家'
    if (isChomboManual) return null
    if (!isSelfDraw && !dealInPlayerId) return '请选择点炮玩家，或切换为自摸'
    if (isDongbei) {
      if (!fan) return '请输入番数'
      if (isNaN(parseInt(fan))) return '番数必须是数字'
      return null
    }
    if (!score) return '请输入分数或手牌'
    if (isNaN(parseInt(score))) return '请输入有效数字'
    if (isRiichi && parseInt(score) < 100) return '分数必须 ≥ 100'
    if (isRiichi && parseInt(score) % 100 !== 0) return '分数必须是100的倍数'
    if (isGuobiao && parseInt(score) < 8) return '分数必须 ≥ 8'
    return null
  }

  const validationHint = getValidationHint()

  const handleAddRound = async () => {
    setError('')
    if (validationHint && !isRyuukyoku) return
    setSubmitting(true)
    try {
      if (isRyuukyoku) {
        await addRound(session.id, {
          roundType: 'DRAWN_GAME',
          tenpaiPlayerIds,
          riichiPlayerIds: riichiPlayerIds.length > 0 ? riichiPlayerIds : undefined,
        })
        resetForm()
        await load()
        return
      }
      if (!canSubmit) return
      // Confirmed against what the calculator actually ended up with, corrections included — not
      // against whatever recognition first applied. isChomboManual is excluded on its own: winHand
      // can still hold a stale hand from before the 诈胡 toggle, and a chombo round is not a hand.
      const confirmedHand = winHand && !isChomboManual ? { ...winHandToLabel(winHand), isSelfDraw } : undefined
      const sampleIds = photoSampleIds.length > 0 ? photoSampleIds : undefined
      if (isRiichi) {
        const scoreVal = parseInt(score)
        await addRound(session.id, {
          winnerId: Number(winnerId),
          score: scoreVal,
          dealerId: gameState.dealerPlayerId,
          honba: gameState.honba,
          kyoutaku: gameState.kyoutaku,
          dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
          fanCount: fanCount || scoreVal,
          winHand,
          fanDetails,
          riichiPlayerIds: riichiPlayerIds.length > 0 ? riichiPlayerIds : undefined,
          photoSampleIds: sampleIds,
          confirmedHand,
        })
      } else if (isDongbei) {
        await addRound(session.id, {
          winnerId: Number(winnerId),
          fan: parseInt(fan),
          dealerId: gameState.dealerPlayerId,
          bimenPlayerIds,
          dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
          fanCount: parseInt(fan),
        })
      } else {
        await addRound(session.id, {
          winnerId: Number(winnerId),
          score: isChomboManual ? undefined : parseInt(score),
          dealInPlayerId: isChomboManual ? null : isSelfDraw ? null : Number(dealInPlayerId),
          winHand,
          fanDetails: isChomboManual ? '【诈胡惩罚】' : fanDetails,
          fanCount: isChomboManual ? 0 : fanCount || parseInt(score),
          prevalentWind: gameState.prevalentWind,
          chombo: isChomboManual || undefined,
          photoSampleIds: sampleIds,
          confirmedHand,
        })
      }

      resetForm()
      await load()
    } catch (e: unknown) {
      setError(parseError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRound = async (roundNumber: number) => {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await deleteRound(session.id, roundNumber)
      await load()
    } catch (e: unknown) {
      setError(parseError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async () => {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await completeSession(session.id)
      await load()
    } catch (e: unknown) {
      setError(parseError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const sortedPlayers = [...session.players].sort(
    (a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0)
  )

  const rankings = rankByScore(
    session.players.map((p) => ({ playerId: p.id, score: session.totalScores[p.id] || 0 })),
    (s) => s.score
  )
  const rankMap = Object.fromEntries(rankings.map((r) => [r.playerId, r]))

  // 段位分变化 — 只有对局结束结算后才有值.
  const ratingDelta = (playerId: number) => session.ratingDeltas?.[playerId]
  const formatDelta = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)}`

  const gameState = deriveGameState(session)

  const winnerIndex = session.players.findIndex((p) => String(p.id) === winnerId)

  function getPlayerSeat(p: PlayerInfo, idx?: number) {
    return p.seat ?? (idx ?? 0) + 1
  }

  function getPlayerMenfeng(playerSeat: number) {
    return ((playerSeat - gameState.dealerSeat + gameState.playerCount) % gameState.playerCount) + 1
  }

  const winnerMenfeng =
    winnerIndex !== -1 ? getPlayerMenfeng(getPlayerSeat(session.players[winnerIndex], winnerIndex)) : 1

  const getRoundLabel = (round: RoundInfo) => {
    const state = deriveRoundState(session, round.roundNumber)
    return state.displayName
  }

  const fixedColPx = ROUND_COL_PX + (session.status === 'IN_PROGRESS' ? 32 : 0)
  const playerColStyle = {
    textAlign: 'center' as const,
    verticalAlign: 'top' as const,
    width: `calc((100% - ${fixedColPx}px) / ${session.players.length})`,
  }

  const otherPlayers = session.players.filter((p) => p.id !== Number(winnerId))
  const dealerId = String(gameState.dealerPlayerId)
  const winnerIsDealer = winnerId && winnerId === dealerId

  const getScorePreview = (): string | null => {
    if (isRiichi) {
      if (!score) return null
      const scoreVal = parseInt(score)
      if (isNaN(scoreVal) || scoreVal < 100 || scoreVal % 100 !== 0) return null

      const honbaNum = gameState.honba
      const kyoutakuNum = gameState.kyoutaku
      const uniqueRiichiCount = new Set(riichiPlayerIds).size
      const riichiPool = uniqueRiichiCount * 1000
      const winnerDeclaredRiichi = riichiPlayerIds.includes(Number(winnerId))
      const winnerRiichiNet = riichiPool - (winnerDeclaredRiichi ? 1000 : 0)
      const bonusPool = kyoutakuNum + winnerRiichiNet
      const bonusLabel = [
        kyoutakuNum > 0 ? `供托${kyoutakuNum}` : '',
        winnerRiichiNet > 0 ? `立直棒${winnerRiichiNet}` : '',
      ]
        .filter(Boolean)
        .join('+')

      if (isSelfDraw) {
        const honbaBonus = 100 * honbaNum
        if (tsumoDetail) {
          if (winnerIsDealer) {
            const each = tsumoDetail.nonDealer + honbaBonus
            const numOthers = session.playerCount - 1
            const winnerTotal = each * numOthers + bonusPool
            return `自摸 (亲家): ${numOthers}人各付${each}${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${
              bonusPool > 0 ? ` +${bonusLabel}` : ''
            } → 共+${winnerTotal}`
          } else {
            const dealerPays = tsumoDetail.dealer + honbaBonus
            const otherPays = tsumoDetail.nonDealer + honbaBonus
            const numNonDealers = session.playerCount - 2
            const total = dealerPays + numNonDealers * otherPays + bonusPool
            return `自摸: 亲家付${dealerPays}, ${numNonDealers > 0 ? `其他各付${otherPays}, ` : ''}${
              honbaNum > 0 ? `(含${honbaNum}本场) ` : ''
            }${bonusPool > 0 ? `+${bonusLabel} ` : ''}共+${total}`
          }
        }
        const total = scoreVal + bonusPool
        return `自摸: 共+${scoreVal}${bonusPool > 0 ? ` +${bonusLabel}` : ''} → 共+${total}`
      } else {
        const base = scoreVal + 300 * honbaNum
        const total = base + bonusPool
        return `荣和${winnerIsDealer ? ' (亲家)' : ''}: ${base}点${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${
          bonusPool > 0 ? ` +${bonusLabel}` : ''
        } → 共+${total}`
      }
    }

    if (isDongbei) {
      if (!fan || !winnerId) return null
      const fanNum = parseInt(fan)
      const bimenSet = new Set(bimenPlayerIds)
      const opponents = session.players.filter((p) => p.id !== Number(winnerId))
      const allBimen = opponents.length > 0 && opponents.every((p) => bimenSet.has(p.id))

      const parts: string[] = []
      let total = 0
      for (const p of opponents) {
        const isDealIn = !isSelfDraw && String(p.id) === dealInPlayerId
        const isBimen = bimenSet.has(p.id)
        const isOpponentDealer = String(p.id) === dealerId
        const pays = isDealIn || isSelfDraw || isBimen
        if (!pays) continue

        const zhuangjiaFlag = winnerIsDealer || isOpponentDealer ? 1 : 0
        const dianpaoFlag = isDealIn || isSelfDraw ? 1 : 0
        const bimenFlag = isBimen ? 1 : 0
        const sanjiaBimenFlag = allBimen ? 1 : 0
        const exponent = Math.min(fanNum + zhuangjiaFlag + dianpaoFlag + bimenFlag + sanjiaBimenFlag, 6)
        const payment = Math.pow(2, exponent)

        const flags: string[] = []
        if (zhuangjiaFlag) flags.push('庄')
        if (dianpaoFlag) flags.push(isSelfDraw ? '摸' : '炮')
        if (bimenFlag) flags.push('闭')
        if (sanjiaBimenFlag) flags.push('三闭')
        parts.push(`${p.userName}:${payment}${flags.length ? '(' + flags.join('+') + ')' : ''}`)
        total += payment
      }
      if (parts.length === 0) return null
      return `${parts.join(', ')} → 共+${total}`
    }

    if (isGuobiao) {
      if (!score || !winnerId) return null
      const s = parseInt(score)
      if (s <= 0) return null
      if (s < 8) return '国标麻将最低8分'
      if (isSelfDraw) {
        const numOthers = session.playerCount - 1
        return `自摸: ${numOthers}人各付${s + 8} → 共+${(s + 8) * numOthers}`
      } else {
        if (!dealInPlayerId) return null
        const dealInName = session.players.find((p) => p.id === Number(dealInPlayerId))?.userName
        const numOthers = session.playerCount - 2
        const dealInPays = s + 8
        const otherPay = 8
        const total = dealInPays + numOthers * otherPay
        return `点炮(${dealInName}): 付${dealInPays}, 其他${numOthers}人各付${otherPay} → 共+${total}`
      }
    }

    return null
  }

  const preview = getScorePreview()

  const getStatusMessage = (): { text: string; isError: boolean } | null => {
    if (error) return { text: error, isError: true }
    if (calcError) return { text: calcError, isError: true }
    if (!isRyuukyoku && validationHint) return { text: validationHint, isError: true }
    if (preview) return { text: preview, isError: false }
    return null
  }

  const statusMessage = getStatusMessage()

  const handleApplyRecognizedHand = (hand: RecognizedHand) => {
    if (isGuobiao) {
      setIsSelfDraw(hand.isSelfDraw)
      setGbImportedHand((prev) => ({
        concealed: hand.concealed,
        melds: toGuobiaoMelds(hand.melds),
        trigger: (prev?.trigger ?? 0) + 1,
      }))
    } else if (isRiichi) {
      setIsSelfDraw(hand.isSelfDraw)
      setRiichiImportedHand((prev) => ({
        concealed: hand.concealed,
        melds: toRiichiMelds(hand.melds),
        trigger: (prev?.trigger ?? 0) + 1,
      }))
    }
  }

  const handlePhotoSample = (sampleId: string | null) => {
    if (sampleId) setPhotoSampleIds((prev) => [...prev, sampleId])
  }

  return (
    <>
      {session.status === 'IN_PROGRESS' && (
        <div className="card">
          <div className="round-form">
            <h3 className="round-form-title">添加 — {gameState.displayName}</h3>
            {isRiichi && (
              <div className="form-group">
                <label className="checkbox-toggle">
                  <input
                    type="checkbox"
                    checked={isRyuukyoku}
                    onChange={(e) => {
                      resetForm()
                      setIsRyuukyoku(e.target.checked)
                    }}
                  />
                  <span>流局</span>
                </label>
              </div>
            )}

            {isRyuukyoku ? (
              <>
                <div className="quick-win-container">
                  <div className="quick-win-row">
                    {session.players.map((p, idx) => {
                      const isRiichiPlayer = riichiPlayerIds.includes(p.id)
                      const isTenpaiOnly = !isRiichiPlayer && tenpaiPlayerIds.includes(p.id)
                      let btnClass = 'quick-player-btn'
                      if (isRiichiPlayer) btnClass += ' winner'
                      if (isTenpaiOnly) btnClass += ' loser'

                      return (
                        <button
                          key={p.id}
                          className={btnClass}
                          onClick={() => {
                            if (isRiichiPlayer) {
                              setRiichiPlayerIds((prev) => prev.filter((id) => id !== p.id))
                              setTenpaiPlayerIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]))
                            } else if (isTenpaiOnly) {
                              setTenpaiPlayerIds((prev) => prev.filter((id) => id !== p.id))
                            } else {
                              setRiichiPlayerIds((prev) => [...prev, p.id])
                              setTenpaiPlayerIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]))
                            }
                          }}
                        >
                          <div className="btn-name">{p.userName}</div>
                          <div className={`btn-wind${p.id === gameState.dealerPlayerId ? ' btn-wind-dealer' : ''}`}>
                            {isRiichiPlayer
                              ? '立直'
                              : isTenpaiOnly
                              ? '默听'
                              : getWindName(getPlayerMenfeng(getPlayerSeat(p, idx)))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <span className="field-hint">
                  {tenpaiPlayerIds.length === 0 || tenpaiPlayerIds.length === session.players.length
                    ? '全员听牌或全员未听 → 无点数变动'
                    : `${tenpaiPlayerIds.length}人听牌, ${
                        session.players.length - tenpaiPlayerIds.length
                      }人未听 → 未听各付${3000 / (session.players.length - tenpaiPlayerIds.length)}, 听牌各得${
                        3000 / tenpaiPlayerIds.length
                      }`}
                </span>
                {riichiPlayerIds.length > 0 && (
                  <span className="field-hint">
                    {riichiPlayerIds.length}人立直 → 各扣1000, 供托 +{riichiPlayerIds.length * 1000}
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleAddRound} disabled={submitting}>
                  {submitting ? MSG.SUBMITTING : '添加流局'}
                </button>
              </>
            ) : (
              <>
                <div className="quick-win-container">
                  <h2>{isChomboManual ? '登记诈胡' : '算番器'}</h2>
                  <div className="quick-win-row">
                    {session.players.map((p, idx) => {
                      const isWinner = winnerId === String(p.id)
                      const isLoser = dealInPlayerId === String(p.id)
                      let btnClass = 'quick-player-btn'
                      if (isWinner) {
                        btnClass += isChomboManual ? ' chombo-offender' : ' winner'
                      }
                      if (isLoser && !isChomboManual && !isSelfDraw) btnClass += ' loser'

                      return (
                        <button key={p.id} className={btnClass} onClick={() => handlePlayerClick(String(p.id))}>
                          <div className="btn-name">{p.userName}</div>
                          <div className={`btn-wind${p.id === gameState.dealerPlayerId ? ' btn-wind-dealer' : ''}`}>
                            {/* 选中后第二行改写角色, 让"谁是什么"看文字而不是记颜色 —— 同流局分支. */}
                            {isWinner ? (
                              isChomboManual ? (
                                '诈胡'
                              ) : isSelfDraw ? (
                                '自摸'
                              ) : (
                                '和牌'
                              )
                            ) : isLoser && !isChomboManual && !isSelfDraw ? (
                              '点炮'
                            ) : (
                              <>
                                {getWindName(getPlayerMenfeng(getPlayerSeat(p, idx)))}
                                {p.id === gameState.dealerPlayerId ? ' 庄' : ''}
                              </>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <span className="field-hint">
                    {!winnerId
                      ? `点一下选和牌者 · 连点同一人切换自摸${isGuobiao ? '/诈胡' : ''}`
                      : isChomboManual
                      ? '再点一下清空重选'
                      : isSelfDraw
                      ? `自摸无需选点炮者 · 再点${isGuobiao ? '一下改诈胡' : '一下清空'}`
                      : '再点和牌者可切自摸' + (isGuobiao ? '/诈胡' : '') + ' · 另点一人为点炮者'}
                  </span>
                </div>

                {isRiichi && (
                  <div className="form-group">
                    <div className="score-inline-group">
                      <button type="button" className="btn-photo-rec" onClick={() => setIsPhotoModalOpen(true)}>
                        <span className="btn-photo-rec-icon">📷</span>
                        <span>拍照识别</span>
                        <span className="btn-photo-rec-badge">AI 识别</span>
                      </button>
                    </div>
                    <div className="inline-calc-wrapper">
                      <RiichiCalculator
                        key="riichi-calc"
                        onSelectScore={handleRiichiCalcSelect}
                        onError={handleCalcError}
                        initialOptions={{
                          changfeng: gameState.prevalentWind,
                          zifeng: winnerMenfeng,
                        }}
                        resetTrigger={calcResetCount}
                        isSelfDraw={isSelfDraw}
                        onIsSelfDrawChange={setIsSelfDraw}
                        playerCount={session.playerCount}
                        importedHand={riichiImportedHand}
                      />
                    </div>
                  </div>
                )}

                {isDongbei && (
                  <div className="round-form-grid">
                    <div className="form-group">
                      <label>番</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fan}
                        onChange={(e) => setFan(e.target.value)}
                        placeholder="输入番"
                      />
                    </div>
                  </div>
                )}

                {!isRiichi && isGuobiao && (
                  <div className="form-group">
                    {/* 诈胡 hides the calculator and needs no score, so the importer is moot too. */}
                    {!isChomboManual && (
                      <div className="score-inline-group">
                        <button type="button" className="btn-photo-rec" onClick={() => setIsPhotoModalOpen(true)}>
                          <span className="btn-photo-rec-icon">📷</span>
                          <span>拍照识别</span>
                          <span className="btn-photo-rec-badge">AI 识别</span>
                        </button>
                      </div>
                    )}
                    <div className="inline-calc-wrapper" style={{ display: isChomboManual ? 'none' : 'block' }}>
                      <GuobiaoCalculator
                        key="guobiao-calc"
                        onSelectScore={handleCalcScoreSelect}
                        initialOptions={{
                          quanfeng: gameState.prevalentWind,
                          menfeng: winnerMenfeng,
                        }}
                        resetTrigger={calcResetCount}
                        isSelfDraw={isSelfDraw}
                        onIsSelfDrawChange={setIsSelfDraw}
                        importedHand={gbImportedHand}
                      />
                    </div>
                  </div>
                )}

                {isDongbei && winnerId && (
                  <div className="form-group">
                    <label>闭门</label>
                    <div className="player-chips">
                      {otherPlayers.map((p) => (
                        <span
                          key={p.id}
                          className={`chip ${bimenPlayerIds.includes(p.id) ? 'selected' : ''}`}
                          onClick={() =>
                            setBimenPlayerIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                        >
                          {p.userName}
                          {bimenPlayerIds.includes(p.id) && ' ✓'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {statusMessage && (
                  <div className={`status-box${statusMessage.isError ? ' error' : ''}`}>{statusMessage.text}</div>
                )}

                {isRiichi && !isRyuukyoku && (
                  <div className="form-group">
                    <label>本局立直</label>
                    <div className="player-chips">
                      {session.players.map((p) => (
                        <span
                          key={p.id}
                          className={`chip ${riichiPlayerIds.includes(p.id) ? 'selected' : ''}`}
                          onClick={() => {
                            setRiichiPlayerIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }}
                        >
                          {p.userName}
                          {riichiPlayerIds.includes(p.id) && ' ✓'}
                        </span>
                      ))}
                    </div>
                    {riichiPlayerIds.length > 0 && (
                      <span className="field-hint">
                        {riichiPlayerIds.length}人立直 → 各扣1000, 胜者收立直棒+{riichiPlayerIds.length * 1000}
                      </span>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleAddRound}
                  disabled={!canSubmit || submitting || !!validationHint}
                >
                  {submitting ? MSG.SUBMITTING : '添加'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h2>计分板</h2>
          <div className="scoreboard-meta">
            <span className="session-meta">
              {session.gameModeDisplayName} &middot;{' '}
              {new Date(session.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
              &nbsp;
              <span className={`badge ${session.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                {session.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
              </span>
            </span>
            <TableStrengthTag table={session.tableStrength} size="md" />
            {session.status === 'IN_PROGRESS' && (
              <button className="btn btn-danger btn-small" onClick={handleComplete} disabled={submitting}>
                结束游戏
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="fixed-table session-rounds-table">
            <thead>
              <tr>
                <th className="col-round" style={{ verticalAlign: 'top', width: `${ROUND_COL_PX}px` }}>
                  局
                </th>
                {session.players.map((p) => (
                  <th key={p.id} style={playerColStyle}>
                    <div className="player-header-cell">
                      <span className={`rank-tag rank-tag-${rankMap[p.id]?.rank}`}>
                        {seatRankMedal(rankMap[p.id]?.rank ?? 0) ?? `#${rankMap[p.id]?.rank ?? 0}`}
                      </span>
                      <RankBadge tier={p.tier} size="sm" userName={p.userName} />
                      <span className="player-name" style={{ fontSize: tableNameFontSize(p.userName, isMobile) }}>
                        {p.userName}
                      </span>
                    </div>
                  </th>
                ))}
                {session.status === 'IN_PROGRESS' && <th style={{ width: '32px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {session.rounds.map((round) => {
                const isChombo = round.winnerId && (round.scores[round.winnerId] || 0) < 0
                return (
                  <React.Fragment key={round.roundNumber}>
                    <tr>
                      <td className="col-round">
                        <div className="round-info-cell">
                          <div className="round-info-stack">
                            <span className="round-wind-tag">{getRoundLabel(round)}</span>
                            {isChombo && <span className="chombo-badge">诈胡</span>}
                          </div>
                        </div>
                      </td>
                      {session.players.map((p) => {
                        const val = round.scores[p.id] || 0
                        const isWinner = round.winnerId === p.id

                        let cellClass = 'score-cell'
                        if (val > 0) cellClass += ' score-positive'
                        else if (val < 0) cellClass += ' score-negative'

                        if (isWinner) {
                          if (isChombo) {
                            cellClass += ' score-chombo'
                          } else {
                            cellClass += ' score-winner'
                          }
                        }

                        return (
                          <td key={p.id} className={`${cellClass} text-center`}>
                            {val > 0 ? `+${val}` : val}
                          </td>
                        )
                      })}
                      {session.status === 'IN_PROGRESS' && (
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteRound(round.roundNumber)}
                            disabled={submitting}
                          >
                            &times;
                          </button>
                        </td>
                      )}
                    </tr>
                    {round.winHand && (
                      <tr className="hand-details-row">
                        <td
                          colSpan={session.players.length + (session.status === 'IN_PROGRESS' ? 2 : 1)}
                          className="hand-details-cell"
                        >
                          <MahjongHand hand={round.winHand} details={round.fanDetails} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              <tr className="total-row">
                <td className="col-round">
                  <strong>合计</strong>
                </td>
                {session.players.map((p) => {
                  const delta = session.totalScores[p.id] || 0
                  const total = session.startingPoints + delta
                  const displayVal = session.startingPoints ? total : delta
                  const rankDelta = ratingDelta(p.id)
                  return (
                    <td
                      key={p.id}
                      className={`score-cell text-center${
                        delta > 0 ? ' score-positive' : delta < 0 ? ' score-negative' : ''
                      }`}
                    >
                      <div className="total-score-box">
                        <div className="total-val">{displayVal}</div>
                        {rankDelta != null && <div className="rank-delta-val">{formatDelta(rankDelta)}</div>}
                      </div>
                    </td>
                  )
                })}
                {session.status === 'IN_PROGRESS' && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {session.rounds.length > 0 && (
        <div className="card">
          <h2>排名</h2>
          <div className="table-wrap">
            <table className="fixed-table">
              <thead>
                <tr>
                  <th className="col-rank">排名</th>
                  <th>玩家</th>
                  <th className="text-right" style={{ width: '72px' }}>
                    分数
                  </th>
                  <th className="text-right" style={{ width: '92px' }}>
                    段位分
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, i) => {
                  const val = session.totalScores[p.id] || 0
                  const rankDelta = ratingDelta(p.id)
                  const rank = rankMap[p.id]?.rank ?? i + 1
                  return (
                    <tr key={p.id}>
                      <td className="col-rank">
                        <span className={`rank-tag rank-tag-${rank}`}>{seatRankMedal(rank) ?? `#${rank}`}</span>
                      </td>
                      <td>
                        <span className="player-name" style={{ fontSize: tableNameFontSize(p.userName, isMobile) }}>
                          {p.userName}
                        </span>
                      </td>
                      <td className={`${scoreClass(val)} num-cell`}>{val > 0 ? `+${val}` : val}</td>
                      <td className={`num-cell-rank-delta${rankDelta != null ? ' ' + scoreClass(rankDelta) : ''}`}>
                        {rankDelta != null ? formatDelta(rankDelta) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {session && (
        <PhotoRecognitionModal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          onApplyHand={handleApplyRecognizedHand}
          onSample={handlePhotoSample}
          sessionId={session.id}
        />
      )}
    </>
  )
}
