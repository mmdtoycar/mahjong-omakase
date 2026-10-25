package com.mahjong.omakase.service.scoring;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Every total a Riichi hand can be worth. */
public final class RiichiScoreTable {

  private static final int[] FU = {20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110};

  /** One way to reach a basic point value. */
  private record Hand(int han, int fu, int basic, boolean ron, boolean tsumo) {}

  private static final List<Hand> HANDS = hands();

  private RiichiScoreTable() {}

  private static List<Hand> hands() {
    List<Hand> out = new ArrayList<>();
    for (int han = 1; han <= 12; han++) {
      for (int fu : FU) {
        // 20 fu is a 平和 tsumo and 25 fu is 七对子, both at least 2 han.
        if ((fu == 20 || fu == 25) && han < 2) continue;
        out.add(
            new Hand(han, fu, RiichiScoreCalculator.calculateBasicPoints(han, fu), fu != 20, true));
      }
    }
    out.add(new Hand(13, 0, 8000, true, true));
    return out;
  }

  private static int roundUp100(int value) {
    return (int) Math.ceil(value / 100.0) * 100;
  }

  /** What the table pays in all, before 本场 and 供托. */
  public static int total(int basic, boolean dealer, boolean selfDraw, int players) {
    if (!selfDraw) return roundUp100(basic * (dealer ? 6 : 4));
    int others = players - 1;
    return dealer
        ? others * roundUp100(basic * 2)
        : roundUp100(basic * 2) + (others - 1) * roundUp100(basic);
  }

  /** Basic points that make {@code total}, narrowed to hanHint when that fits. */
  public static Set<Integer> basicsFor(
      int total, boolean dealer, boolean selfDraw, int players, Integer hanHint) {
    Set<Integer> all = new HashSet<>();
    Set<Integer> hinted = new HashSet<>();
    for (Hand h : HANDS) {
      if (selfDraw ? !h.tsumo() : !h.ron()) continue;
      if (total(h.basic(), dealer, selfDraw, players) != total) continue;
      all.add(h.basic());
      if (hanHint != null && h.han() == hanHint) hinted.add(h.basic());
    }
    return hinted.isEmpty() ? all : hinted;
  }
}
