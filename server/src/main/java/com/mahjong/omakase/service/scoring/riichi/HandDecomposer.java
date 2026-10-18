package com.mahjong.omakase.service.scoring.riichi;

import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Every way a winning hand can be read. */
final class HandDecomposer {

  private static final List<Tile> ORPHANS = orphans();

  private HandDecomposer() {}

  private static List<Tile> orphans() {
    List<Tile> out = new ArrayList<>();
    for (char suit : new char[] {'m', 'p', 's'}) {
      out.add(new Tile(suit, 1));
      out.add(new Tile(suit, 9));
    }
    for (int rank = 1; rank <= 7; rank++) out.add(new Tile('z', rank));
    return out;
  }

  /** {@code concealed} includes the winning tile; {@code exposed} are the called groups. */
  static List<Combination> findAll(List<Tile> concealed, List<Meld> exposed) {
    List<Combination> results = new ArrayList<>();
    List<Tile> sorted = new ArrayList<>(concealed);
    Collections.sort(sorted);

    if (exposed.isEmpty() && sorted.size() == 14) {
      if (isSevenPairs(sorted)) results.add(new Combination(List.of(), true, false));
      if (isThirteenOrphans(sorted)) results.add(new Combination(List.of(), false, true));
    }

    List<List<Meld>> standard = new ArrayList<>();
    decompose(sorted, new ArrayList<>(), standard, 5 - exposed.size(), false);
    for (List<Meld> groups : standard) {
      List<Meld> melds = new ArrayList<>(exposed);
      melds.addAll(groups);
      results.add(new Combination(melds));
    }
    return results;
  }

  private static void decompose(
      List<Tile> remaining,
      List<Meld> current,
      List<List<Meld>> results,
      int groupsLeft,
      boolean hasPair) {
    if (remaining.isEmpty()) {
      if (groupsLeft == 0) results.add(new ArrayList<>(current));
      return;
    }
    if (groupsLeft <= 0) return;

    Tile first = remaining.get(0);
    Map<Tile, Integer> counts = count(remaining);

    if (!hasPair && counts.get(first) >= 2) {
      current.add(new Meld(Kind.DUIZI, List.of(first, first), false));
      decompose(without(remaining, first, first), current, results, groupsLeft - 1, true);
      current.remove(current.size() - 1);
    }

    if (counts.get(first) >= 3) {
      current.add(new Meld(Kind.KEZI, List.of(first, first, first), false));
      decompose(without(remaining, first, first, first), current, results, groupsLeft - 1, hasPair);
      current.remove(current.size() - 1);
    }

    if (first.isNumber() && first.rank() <= 7) {
      Tile second = new Tile(first.suit(), first.rank() + 1);
      Tile third = new Tile(first.suit(), first.rank() + 2);
      if (counts.containsKey(second) && counts.containsKey(third)) {
        current.add(new Meld(Kind.SHUNZI, List.of(first, second, third), false));
        decompose(
            without(remaining, first, second, third), current, results, groupsLeft - 1, hasPair);
        current.remove(current.size() - 1);
      }
    }
  }

  private static boolean isSevenPairs(List<Tile> tiles) {
    Map<Tile, Integer> counts = count(tiles);
    return counts.size() == 7 && counts.values().stream().allMatch(c -> c == 2);
  }

  private static boolean isThirteenOrphans(List<Tile> tiles) {
    Map<Tile, Integer> counts = count(tiles);
    return ORPHANS.stream().allMatch(counts::containsKey)
        && ORPHANS.stream().anyMatch(t -> counts.get(t) >= 2);
  }

  static Map<Tile, Integer> count(List<Tile> tiles) {
    Map<Tile, Integer> counts = new TreeMap<>();
    for (Tile t : tiles) counts.merge(t, 1, Integer::sum);
    return counts;
  }

  private static List<Tile> without(List<Tile> all, Tile... remove) {
    List<Tile> out = new ArrayList<>(all);
    for (Tile t : remove) out.remove(t);
    return out;
  }
}
