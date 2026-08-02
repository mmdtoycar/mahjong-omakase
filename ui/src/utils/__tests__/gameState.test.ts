import { describe, it, expect } from 'vitest'
import { deriveGameState } from '../gameState'
import { PlayerInfo, RoundInfo, SessionDetail } from '../../types'

const PLAYERS: PlayerInfo[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  userName: `p${n}`,
  firstName: 'P',
  lastName: String(n),
  displayName: `P ${n}`,
  seat: n,
}))

function session(rounds: RoundInfo[]): SessionDetail {
  return {
    id: 1,
    name: 'test',
    gameMode: 'RIICHI',
    gameModeDisplayName: '立直麻将',
    playerCount: 4,
    status: 'IN_PROGRESS',
    createdAt: '2026-08-02T00:00:00',
    players: PLAYERS,
    rounds,
    totalScores: {},
    rpFactor: 1,
    rpOrigin: 0,
    umaDist: [],
  }
}

function draw(tenpaiPlayerIds: number[]): RoundInfo {
  const scores: Record<number, number> = {}
  const noten = PLAYERS.filter((p) => !tenpaiPlayerIds.includes(p.id))
  for (const p of PLAYERS) {
    if (tenpaiPlayerIds.length === 0 || noten.length === 0) {
      scores[p.id] = 0
    } else {
      scores[p.id] = tenpaiPlayerIds.includes(p.id) ? 3000 / tenpaiPlayerIds.length : -3000 / noten.length
    }
  }
  return { roundNumber: 1, scores, tenpaiPlayerIds }
}

describe('deriveGameState: riichi ryuukyoku dealer rotation', () => {
  it('全员未听 → 流庄, 本场 +1', () => {
    const s = deriveGameState(session([draw([])]))
    expect(s.dealerPlayerId).toBe(2)
    expect(s.displayName).toBe('东2 1本场')
  })

  it('全员听牌 → 连庄, 本场 +1', () => {
    const s = deriveGameState(session([draw([1, 2, 3, 4])]))
    expect(s.dealerPlayerId).toBe(1)
    expect(s.displayName).toBe('东1 1本场')
  })

  it('庄家听牌 (部分听) → 连庄', () => {
    const s = deriveGameState(session([draw([1, 3])]))
    expect(s.dealerPlayerId).toBe(1)
    expect(s.displayName).toBe('东1 1本场')
  })

  it('庄家未听 (部分听) → 流庄, 本场 +1', () => {
    const s = deriveGameState(session([draw([2, 3])]))
    expect(s.dealerPlayerId).toBe(2)
    expect(s.displayName).toBe('东2 1本场')
  })

  it('连续流局本场累加, 庄家轮转', () => {
    const s = deriveGameState(session([draw([]), draw([]), draw([1, 2, 3, 4])]))
    expect(s.dealerPlayerId).toBe(3)
    expect(s.displayName).toBe('东3 3本场')
  })

  it('legacy 流局 (无听牌名单) 沿用点数推断', () => {
    const notenDealer: RoundInfo = {
      roundNumber: 1,
      scores: { 1: -1500, 2: 1500, 3: 1500, 4: -1500 },
    }
    const s = deriveGameState(session([notenDealer]))
    expect(s.dealerPlayerId).toBe(2)
    expect(s.displayName).toBe('东2 1本场')
  })

  it('闲家和牌 → 流庄, 本场清零', () => {
    const win: RoundInfo = { roundNumber: 1, scores: { 1: 0, 2: -3900, 3: 3900, 4: 0 }, winnerId: 3 }
    const s = deriveGameState(session([draw([]), win]))
    expect(s.dealerPlayerId).toBe(3)
    expect(s.displayName).toBe('东3')
  })

  it('庄家和牌 → 连庄, 本场 +1', () => {
    const win: RoundInfo = { roundNumber: 1, scores: { 1: 5800, 2: -5800, 3: 0, 4: 0 }, winnerId: 1 }
    const s = deriveGameState(session([win]))
    expect(s.dealerPlayerId).toBe(1)
    expect(s.displayName).toBe('东1 1本场')
  })

  it('立直棒流局保留, 和牌清零', () => {
    const drawWithRiichi: RoundInfo = { ...draw([2, 3]), riichiPlayerIds: [2, 3] }
    expect(deriveGameState(session([drawWithRiichi])).kyoutaku).toBe(2000)
    const win: RoundInfo = { roundNumber: 2, scores: { 1: -3900, 2: 3900, 3: 0, 4: 0 }, winnerId: 2 }
    expect(deriveGameState(session([drawWithRiichi, win])).kyoutaku).toBe(0)
  })
})
