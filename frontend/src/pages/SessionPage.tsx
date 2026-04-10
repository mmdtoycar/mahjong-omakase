import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchSessionDetail, addRound, deleteRound, completeSession } from '../api'
import { SessionDetail, HAN_OPTIONS, FU_OPTIONS } from '../types'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [winnerId, setWinnerId] = useState<string>('')
  const [score, setScore] = useState('')
  const [han, setHan] = useState<string>('')
  const [fu, setFu] = useState<string>('')
  const [dealerId, setDealerId] = useState<string>('')
  const [honba, setHonba] = useState<string>('0')
  const [isSelfDraw, setIsSelfDraw] = useState(false)
  const [dealInPlayerId, setDealInPlayerId] = useState<string>('')
  const [bimenPlayerIds, setBimenPlayerIds] = useState<number[]>([])

  const load = () => {
    fetchSessionDetail(Number(id)).then(setSession)
  }

  useEffect(load, [id])

  if (!session) return <div className="empty-state"><p>Loading...</p></div>

  const isRiichi = session.gameMode === 'RIICHI'
  const isDongbei = session.gameMode === 'DONGBEI'
  const isGuobiao = session.gameMode === 'GUOBIAO'
  const needsDealer = isRiichi || isDongbei

  const resetForm = () => {
    setWinnerId('')
    setScore('')
    setHan('')
    setFu('')
    // Keep dealerId and bimenPlayerIds between rounds
    setIsSelfDraw(false)
    setDealInPlayerId('')
  }

  const canSubmit = winnerId
    && (isRiichi ? (han && fu && dealerId)
      : isDongbei ? (han && dealerId)
      : (score && parseInt(score) > 0))
    && (isSelfDraw || dealInPlayerId)

  const handleAddRound = async () => {
    if (!canSubmit) return
    if (isRiichi) {
      await addRound(session.id, {
        winnerId: Number(winnerId),
        han: parseInt(han),
        fu: parseInt(fu),
        dealerId: Number(dealerId),
        honba: parseInt(honba) || 0,
        dealInPlayerId: isSelfDraw ? null : Number(dealInPlayerId),
      })
    } else if (isDongbei) {
      await addRound(session.id, {
        winnerId: Number(winnerId),
        han: parseInt(han),
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
    load()
  }

  const handleDeleteRound = async (roundNumber: number) => {
    await deleteRound(session.id, roundNumber)
    load()
  }

  const handleComplete = async () => {
    await completeSession(session.id)
    load()
  }

  const sortedPlayers = [...session.players].sort(
    (a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0)
  )

  const otherPlayers = session.players.filter(p => p.id !== Number(winnerId))
  const winnerIsDealer = winnerId && dealerId && winnerId === dealerId

  // Score preview
  const getScorePreview = (): string | null => {
    if (isRiichi) {
      if (!han || !fu || !dealerId) return null
      const h = parseInt(han), f = parseInt(fu)
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

      if (isSelfDraw) {
        if (winnerIsDealer) {
          const each = r100(basic * 2) + honbaBonus
          const numOthers = session.playerCount - 1
          return `Tsumo (親): ${numOthers} players each pay ${each}${honbaNum > 0 ? ` (incl. ${honbaNum}本場)` : ''} → total +${each * numOthers}`
        } else {
          const dealerPays = r100(basic * 2) + honbaBonus
          const otherPays = r100(basic) + honbaBonus
          const numNonDealers = session.playerCount - 2
          const total = dealerPays + numNonDealers * otherPays
          return `Tsumo: dealer pays ${dealerPays}, ${numNonDealers > 0 ? `others pay ${otherPays} each, ` : ''}${honbaNum > 0 ? `(incl. ${honbaNum}本場) ` : ''}total +${total}`
        }
      } else {
        const total = (winnerIsDealer ? r100(basic * 6) : r100(basic * 4)) + 300 * honbaNum
        return `Ron${winnerIsDealer ? ' (親)' : ''}: ${total} pts${honbaNum > 0 ? ` (incl. ${honbaNum}本場)` : ''}`
      }
    }

    if (isDongbei) {
      if (!han || !dealerId || !winnerId) return null
      const fan = parseInt(han)
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
        const exponent = Math.min(fan + zhuangjiaFlag + dianpaoFlag + bimenFlag + sanjiaBimenFlag, 6)
        const payment = Math.pow(2, exponent)

        const flags: string[] = []
        if (zhuangjiaFlag) flags.push('庄')
        if (dianpaoFlag) flags.push(isSelfDraw ? '摸' : '炮')
        if (bimenFlag) flags.push('闭')
        if (sanjiaBimenFlag) flags.push('三闭')
        parts.push(`${p.userName}:${payment}${flags.length ? '(' + flags.join('+') + ')' : ''}`)
        total += payment
      }
      if (parts.length === 0) return 'No one pays'
      return `${parts.join(', ')} → total +${total}`
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
              {session.gameModeDisplayName} &middot; {session.playerCount} players &middot; {new Date(session.createdAt).toLocaleDateString()}
              &nbsp;
              <span className={`badge ${session.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-completed'}`}>
                {session.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
              </span>
            </span>
          </div>
          {session.status === 'IN_PROGRESS' && (
            <button className="btn btn-danger btn-small" onClick={handleComplete}>
              End Game
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Score Board</h2>
        <div className="score-table">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                {session.players.map(p => (
                  <th key={p.id} style={{ textAlign: 'center' }}>{p.displayName}</th>
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
                      <td key={p.id} className="score-cell" style={{
                        textAlign: 'center',
                        color: val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : undefined
                      }}>
                        {val > 0 ? `+${val}` : val}
                      </td>
                    )
                  })}
                  {session.status === 'IN_PROGRESS' && (
                    <td>
                      <button className="delete-btn" onClick={() => handleDeleteRound(round.roundNumber)}>
                        &times;
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                {session.players.map(p => {
                  const val = session.totalScores[p.id] || 0
                  return (
                    <td key={p.id} className="score-cell" style={{
                      textAlign: 'center',
                      color: val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : undefined
                    }}>
                      {val > 0 ? `+${val}` : val}
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
            <h3 className="round-form-title">Add Round</h3>

            {needsDealer && (
              <>
              <div className="round-form-grid">
                <div className="form-group">
                  <label>Dealer ({isDongbei ? '庄家' : '親'})</label>
                  <select value={dealerId} onChange={e => setDealerId(e.target.value)}>
                    <option value="">-- Who is dealer? --</option>
                    {session.players.map(p => (
                      <option key={p.id} value={p.id}>{p.userName}</option>
                    ))}
                  </select>
                </div>

                {isRiichi && (
                  <div className="form-group">
                    <label>本場 (Honba)</label>
                    <input
                      type="number"
                      value={honba}
                      onChange={e => setHonba(e.target.value)}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              </>
            )}

            <div className="round-form-grid">
              <div className="form-group">
                <label>Winner</label>
                <select value={winnerId} onChange={e => { setWinnerId(e.target.value); setDealInPlayerId('') }}>
                  <option value="">-- Select Winner --</option>
                  {session.players.map(p => (
                    <option key={p.id} value={p.id}>{p.userName}</option>
                  ))}
                </select>
              </div>

              {isRiichi ? (
                <>
                  <div className="form-group">
                    <label>番 (Han)</label>
                    <select value={han} onChange={e => setHan(e.target.value)}>
                      <option value="">-- Han --</option>
                      {HAN_OPTIONS.map(h => (
                        <option key={h} value={h}>{h}{h >= 5 ? (h >= 13 ? ' (役満)' : h >= 11 ? ' (三倍満)' : h >= 8 ? ' (倍満)' : h >= 6 ? ' (跳満)' : ' (満貫)') : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>符 (Fu)</label>
                    <select value={fu} onChange={e => setFu(e.target.value)}>
                      <option value="">-- Fu --</option>
                      {FU_OPTIONS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : isDongbei ? (
                <div className="form-group">
                  <label>番 (Fan)</label>
                  <input
                    type="number"
                    value={han}
                    onChange={e => setHan(e.target.value)}
                    placeholder="Enter fan"
                    min="1"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>
                    Score
                    {isGuobiao && (
                      <a href="https://tool.xdean.cn/tool/guobiao" target="_blank" rel="noopener noreferrer" className="score-calc-link">Score Calculator</a>
                    )}
                  </label>
                  <input
                    type="number"
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder="Enter score"
                    min="1"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="zimo-toggle">
                <input
                  type="checkbox"
                  checked={isSelfDraw}
                  onChange={e => { setIsSelfDraw(e.target.checked); setDealInPlayerId('') }}
                />
                <span>自摸 (Self-draw — all others pay)</span>
              </label>
            </div>

            {!isSelfDraw && winnerId && (
              <div className="form-group">
                <label>Deal-in Player (点炮)</label>
                <select value={dealInPlayerId} onChange={e => setDealInPlayerId(e.target.value)}>
                  <option value="">-- Who dealt in? --</option>
                  {otherPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.userName}</option>
                  ))}
                </select>
              </div>
            )}

            {isDongbei && winnerId && (
              <div className="form-group">
                <label>闭门 Players (select all that apply)</label>
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

            <button className="btn btn-primary" onClick={handleAddRound} disabled={!canSubmit}>
              Add Round
            </button>
          </div>
        )}
      </div>

      {session.rounds.length > 0 && (
        <div className="card">
          <h2>Rankings</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th style={{ textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((p, i) => {
                const val = session.totalScores[p.id] || 0
                return (
                  <tr key={p.id}>
                    <td className={i < 3 ? `rank-${i + 1}` : ''}>
                      #{i + 1}
                    </td>
                    <td>{p.displayName}</td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : undefined
                    }}>
                      {val > 0 ? `+${val}` : val}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-outline btn-small" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </>
  )
}
