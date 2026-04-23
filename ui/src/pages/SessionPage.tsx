import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchSessionDetail, addRound, deleteRound, completeSession } from '../api'
import { SessionDetail, FAN_OPTIONS, FU_OPTIONS } from '../types'
import { calculateRanks } from '../logic/ranking'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { nameFontSize } from '../utils/fontSize'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [winnerId, setWinnerId] = useState<string>('')
  const [score, setScore] = useState('')
  const [fan, setFan] = useState<string>('')
  const [fu, setFu] = useState<string>('')
  const [dealerId, setDealerId] = useState<string>('')
  const [honba, setHonba] = useState<string>('0')
  const [kyoutaku, setKyoutaku] = useState<string>('0')
  const [isSelfDraw, setIsSelfDraw] = useState(false)
  const [dealInPlayerId, setDealInPlayerId] = useState<string>('')
  const [bimenPlayerIds, setBimenPlayerIds] = useState<number[]>([])
  const [isRyuukyoku, setIsRyuukyoku] = useState(false)
  const [tenpaiPlayerIds, setTenpaiPlayerIds] = useState<number[]>([])
  const [isCalcOpen, setIsCalcOpen] = useState(false)
  const [calcResetCount, setCalcResetCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
 
  const handleCalcScoreSelect = useCallback((s: number | null) => {
    if (s !== null) {
      setScore(String(s));
    } else {
      setScore('');
    }
  }, []);

  const load = async () => {
    const detail = await fetchSessionDetail(Number(id))
    setSession(detail)
    setError('')
  }

  useEffect(() => { load().catch(e => setError(e.message)) }, [id])

  if (!session) return <div className="empty-state"><p>{error || '加载中...'}</p></div>

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
    setHonba('0')
    setKyoutaku('0')
    setCalcResetCount(prev => prev + 1)
  }

  const canSubmit = winnerId
    && (isRiichi ? (fan && fu && dealerId)
      : isDongbei ? (fan && dealerId)
      : (score && parseInt(score) >= (isGuobiao ? 8 : 1)))
    && (isSelfDraw || dealInPlayerId)

  const handleAddRound = async () => {
    setError('')
    setSubmitting(true)
    try {
      if (isRyuukyoku) {
        await addRound(session.id, {
          roundType: 'DRAWN_GAME',
          tenpaiPlayerIds,
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
          dealerId: Number(dealerId),
          honba: parseInt(honba) || 0,
          kyoutaku: parseInt(kyoutaku) || 0,
          dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
        })
    } else if (isDongbei) {
      await addRound(session.id, {
        winnerId: Number(winnerId),
        fan: parseInt(fan),
        dealerId: Number(dealerId),
        bimenPlayerIds,
        dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
      })
    } else {
      await addRound(session.id, {
        winnerId: Number(winnerId),
        score: parseInt(score),
        dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
      })
    }
    resetForm()
    await load()
    } catch (e: any) {
      setError(e.message || '操作失败')
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
      setError(e.message || '删除失败')
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
      setError(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const sortedPlayers = [...session.players].sort(
    (a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0)
  )

  const rankings = calculateRanks(
    session.players.map(p => ({ playerId: p.id, score: session.totalScores[p.id] || 0 })),
    { rpFactor: session.rpFactor, rpOrigin: session.rpOrigin, umaDist: session.umaDist }
  )
  const rankMap = Object.fromEntries(rankings.map(r => [r.playerId, r]))

  const playerColPct = `${Math.floor(90 / session.players.length)}%`
  const playerColStyle = { textAlign: 'center' as const, width: playerColPct, minWidth: 80 }

  const otherPlayers = session.players.filter(p => p.id !== Number(winnerId))
  const winnerIsDealer = winnerId && dealerId && winnerId === dealerId

  // Score preview
  const getScorePreview = (): string | null => {
    if (isRiichi) {
      if (!fan || !fu || !dealerId) return null
      const h = parseInt(fan), f = parseInt(fu)
      let basic: number
      if (h >= 13) basic = 8000
      else if (h >= 11) basic = 6000
      else if (h >= 8) basic = 4000
      else if (h >= 6) basic = 3000
      else if (h >= 5 || (h === 4 && f >= 30) || (h === 3 && f >= 60)) basic = 2000 // 切上満貫
      else basic = Math.min(f * Math.pow(2, 2 + h), 2000)

      const r100 = (v: number) => Math.ceil(v / 100) * 100
      const honbaNum = parseInt(honba) || 0
      const honbaBonus = 100 * honbaNum
      const kyoutakuNum = parseInt(kyoutaku) || 0

      if (isSelfDraw) {
        if (winnerIsDealer) {
          const each = r100(basic * 2) + honbaBonus
          const numOthers = session.playerCount - 1
          const winnerTotal = each * numOthers + kyoutakuNum
          return `自摸 (亲家): ${numOthers}人各付${each}${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${kyoutakuNum > 0 ? ` +供托${kyoutakuNum}` : ''} → 共+${winnerTotal}`
        } else {
          const dealerPays = r100(basic * 2) + honbaBonus
          const otherPays = r100(basic) + honbaBonus
          const numNonDealers = session.playerCount - 2
          const total = dealerPays + numNonDealers * otherPays + kyoutakuNum
          return `自摸: 亲家付${dealerPays}, ${numNonDealers > 0 ? `其他各付${otherPays}, ` : ''}${honbaNum > 0 ? `(含${honbaNum}本场) ` : ''}${kyoutakuNum > 0 ? `+供托${kyoutakuNum} ` : ''}共+${total}`
        }
      } else {
        const base = (winnerIsDealer ? r100(basic * 6) : r100(basic * 4)) + 300 * honbaNum
        const total = base + kyoutakuNum
        return `荣和${winnerIsDealer ? ' (亲家)' : ''}: ${base}点${honbaNum > 0 ? ` (含${honbaNum}本场)` : ''}${kyoutakuNum > 0 ? ` +供托${kyoutakuNum}` : ''} → 共+${total}`
      }
    }

    if (isDongbei) {
      if (!fan || !dealerId || !winnerId) return null
      const fanNum = parseInt(fan)
      const bimenSet = new Set(bimenPlayerIds)
      const opponents = session.players.filter(p => p.id !== Number(winnerId))
      const allBimen = opponents.length > 0 && opponents.every(p => bimenSet.has(p.id))

      const parts: string[] = []
      let total = 0
      for (const p of opponents) {
        const isDealIn = !isSelfDraw && String(p.id) === dealInPlayerId
        const isBimen = bimenSet.has(p.id)
        const isOpponentDealer = String(p.id) === dealerId
        const pays = isDealIn || isSelfDraw || isBimen
        if (!pays) continue

        const zhuangjiaFlag = (winnerIsDealer || isOpponentDealer) ? 1 : 0
        const dianpaoFlag = (isDealIn || isSelfDraw) ? 1 : 0
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
        const dealInName = session.players.find(p => p.id === Number(dealInPlayerId))?.userName
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
      <div className="card">
        <div className="flex-between">
          <div>
            <h2>{session.name || `Game #${session.id}`}</h2>
            <span className="session-meta">
              {session.gameModeDisplayName} &middot; {session.playerCount}玩家 &middot; {new Date(session.createdAt).toLocaleDateString()}
              &nbsp;
              <span className={`badge ${session.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                {session.status === 'IN_PROGRESS' ? '进行中' : '已结束'}
              </span>
            </span>
          </div>
          {session.status === 'IN_PROGRESS' && (
            <button className="btn btn-danger btn-small" onClick={handleComplete} disabled={submitting}>
              结束游戏
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>计分板</h2>
        <div className="score-table">
          <table>
            <thead>
              <tr>
                <th>局</th>
                {session.players.map(p => (
                  <th key={p.id} style={playerColStyle}>
                    <div className="player-header-cell">
                      <span className="player-rank">#{rankMap[p.id]?.rank}</span>
                      <span className="player-name" style={{ fontSize: nameFontSize(p.userName) }}>{p.userName}</span>
                    </div>
                  </th>
                ))}
                {session.status === 'IN_PROGRESS' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(round => (
                <tr key={round.roundNumber}>
                  <td>R{round.roundNumber}</td>
                  {session.players.map(p => {
                    const val = round.scores[p.id] ?? 0
                    return (
                      <td key={p.id} className={`score-cell${val > 0 ? ' score-positive' : val < 0 ? ' score-negative' : ''}`} style={{ textAlign: 'center' }}>
                        {val > 0 ? `+${val}` : val}
                      </td>
                    )
                  })}
                  {session.status === 'IN_PROGRESS' && (
                    <td>
                      <button className="delete-btn" onClick={() => handleDeleteRound(round.roundNumber)} disabled={submitting}>
                        &times;
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="total-row">
                <td style={{ whiteSpace: 'nowrap' }}><strong>合计</strong></td>
                {session.players.map(p => {
                  const delta = session.totalScores[p.id] || 0
                  const total = session.rpOrigin + delta
                  const displayVal = session.rpOrigin ? total : delta
                  return (
                    <td key={p.id} className={`score-cell${delta > 0 ? ' score-positive' : delta < 0 ? ' score-negative' : ''}`} style={{ textAlign: 'center' }}>
                      <div className="total-score-box">
                        <div className="total-val">{displayVal}</div>
                        {session.rounds.length > 0 && (() => {
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

        {session.status === 'IN_PROGRESS' && (
          <div className="round-form">
            <h3 className="round-form-title">添加</h3>

            {isRiichi && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="zimo-toggle">
                  <input
                    type="checkbox"
                    checked={isRyuukyoku}
                    onChange={e => { resetForm(); setIsRyuukyoku(e.target.checked) }}
                  />
                  <span>流局</span>
                </label>
              </div>
            )}

            {isRyuukyoku ? (
              <>
                <div className="form-group">
                  <label>选择听牌玩家</label>
                  <div className="player-chips">
                    {session.players.map(p => (
                      <span
                        key={p.id}
                        className={`chip ${tenpaiPlayerIds.includes(p.id) ? 'selected' : ''}`}
                        onClick={() => setTenpaiPlayerIds(prev =>
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        )}
                        style={{ cursor: 'pointer' }}
                      >
                        {p.userName}
                        {tenpaiPlayerIds.includes(p.id) && ' ✓'}
                      </span>
                    ))}
                  </div>
                  <span className="field-hint">
                    {tenpaiPlayerIds.length === 0 || tenpaiPlayerIds.length === session.players.length
                      ? '全员听牌或全员未听 → 无点数变动'
                      : `${tenpaiPlayerIds.length}人听牌, ${session.players.length - tenpaiPlayerIds.length}人未听 → 未听各付${3000 / (session.players.length - tenpaiPlayerIds.length)}, 听牌各得${3000 / tenpaiPlayerIds.length}`}
                  </span>
                </div>
                <button className="btn btn-primary" onClick={handleAddRound} disabled={submitting}>
                  {submitting ? '提交中...' : '添加流局'}
                </button>
              </>
            ) : (
            <>

            {isRiichi ? (
              <div className="round-form-grid">
                <div className="form-group">
                  <label>亲家</label>
                  <select value={dealerId} onChange={e => setDealerId(e.target.value)}>
                    <option value=""></option>
                    {session.players.map(p => (
                      <option key={p.id} value={p.id}>{p.userName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>本场</label>
                  <input
                    type="number"
                    value={honba}
                    onChange={e => setHonba(e.target.value)}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>
                    番
                    <a href="https://linlexiao.com/maj/#/calculator" target="_blank" rel="noopener noreferrer" className="score-calc-link">计算器</a>
                  </label>
                  <select value={fan} onChange={e => setFan(e.target.value)}>
                    <option value=""></option>
                    {FAN_OPTIONS.map(f => (
                      <option key={f} value={f}>{f}{f >= 5 ? (f >= 13 ? ' (役満)' : f >= 11 ? ' (三倍満)' : f >= 8 ? ' (倍満)' : f >= 6 ? ' (跳満)' : ' (満貫)') : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>符数</label>
                  <select value={fu} onChange={e => setFu(e.target.value)}>
                    <option value=""></option>
                    {FU_OPTIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>供托</label>
                  <input
                    type="number"
                    value={kyoutaku}
                    onChange={e => setKyoutaku(e.target.value)}
                    min="0"
                    step="1000"
                    placeholder="0"
                  />
                </div>
                <div className="form-group full-width">
                  <label>赢家</label>
                  <div className="player-chip-grid">
                    {session.players.map(p => (
                      <button
                        key={p.id}
                        className={`player-chip-btn ${winnerId === String(p.id) ? 'active' : ''}`}
                        onClick={() => { setWinnerId(String(p.id)); setDealInPlayerId('') }}
                      >
                        {p.userName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
              {isDongbei && (
                <div className="round-form-grid">
                  <div className="form-group">
                    <label>庄家</label>
                    <select value={dealerId} onChange={e => setDealerId(e.target.value)}>
                      <option value=""></option>
                      {session.players.map(p => (
                        <option key={p.id} value={p.id}>{p.userName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>番</label>
                    <input
                      type="number"
                      value={fan}
                      onChange={e => setFan(e.target.value)}
                      placeholder="输入番"
                      min="0"
                    />
                  </div>
                </div>
              )}
              <div className="round-form-grid">
                {!isDongbei && (isGuobiao ? (
                  <div className="form-group">
                    <label>
                      分数
                    </label>
                    <div className="score-input-row">
                      <input
                        type="number"
                        value={score}
                        onChange={e => setScore(e.target.value)}
                        placeholder="输入分数"
                        min={isGuobiao ? "8" : "1"}
                      />
                      {isGuobiao && (
                        <button className={`btn btn-small calc-trigger-btn ${isCalcOpen ? 'btn-primary' : 'btn-accent'}`} onClick={() => setIsCalcOpen(prev => !prev)}>
                          🀄 {isCalcOpen ? '收起算番' : '算番器'}
                        </button>
                      )}
                    </div>
                      {isGuobiao && isCalcOpen && (
                        <div className="inline-calc-wrapper">
                          <GuobiaoCalculator 
                            onSelectScore={handleCalcScoreSelect}
                            initialOptions={{
                              quanfeng: 1,
                              menfeng: 1
                            }}
                            resetTrigger={calcResetCount}
                            isSelfDraw={isSelfDraw}
                            onIsSelfDrawChange={setIsSelfDraw}
                            onClose={() => setIsCalcOpen(false)}
                          />
                        </div>
                      )}
                  </div>
                ) : null)}
                <div className="form-group full-width">
                  <label>赢家</label>
                  <div className="player-chip-grid">
                    {session.players.map(p => (
                      <button
                        key={p.id}
                        className={`player-chip-btn ${winnerId === String(p.id) ? 'active' : ''}`}
                        onClick={() => { setWinnerId(String(p.id)); setDealInPlayerId('') }}
                      >
                        {p.userName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              </>
            )}

            <div className="form-group">
              <label>和牌方式</label>
              <div className="win-type-selector">
                <button 
                  className={`type-btn ${isSelfDraw ? 'active' : ''}`}
                  onClick={() => { setIsSelfDraw(true); setDealInPlayerId('') }}
                >
                  自摸
                </button>
                <button 
                  className={`type-btn ${!isSelfDraw ? 'active' : ''}`}
                  onClick={() => setIsSelfDraw(false)}
                >
                  点炮
                </button>
              </div>
            </div>

            {!isSelfDraw && (
              <div className="form-group full-width">
                <label>点炮家</label>
                <div className="player-chip-grid">
                  {otherPlayers.map(p => (
                    <button
                      key={p.id}
                      className={`player-chip-btn ${dealInPlayerId === String(p.id) ? 'active' : ''}`}
                      onClick={() => setDealInPlayerId(String(p.id))}
                    >
                      {p.userName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isDongbei && winnerId && (
              <div className="form-group">
                <label>闭门</label>
                <div className="player-chips">
                  {otherPlayers.map(p => (
                    <span
                      key={p.id}
                      className={`chip ${bimenPlayerIds.includes(p.id) ? 'selected' : ''}`}
                      onClick={() => setBimenPlayerIds(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )}
                      style={{ cursor: 'pointer' }}
                    >
                      {p.userName}
                      {bimenPlayerIds.includes(p.id) && ' ✓'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preview && (
              <div className="score-preview">{preview}</div>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '8px 0' }}>{error}</p>}

            <button className="btn btn-primary" onClick={handleAddRound} disabled={!canSubmit || submitting}>
              {submitting ? '提交中...' : '添加'}
            </button>
            </>
            )}
          </div>
        )}
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
                const rp = rankMap[p.id]?.rp ?? 0
                return (
                  <tr key={p.id}>
                    <td className={i < 3 ? `rank-${i + 1}` : ''}>
                      #{i + 1}
                    </td>
                    <td>{p.userName}</td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : undefined
                    }}>
                      {val > 0 ? `+${val}` : val}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 'bold',
                      color: 'var(--primary)'
                    }}>
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
    </>
  )
}
