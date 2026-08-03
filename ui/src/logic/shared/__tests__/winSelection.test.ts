import { describe, it, expect } from 'vitest'
import { nextWinSelection, EMPTY_WIN_SELECTION, WinSelection } from '../winSelection'

/** 连点若干下, 返回最终状态. allowChombo 对应国标. */
function taps(pids: string[], allowChombo: boolean, from: WinSelection = EMPTY_WIN_SELECTION) {
  return pids.reduce((cur, pid) => nextWinSelection(cur, pid, allowChombo), from)
}

describe('nextWinSelection: 点击循环', () => {
  it('点空位 → 该玩家和牌, 默认点炮', () => {
    expect(taps(['A'], false)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'ron' })
  })

  it('再点同一人 → 自摸', () => {
    expect(taps(['A', 'A'], false)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'tsumo' })
  })

  it('国标第三下 → 诈胡', () => {
    expect(taps(['A', 'A', 'A'], true)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'chombo' })
  })

  it('国标第四下 → 清空', () => {
    expect(taps(['A', 'A', 'A', 'A'], true)).toEqual(EMPTY_WIN_SELECTION)
  })

  it('非国标没有诈胡, 第三下就清空', () => {
    expect(taps(['A', 'A', 'A'], false)).toEqual(EMPTY_WIN_SELECTION)
  })
})

describe('nextWinSelection: 点炮者', () => {
  it('点炮模式下点另一人 → 指定点炮者', () => {
    expect(taps(['A', 'B'], false)).toEqual({ winnerId: 'A', dealInPlayerId: 'B', kind: 'ron' })
  })

  it('再点同一个点炮者 → 取消', () => {
    expect(taps(['A', 'B', 'B'], false)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'ron' })
  })

  it('点第三人 → 换点炮者', () => {
    expect(taps(['A', 'B', 'C'], false)).toEqual({ winnerId: 'A', dealInPlayerId: 'C', kind: 'ron' })
  })

  // 核心诉求: 和牌者与点炮者不会因为点击顺序而互换
  it('先点的人始终是和牌者, 不会被后点的人顶掉', () => {
    const s = taps(['A', 'B'], false)
    expect(s.winnerId).toBe('A')
    expect(s.dealInPlayerId).toBe('B')
  })

  it('切到自摸时清掉已选的点炮者', () => {
    expect(taps(['A', 'B', 'A'], false)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'tsumo' })
  })

  it('切到诈胡时也清掉点炮者', () => {
    expect(taps(['A', 'B', 'A', 'A'], true)).toEqual({ winnerId: 'A', dealInPlayerId: '', kind: 'chombo' })
  })
})

describe('nextWinSelection: 自摸/诈胡下换人', () => {
  it('自摸下点另一人 → 换和牌者并保留自摸', () => {
    expect(taps(['A', 'A', 'B'], false)).toEqual({ winnerId: 'B', dealInPlayerId: '', kind: 'tsumo' })
  })

  it('诈胡下点另一人 → 换诈胡者并保留诈胡', () => {
    expect(taps(['A', 'A', 'A', 'B'], true)).toEqual({ winnerId: 'B', dealInPlayerId: '', kind: 'chombo' })
  })

  it('换人后循环从当前胡法继续推进, 而不是从头开始', () => {
    // A 自摸 → 换成 B(仍自摸) → 再点 B 应进入诈胡(国标)
    expect(taps(['A', 'A', 'B', 'B'], true)).toEqual({ winnerId: 'B', dealInPlayerId: '', kind: 'chombo' })
  })
})

describe('nextWinSelection: 不变量', () => {
  it('自摸与诈胡下永远没有点炮者', () => {
    const seqs = [
      ['A', 'A'],
      ['A', 'B', 'A'],
      ['A', 'A', 'B'],
      ['A', 'A', 'A'],
      ['A', 'B', 'A', 'A'],
      ['A', 'A', 'A', 'B'],
    ]
    for (const seq of seqs) {
      const s = taps(seq, true)
      if (s.kind !== 'ron') expect(s.dealInPlayerId).toBe('')
    }
  })

  it('点炮者永远不等于和牌者', () => {
    for (const seq of [
      ['A', 'B'],
      ['A', 'B', 'C'],
      ['A', 'A', 'B', 'C'],
      ['A', 'B', 'A', 'A'],
    ]) {
      const s = taps(seq, true)
      if (s.dealInPlayerId) expect(s.dealInPlayerId).not.toBe(s.winnerId)
    }
  })

  it('清空后是干净状态, 可以重新开始', () => {
    const cleared = taps(['A', 'A', 'A'], false)
    expect(cleared).toEqual(EMPTY_WIN_SELECTION)
    expect(taps(['B'], false, cleared)).toEqual({ winnerId: 'B', dealInPlayerId: '', kind: 'ron' })
  })
})
