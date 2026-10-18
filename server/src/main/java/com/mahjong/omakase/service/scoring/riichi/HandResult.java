package com.mahjong.omakase.service.scoring.riichi;

import java.util.List;
import java.util.stream.Collectors;

/** A scored hand. */
public record HandResult(
    int han,
    int fu,
    List<Yaku> yaku,
    boolean yakuman,
    int ron,
    int tsumoDealer,
    int tsumoNonDealer) {

  /** Yaku as shown on the scoreboard, e.g. {@code 立直(1), 宝牌(2)}. */
  public String yakuText() {
    return yaku.stream().map(y -> y.name() + "(" + y.han() + ")").collect(Collectors.joining(", "));
  }

  /** What the table pays the winner in all, before 本场 and 供托. */
  public int total(boolean winnerIsDealer, boolean selfDraw, int players) {
    if (!selfDraw) return ron;
    return winnerIsDealer
        ? tsumoNonDealer * (players - 1)
        : tsumoDealer + tsumoNonDealer * (players - 2);
  }
}
