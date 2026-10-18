package com.mahjong.omakase.service.scoring.riichi;

import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import java.util.List;

/** Fu of a hand, and the wait it was won on. */
final class FuCalculator {

  enum Wait {
    DANQI,
    DUIPENG,
    BIANZHANG,
    LIANGMIAN,
    KANZHANG
  }

  private FuCalculator() {}

  static int fu(Combination combination, Tile winTile, GameOptions options) {
    if (combination.kokushi() || combination.chiitoitsu()) return 25;

    List<Meld> groups = combination.groups();
    Meld pair = combination.pair();
    boolean concealed = groups.stream().noneMatch(Meld::open);
    Wait wait = wait(combination, winTile);
    boolean pinfu =
        concealed
            && groups.stream().allMatch(m -> m.kind() == Kind.SHUNZI)
            && !isYakuhaiPair(pair, options)
            && wait == Wait.LIANGMIAN;

    // 平和 tsumo is fixed at 20: the tsumo fu is waived.
    if (pinfu && options.tsumo()) return 20;

    int fu = 20;
    if (concealed && !options.tsumo()) fu += 10;
    if (options.tsumo()) fu += 2;
    for (Meld m : groups) {
      boolean ronTarget = !options.tsumo() && m.completedByWin();
      fu += groupFu(m, ronTarget);
    }
    fu += pairFu(pair, options);
    if (wait == Wait.KANZHANG || wait == Wait.BIANZHANG || wait == Wait.DANQI) fu += 2;

    return Math.max((int) Math.ceil(fu / 10.0) * 10, 30);
  }

  private static int groupFu(Meld meld, boolean ronTarget) {
    if (meld.kind() == Kind.SHUNZI) return 0;
    int n = 1;
    if (meld.first().isTerminalOrHonor()) n++;
    if (!meld.open() && !ronTarget) n++;
    if (meld.kind() == Kind.GANGZI) n += 2;
    return 1 << n;
  }

  private static int pairFu(Meld pair, GameOptions options) {
    Tile t = pair.first();
    int fu = 0;
    if (t.isDragon()) fu += 2;
    if (t.isWind() && t.rank() == options.roundWind()) fu += 2;
    if (t.isWind() && t.rank() == options.seatWind()) fu += 2;
    return fu;
  }

  static boolean isYakuhaiPair(Meld pair, GameOptions options) {
    Tile t = pair.first();
    return t.isDragon()
        || (t.isWind() && t.rank() == options.roundWind())
        || (t.isWind() && t.rank() == options.seatWind());
  }

  static Wait wait(Combination combination, Tile winTile) {
    List<Meld> melds = combination.melds();
    Meld pair = combination.pair();
    List<Meld> groups = combination.groups();

    Meld completed = melds.stream().filter(Meld::completedByWin).findFirst().orElse(null);
    if (completed != null) {
      if (completed.kind() == Kind.DUIZI) return Wait.DANQI;
      if (completed.isTriplet()) return Wait.DUIPENG;
      return sequenceWait(completed.first().rank(), winTile.rank());
    }

    if (pair.first().equals(winTile)) return Wait.DANQI;

    for (Meld m : groups) {
      if (m.isTriplet() && !m.open() && m.first().equals(winTile)) return Wait.DUIPENG;
    }

    return groups.stream()
        .filter(m -> m.kind() == Kind.SHUNZI && !m.open() && m.tiles().contains(winTile))
        .findFirst()
        .map(m -> sequenceWait(m.first().rank(), winTile.rank()))
        .orElse(Wait.LIANGMIAN);
  }

  private static Wait sequenceWait(int startRank, int winRank) {
    if (winRank == startRank) return startRank == 7 ? Wait.BIANZHANG : Wait.LIANGMIAN;
    if (winRank == startRank + 1) return Wait.KANZHANG;
    return startRank == 1 ? Wait.BIANZHANG : Wait.LIANGMIAN;
  }
}
