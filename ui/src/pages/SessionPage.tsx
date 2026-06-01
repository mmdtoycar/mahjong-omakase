import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchSessionDetail, addRound, deleteRound, completeSession } from '../api'
import { SessionDetail, PlayerInfo, RoundInfo } from '../types'
import { calculateRanks } from '../logic/ranking'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'
import { MahjongHand } from '../components/MahjongHand'
import { nameFontSize } from '../utils/fontSize'
import { deriveGameState, deriveRoundState, getWindName } from '../utils/gameState'
import { scoreClass } from '../utils/format'
import { MSG } from '../constants'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
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
  const [isBackfill, setIsBackfill] = useState(false)
  const [isChomboManual, setIsChomboManual] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [error, setError] = useState('')

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
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : MSG.ERROR))
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
    setIsBackfill(false)
    setIsChomboManual(false)
    setCalcError('')
    setCalcResetCount((prev) => prev + 1)
  }

  const handlePlayerClick = (pid: string) => {
    if (winnerId === pid) {
      setWinnerId('')
      setDealInPlayerId('')
      setIsSelfDraw(false)
    } else if (dealInPlayerId === pid) {
      setDealInPlayerId('')
      setIsSelfDraw(false)
    } else if (!winnerId) {
      setWinnerId(pid)
      setIsSelfDraw(false)
    } else {
      setDealInPlayerId(pid)
      setIsSelfDraw(false)
    }
  }

  const handleWinTypeToggle = () => {
    if (isSelfDraw) {
      setIsSelfDraw(false)
    } else {
      setIsSelfDraw(true)
      setDealInPlayerId('')
    }
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
          backfill: isBackfill || undefined,
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
        })
      }

      resetForm()
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : MSG.ERROR)
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
      setError(e instanceof Error ? e.message : MSG.ERROR)
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
      setError(e instanceof Error ? e.message : MSG.ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  const sortedPlayers = [...session.players].sort(
    (a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0)
  )

  // Find max fan hand(s)
  const parseFanCount = (r: RoundInfo) => {
    if (r.fanCount) return r.fanCount
    if (!r.fanDetails) return 0
    // Fallback: parse from "Name(Score)" or "Name(ScorexCount)"
    const matches = r.fanDetails.match(/\((\d+)(x\d+)?\)/g)
    if (!matches) return 0
    return matches.reduce((sum: number, m: string) => {
      const score = parseInt(m.match(/\d+/)?.[0] || '0')
      const multMatch = m.match(/x(\d+)/)
      const mult = multMatch ? parseInt(multMatch[1]) : 1
      return sum + score * mult
    }, 0)
  }

  const roundsWithFan = session.rounds.map((r) => ({ ...r, effectiveFan: parseFanCount(r) }))
  const maxFan = roundsWithFan.reduce((max, r) => Math.max(max, r.effectiveFan), 0)
  const bestRounds = maxFan > 0 ? roundsWithFan.filter((r) => r.effectiveFan === maxFan) : []

  const rankings = calculateRanks(
    session.players.map((p) => ({ playerId: p.id, score: session.totalScores[p.id] || 0 })),
    { rpFactor: session.rpFactor, rpOrigin: session.rpOrigin, umaDist: session.umaDist }
  )
  const rankMap = Object.fromEntries(rankings.map((r) => [r.playerId, r]))

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

  const playerColPct = `${Math.floor(90 / session.players.length)}%`
  const playerColStyle = { textAlign: 'center' as const, width: playerColPct, minWidth: 56 }

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

  return (
    <>
      {session.status === 'IN_PROGRESS' && (
        <div className="card round-form-card">
          <div className="round-form">
            <h3 className="round-form-title">添加 — {gameState.displayName}</h3>
            {isRiichi && (
              <div className="form-group" style={{ marginBottom: 16 }}>
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
                            {getWindName(getPlayerMenfeng(getPlayerSeat(p, idx)))}
                            {p.id === gameState.dealerPlayerId ? ' 庄' : ''}
                          </div>
                        </button>
                      )
                    })}
                    <div
                      className="win-action-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isGuobiao ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                        gap: '8px',
                        width: '100%',
                      }}
                    >
                      <button
                        type="button"
                        className={`quick-player-btn win-type-btn dianpao ${
                          !isSelfDraw && !isChomboManual ? 'active' : ''
                        }`}
                        onClick={() => {
                          setIsSelfDraw(false)
                          setIsChomboManual(false)
                        }}
                      >
                        点炮
                      </button>
                      <button
                        type="button"
                        className={`quick-player-btn win-type-btn zimo ${
                          isSelfDraw && !isChomboManual ? 'active' : ''
                        }`}
                        onClick={() => {
                          setIsSelfDraw(true)
                          setIsChomboManual(false)
                        }}
                      >
                        自摸
                      </button>
                      {isGuobiao && (
                        <button
                          type="button"
                          className={`quick-player-btn win-type-btn chombo ${isChomboManual ? 'active' : ''}`}
                          onClick={() => {
                            setIsSelfDraw(false)
                            setIsChomboManual(true)
                          }}
                        >
                          诈胡
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isRiichi && (
                  <div className="form-group score-inline-group-container">
                    <div className="score-inline-group">
                      <label>分数</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={score}
                        onChange={(e) => {
                          setScore(e.target.value)
                          setTsumoDetail(null)
                          setWinHand('')
                          setFanDetails('')
                          setFanCount(0)
                        }}
                        placeholder="输入分数"
                        className="score-input-compact"
                      />
                      <button type="button" className="reset-btn-score-compact" onClick={resetForm}>
                        重置
                      </button>
                      <label className="checkbox-toggle">
                        <input type="checkbox" checked={isBackfill} onChange={(e) => setIsBackfill(e.target.checked)} />
                        <span>补录 (不计入局数)</span>
                      </label>
                    </div>
                    <div className="inline-calc-wrapper">
                      <RiichiCalculator
                        key="riichi-calc"
                        onSelectScore={handleRiichiCalcSelect}
                        onError={(msg) => setCalcError(msg || '')}
                        initialOptions={{
                          changfeng: gameState.prevalentWind,
                          zifeng: winnerMenfeng,
                        }}
                        resetTrigger={calcResetCount}
                        isSelfDraw={isSelfDraw}
                        onIsSelfDrawChange={setIsSelfDraw}
                        playerCount={session.playerCount}
                      />
                    </div>
                  </div>
                )}

                {isDongbei && (
                  <div className="round-form-grid">
                    <div className="form-group">
                      <label>番</label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={fan}
                          onChange={(e) => setFan(e.target.value)}
                          placeholder="输入番"
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="reset-btn-score-compact" onClick={resetForm}>
                          重置
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isRiichi && isGuobiao && (
                  <div className="form-group score-inline-group-container">
                    <div className="score-inline-group">
                      <label>分数</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={score}
                        onChange={(e) => {
                          setScore(e.target.value)
                          setWinHand('')
                          setFanDetails('')
                          setFanCount(0)
                        }}
                        placeholder={isChomboManual ? '诈胡免输分数' : '输入分数'}
                        className="score-input-compact"
                        disabled={isChomboManual}
                      />
                      <button type="button" className="reset-btn-score-compact" onClick={resetForm}>
                        重置
                      </button>
                    </div>
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
                          style={{ cursor: 'pointer' }}
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
                          style={{ cursor: 'pointer' }}
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
          <h2 style={{ marginBottom: 0 }}>计分板</h2>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="session-meta" style={{ margin: 0, fontSize: '0.85rem' }}>
              {session.gameModeDisplayName} &middot;{' '}
              {new Date(session.createdAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}
              &nbsp;
              <span className={`badge ${session.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                {session.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
              </span>
            </span>
            {session.status === 'IN_PROGRESS' && (
              <button className="btn btn-danger btn-small" onClick={handleComplete} disabled={submitting}>
                结束游戏
              </button>
            )}
          </div>
        </div>
        <div className="score-table">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '60px' }}>局</th>
                {session.players.map((p) => (
                  <th key={p.id} style={playerColStyle}>
                    <div className="player-header-cell">
                      <span className={`rank-tag rank-tag-${rankMap[p.id]?.rank}`}>#{rankMap[p.id]?.rank}</span>
                      <span className="player-name" style={{ fontSize: nameFontSize(p.userName) }}>
                        {p.userName}
                      </span>
                    </div>
                  </th>
                ))}
                {session.status === 'IN_PROGRESS' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {session.rounds.map((round) => {
                const isChombo = round.winnerId && (round.scores[round.winnerId] || 0) < 0
                return (
                  <React.Fragment key={round.roundNumber}>
                    <tr>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div className="round-info-cell">
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px',
                              width: '100%',
                            }}
                          >
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
                          <td key={p.id} className={cellClass} style={{ textAlign: 'center' }}>
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
                <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                  <strong>合计</strong>
                </td>
                {session.players.map((p) => {
                  const delta = session.totalScores[p.id] || 0
                  const total = session.rpOrigin + delta
                  const displayVal = session.rpOrigin ? total : delta
                  return (
                    <td
                      key={p.id}
                      className={`score-cell${delta > 0 ? ' score-positive' : delta < 0 ? ' score-negative' : ''}`}
                      style={{ textAlign: 'center' }}
                    >
                      <div className="total-score-box">
                        <div className="total-val">{displayVal}</div>
                        {session.rounds.length > 0 &&
                          (() => {
                            const baseRp = rankMap[p.id]?.rp ?? 0
                            const bonus = session.playerBonuses?.[p.id] ?? 0
                            return (
                              <div className="rp-val">
                                {baseRp > 0 ? `+${baseRp.toFixed(1)}` : baseRp.toFixed(1)} RP
                                {bonus > 0 && (
                                  <span className="rp-bonus">(+{bonus.toFixed(bonus % 1 === 0 ? 0 : 1)})</span>
                                )}
                              </div>
                            )
                          })()}
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
          <div className="score-table">
            <table>
              <thead>
                <tr>
                  <th>名次</th>
                  <th>玩家</th>
                  <th style={{ textAlign: 'right' }}>分数</th>
                  <th style={{ textAlign: 'right' }}>积分(RP)</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, i) => {
                  const val = session.totalScores[p.id] || 0
                  const baseRp = rankMap[p.id]?.rp ?? 0
                  const bonus = session.playerBonuses?.[p.id] ?? 0
                  const rank = rankMap[p.id]?.rank ?? i + 1
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className={`rank-tag rank-tag-${rank}`}>#{rank}</span>
                      </td>
                      <td>{p.userName}</td>
                      <td
                        className={scoreClass(val)}
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {val > 0 ? `+${val}` : val}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 'bold',
                          color: 'var(--primary)',
                        }}
                      >
                        {baseRp > 0 ? `+${baseRp.toFixed(1)}` : baseRp.toFixed(1)}
                        {bonus > 0 && <span className="rp-bonus">(+{bonus.toFixed(bonus % 1 === 0 ? 0 : 1)})</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bestRounds.length > 0 && (
        <div className="card best-hand-card">
          <div className="best-hand-header">
            <span className="best-hand-crown">👑</span>
            <h2>最高番和牌</h2>
          </div>
          <div className="best-hand-list">
            {bestRounds.map((round, idx) => {
              const winner = session.players.find((p) => p.id === round.winnerId)
              const loser =
                round.dealInPlayerId != null ? session.players.find((p) => p.id === round.dealInPlayerId) : null

              return (
                <div key={round.roundNumber} className="best-hand-item">
                  <div className="best-hand-meta">
                    <span className="best-hand-fan-count">{round.effectiveFan} 番</span>
                    <span className="best-hand-players">
                      <span className="winner-label">赢家:</span> {winner?.userName}
                      {round.dealInPlayerId != null ? (
                        <>
                          <span className="loser-label ml-2">输家:</span> {loser?.userName || '?'}
                        </>
                      ) : (
                        <span className="zimo-label ml-2">(自摸)</span>
                      )}
                    </span>
                  </div>
                  <div className="best-hand-display">
                    <MahjongHand hand={round.winHand} details={round.fanDetails} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
