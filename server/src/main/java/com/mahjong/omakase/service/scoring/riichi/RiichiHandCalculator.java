package com.mahjong.omakase.service.scoring.riichi;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Scores a winning Riichi hand from its tiles: the best reading by points, then han, then fu. The
 * same rules as the calculator on the scoring page, which previews what this decides.
 */
public final class RiichiHandCalculator {

  private static final int MANGAN = 2000;

  private RiichiHandCalculator() {}

  /** Empty when the tiles are not a winning hand or it has no yaku. */
  public static Optional<HandResult> calculate(
      List<Tile> concealedWithoutWin, List<Meld> exposed, Tile winTile, GameOptions options) {
    List<Tile> concealed = new ArrayList<>(concealedWithoutWin);
    concealed.add(winTile);
    List<Tile> allTiles = new ArrayList<>(concealed);
    for (Meld m : exposed) allTiles.addAll(m.tiles());

    HandResult best = null;
    for (Combination combination : HandDecomposer.findAll(concealed, exposed)) {
      for (Combination trial : tries(combination, winTile)) {
        List<Yaku> yaku = YakuDetector.detect(trial, allTiles, winTile, options);
        if (yaku.stream().allMatch(y -> "宝牌".equals(y.name()))) continue;

        int yakumanCount = (int) yaku.stream().filter(Yaku::yakuman).count();
        int han;
        int fu;
        if (yakumanCount > 0) {
          han = yakumanCount * 13;
          fu = 0;
        } else {
          han = yaku.stream().mapToInt(Yaku::han).sum();
          fu = FuCalculator.fu(trial, winTile, options);
        }
        HandResult result = score(han, fu, options.seatWind() == 1, yakumanCount, yaku);
        if (best == null || isBetter(result, best)) best = result;
      }
    }
    return Optional.ofNullable(best);
  }

  static HandResult score(int han, int fu, boolean dealer, int yakumanCount, List<Yaku> yaku) {
    int basic = basicPoints(han, fu, yakumanCount);
    int ron;
    int tsumoDealer;
    int tsumoNonDealer;
    if (dealer) {
      ron = roundUp100(basic * 6);
      tsumoDealer = roundUp100(basic * 2);
      tsumoNonDealer = tsumoDealer;
    } else {
      ron = roundUp100(basic * 4);
      tsumoDealer = roundUp100(basic * 2);
      tsumoNonDealer = roundUp100(basic);
    }
    return new HandResult(
        han, fu, yaku, yakumanCount > 0, yakumanCount, ron, tsumoDealer, tsumoNonDealer);
  }

  private static int basicPoints(int han, int fu, int yakumanCount) {
    if (yakumanCount > 0) return 8000 * yakumanCount;
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    if (han >= 5) return MANGAN;
    if (han == 4 && fu >= 30) return MANGAN;
    if (han == 3 && fu >= 60) return MANGAN;
    return Math.min(fu * (1 << (2 + han)), MANGAN);
  }

  private static int roundUp100(int value) {
    return (int) Math.ceil(value / 100.0) * 100;
  }

  /**
   * When the winning tile fits more than one concealed group, each is tried as the one it
   * completed.
   */
  private static List<Combination> tries(Combination combination, Tile winTile) {
    if (combination.kokushi() || combination.chiitoitsu()) return List.of(combination);

    List<Meld> melds = combination.melds();
    List<Integer> matching = new ArrayList<>();
    for (int i = 0; i < melds.size(); i++) {
      Meld m = melds.get(i);
      if (!m.open() && m.tiles().contains(winTile)) matching.add(i);
    }
    if (matching.isEmpty()) return List.of(combination);

    List<Combination> out = new ArrayList<>();
    for (int index : matching) {
      List<Meld> copy = new ArrayList<>(melds);
      copy.set(index, melds.get(index).completed());
      out.add(new Combination(copy));
    }
    return out;
  }

  private static boolean isBetter(HandResult candidate, HandResult current) {
    if (candidate.ron() != current.ron()) return candidate.ron() > current.ron();
    if (candidate.han() != current.han()) return candidate.han() > current.han();
    return candidate.fu() > current.fu();
  }
}
