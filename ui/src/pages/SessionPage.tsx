import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchSessionDetail, addRound, deleteRound, completeSession } from '../api'
import { SessionDetail, PlayerInfo, RoundInfo, FAN_OPTIONS, FU_OPTIONS } from '../types'
import { calculateRanks } from '../logic/ranking'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
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
  const [fu, setFu] = useState<string>('')
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

  const load = async () => {
    const detail = await fetchSessionDetail(Number(id))
    setSession(detail)
    setError('')
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
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
    setFu('')
    setBimenPlayerIds([])
    setIsSelfDraw(false)
    setDealInPlayerId('')
    setIsRyuukyoku(false)
    setTenpaiPlayerIds([])
    setRiichiPlayerIds([])
    setWinHand('')
    setFanDetails('')
    setFanCount(0)
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
    (isRiichi ? fan && fu : isDongbei ? fan : score && parseInt(score) >= (isGuobiao ? 8 : 1)) &&
    (isSelfDraw || dealInPlayerId)

  const handleAddRound = async () => {
    setError('')
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
        await addRound(session.id, {
          winnerId: Number(winnerId),
          fan: parseInt(fan),
          fu: parseInt(fu),
          dealerId: gameState.dealerPlayerId,
          honba: gameState.honba,
          kyoutaku: gameState.kyoutaku,
          dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
          fanCount: parseInt(fan),
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
          score: parseInt(score),
          dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
          winHand,
          fanDetails,
          fanCount: fanCount || parseInt(score),
          prevalentWind: gameState.prevalentWind,
        })
      }

      resetForm()
      await load()
    } catch (e: any) {
      setError(e.message || MSG.ACTION_FAILED)
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
    } catch (e: any) {
      setError(e.message || MSG.DELETE_FAILED)
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
    } catch (e: any) {
      setError(e.message || MSG.ACTION_FAILED)
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
      if (!fan || !fu) return null
      const h = parseInt(fan),
        f = parseInt(fu)
      let basic: number
      if (h >= 13) basic = 8000
      else if (h >= 11) basic = 6000
      else if (h >= 8) basic = 4000
      else if (h >= 6) basic = 3000
      else if (h >= 5 || (h === 4 && f >= 30) || (h === 3 && f >= 60)) basic = 2000
      else basic = Math.min(f * Math.pow(2, 2 + h), 2000)

      const r100 = (v: number) => Math.ceil(v / 100) * 100
      const honbaNum = gameState.honba
      const honbaBonus = 100 * honbaNum
      const kyoutakuNum = gameState.kyoutaku

      if (isSelfDraw) {
        if (winnerIsDealer) {
          const each = r100(basic * 2) + honbaBonus
          const numOthers = session.playerCount - 1
          const winnerTotal = each * numOthers + kyoutakuNum
          return `自摸 (亲家): ${numOthers}人各付${each}${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${
            kyoutakuNum > 0 ? ` +供托${kyoutakuNum}` : ''
          } → 共+${winnerTotal}`
        } else {
          const dealerPays = r100(basic * 2) + honbaBonus
          const otherPays = r100(basic) + honbaBonus
          const numNonDealers = session.playerCount - 2
          const total = dealerPays + numNonDealers * otherPays + kyoutakuNum
          return `自摸: 亲家付${dealerPays}, ${numNonDealers > 0 ? `其他各付${otherPays}, ` : ''}${
            honbaNum > 0 ? `(含${honbaNum}本场) ` : ''
          }${kyoutakuNum > 0 ? `+供托${kyoutakuNum} ` : ''}共+${total}`
        }
      } else {
        const base = (winnerIsDealer ? r100(basic * 6) : r100(basic * 4)) + 300 * honbaNum
        const total = base + kyoutakuNum
        return `荣和${winnerIsDealer ? ' (亲家)' : ''}: ${base}点${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${
          kyoutakuNum > 0 ? ` +供托${kyoutakuNum}` : ''
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

  return (
    <>
      {session.status === 'IN_PROGRESS' && (
        <div className="card round-form-card">
          <div className="round-form">
            <h3 className="round-form-title">添加 — {gameState.displayName}</h3>
            {isRiichi && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="zimo-toggle">
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
                {isRiichi ? (
                  <div className="round-form-grid">
                    <div className="form-group">
                      <label>
                        番
                        <a
                          href="https://linlexiao.com/maj/#/calculator"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="score-calc-link"
                        >
                          计算器
                        </a>
                      </label>
                      <select value={fan} onChange={(e) => setFan(e.target.value)}>
                        <option value=""></option>
                        {FAN_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                            {f >= 5
                              ? f >= 13
                                ? ' (役満)'
                                : f >= 11
                                ? ' (三倍満)'
                                : f >= 8
                                ? ' (倍満)'
                                : f >= 6
                                ? ' (跳満)'
                                : ' (満貫)'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>符数</label>
                      <select value={fu} onChange={(e) => setFu(e.target.value)}>
                        <option value=""></option>
                        {FU_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {isDongbei && (
                  <div className="round-form-grid">
                    <div className="form-group">
                      <label>番</label>
                      <input
                        type="number"
                        value={fan}
                        onChange={(e) => setFan(e.target.value)}
                        placeholder="输入番"
                        min="0"
                      />
                    </div>
                  </div>
                )}

                <div className="quick-win-container">
                  <h2>算番器</h2>
                  <div className="quick-win-row">
                    {session.players.map((p, idx) => {
                      const isWinner = winnerId === String(p.id)
                      const isLoser = dealInPlayerId === String(p.id)
                      let btnClass = 'quick-player-btn'
                      if (isWinner) btnClass += ' winner'
                      if (isLoser) btnClass += ' loser'

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
                    <div className="win-action-row">
                      <button
                        className={`quick-player-btn win-type-btn ${isSelfDraw ? 'zimo' : 'dianpao'}`}
                        onClick={handleWinTypeToggle}
                        disabled={!winnerId}
                      >
                        {isSelfDraw ? '自摸' : '点炮'}
                      </button>
                      <button className="quick-player-btn win-type-btn reset-btn" onClick={resetForm}>
                        重置
                      </button>
                    </div>
                  </div>
                </div>

                {!isRiichi && isGuobiao && (
                  <div className="form-group score-inline-group-container">
                    <div className="score-inline-group">
                      <label>分数</label>
                      <input
                        type="number"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        placeholder="输入分数"
                        min="8"
                        className="score-input-compact"
                      />
                    </div>
                    <div className="inline-calc-wrapper">
                      <GuobiaoCalculator
                        key={`${gameState.prevalentWind}-${winnerMenfeng}`}
                        onSelectScore={handleCalcScoreSelect}
                        initialOptions={{
                          quanfeng: gameState.prevalentWind,
                          menfeng: winnerMenfeng,
                        }}
                        resetTrigger={calcResetCount}
                        isSelfDraw={isSelfDraw}
                        onIsSelfDrawChange={setIsSelfDraw}
                        onClose={() => {}}
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

                {preview && <div className="score-preview">{preview}</div>}

                {error && <p className="error-text">{error}</p>}

                <button className="btn btn-primary" onClick={handleAddRound} disabled={!canSubmit || submitting}>
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
              {session.gameModeDisplayName} &middot; {new Date(session.createdAt).toLocaleDateString()}
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
                          </div>
                        </div>
                      </td>
                      {session.players.map((p) => {
                        const val = round.scores[p.id] || 0
                        const isWinner = round.winnerId === p.id
                        return (
                          <td
                            key={p.id}
                            className={`score-cell${val > 0 ? ' score-positive' : val < 0 ? ' score-negative' : ''}${
                              isWinner ? ' score-winner' : ''
                            }`}
                            style={{ textAlign: 'center' }}
                          >
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
                            const rp = rankMap[p.id]?.rp ?? 0
                            return <div className="rp-val">{rp > 0 ? `+${rp.toFixed(1)}` : rp.toFixed(1)} RP</div>
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
                  <th style={{ textAlign: 'right' }}>
                    积分(RP)
                    <div className="th-subtitle">含局数奖励</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, i) => {
                  const val = session.totalScores[p.id] || 0
                  const rp = rankMap[p.id]?.rp ?? 0
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
                        {rp > 0 ? `+${rp.toFixed(1)}` : rp.toFixed(1)}
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
