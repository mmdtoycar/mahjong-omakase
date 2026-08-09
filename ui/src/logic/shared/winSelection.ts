/** 和牌方式. `ron` = 点炮和, 需要一名点炮者; `tsumo` / `chombo` 不需要. */
type WinKind = 'ron' | 'tsumo' | 'chombo'

export interface WinSelection {
  /** 和牌者(诈胡时为诈胡者); 空串表示未选. */
  winnerId: string
  /** 点炮者; 空串表示未选. 仅 `ron` 有意义. */
  dealInPlayerId: string
  kind: WinKind
}

export const EMPTY_WIN_SELECTION: WinSelection = { winnerId: '', dealInPlayerId: '', kind: 'ron' }

/**
 * 点一下玩家按钮后的新状态 —— 一个按钮承担"选人"和"定胡法"两件事, 靠点击次数区分,
 * 与流局分支的 立直/默听 循环同一套交互.
 *
 * <p>规则:
 * <ul>
 *   <li>点未选中的人, 且还没有和牌者 → 他成为和牌者, 胡法默认 ron
 *   <li>反复点和牌者 → ron → tsumo →(允许时) chombo → 全部清空
 *   <li>ron 下点另一个人 → 指定/取消点炮者
 *   <li>tsumo / chombo 下点另一个人 → 换和牌者, 保留当前胡法(不需要点炮者)
 * </ul>
 *
 * <p>为什么是纯函数: 这套循环分支不少, 直接写在组件里只能靠手点验证; 抽出来才能穷举测试。
 */
export function nextWinSelection(cur: WinSelection, pid: string, allowChombo: boolean): WinSelection {
  if (cur.winnerId === pid) {
    if (cur.kind === 'ron') {
      // 自摸没有点炮者, 顺手清掉之前可能已经选上的人
      return { winnerId: pid, dealInPlayerId: '', kind: 'tsumo' }
    }
    if (cur.kind === 'tsumo' && allowChombo) {
      return { winnerId: pid, dealInPlayerId: '', kind: 'chombo' }
    }
    return EMPTY_WIN_SELECTION
  }

  if (cur.winnerId && cur.kind === 'ron') {
    return { ...cur, dealInPlayerId: cur.dealInPlayerId === pid ? '' : pid }
  }

  // 没有和牌者(此时 kind 归位到 ron), 或 tsumo/chombo 下换人(保留胡法)
  return {
    winnerId: pid,
    dealInPlayerId: '',
    kind: cur.winnerId ? cur.kind : 'ron',
  }
}
