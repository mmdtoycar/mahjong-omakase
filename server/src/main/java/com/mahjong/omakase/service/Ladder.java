package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Tier;

/** 段位战 rules: 灵明石猴 / 美猴王 / 齐天大圣 in stars, then 斗战圣佛 counted in 魂珠. */
public final class Ladder {

  private Ladder() {}

  public static final int START_LEVEL = 3;

  /** Levels 0..8 are stars; 9 is 斗战圣佛. */
  public static final int DOU_LEVEL = 9;

  /** 魂珠 on reaching 斗战圣佛; going below zero drops back to 齐天大圣. */
  public static final int DOU_START = 10;

  /** 斗战圣佛 at one table that double its 魂珠. */
  public static final int DOU_TO_DOUBLE = 2;

  private static final int[] DOU_4 = {3, 1, -1, -3};
  private static final int[] DOU_3 = {3, 0, -3};

  /** Points that fill each star, 灵明石猴 1 星 to 齐天大圣 3 星; 齐天大圣's rise so 斗战圣佛 is hard to reach. */
  private static final int[] STAR_CAP = {100, 100, 100, 150, 150, 150, 300, 400, 500};

  private static final int[] PLACE_POINTS_4 = {30, 10, 0};
  private static final int[] LAST_POINTS_4 = {0, -30, -50};
  private static final int[] PLACE_POINTS_3 = {30, 0};
  private static final int[] LAST_POINTS_3 = {0, -25, -40};

  /** 素点 counts half, so placement stays the bulk of every game. */
  private static final double SOTEN_WEIGHT = 0.5;

  /** Median pairwise gap in session totals per mode (Apr–Oct 2026), so 素点 is on one scale. */
  private static final double RIICHI_GAP = 14550;

  private static final double GUOBIAO_GAP = 62;
  private static final double DONGBEI_GAP = 32;

  /** A newcomer cannot drop out of 美猴王 in their first this-many games of a mode. */
  public static final int PROTECTED_GAMES = 10;

  /** {@code level} 0..8 stars or 9 斗战圣佛; {@code points} into the star, or 魂珠. */
  public record State(int level, double points) {
    public static State start() {
      return new State(START_LEVEL, starCap(START_LEVEL) / 2.0);
    }
  }

  public static boolean isDou(int level) {
    return level >= DOU_LEVEL;
  }

  /** Points that fill the current star; 0 for 斗战圣佛, whose 魂珠 have no cap. */
  public static int starCap(int level) {
    return isDou(level) ? 0 : STAR_CAP[level];
  }

  /** 1 to 3; 0 for 斗战圣佛. */
  public static int stars(int level) {
    return isDou(level) ? 0 : level % 3 + 1;
  }

  public static Tier tierOf(int level) {
    if (isDou(level)) return Tier.LV4_THRONE;
    return switch (level / 3) {
      case 0 -> Tier.LV1;
      case 1 -> Tier.LV2;
      default -> Tier.LV3;
    };
  }

  /** A game's move along the ladder; null when the level stayed put. */
  public static String move(int before, int after) {
    if (after == before) return null;
    boolean tierChanged = tierOf(after) != tierOf(before);
    if (after > before) return tierChanged ? "TIER_UP" : "STAR_UP";
    return tierChanged ? "TIER_DOWN" : "STAR_DOWN";
  }

  /** Orders players by ladder position. */
  public static double sortKey(State s) {
    return s.level() * 1000.0 + s.points();
  }

  /** One game's points; ties split their places. 斗战圣佛 gets 魂珠, doubled if another 斗战圣佛 sits in. */
  public static double gain(
      int[] places, int tableSize, int score, GameMode mode, int level, boolean doubled) {
    double placement = 0;
    for (int place : places) {
      placement +=
          isDou(level)
              ? (tableSize == 3 ? DOU_3 : DOU_4)[place]
              : placePoints(place, tableSize, level / 3);
    }
    placement /= places.length;
    if (isDou(level)) {
      return doubled ? placement * 2 : placement;
    }
    return placement + SOTEN_WEIGHT * score * RIICHI_GAP / gap(mode) / 1000.0;
  }

  private static int placePoints(int place, int tableSize, int tier) {
    if (tableSize == 3) {
      return place < 2 ? PLACE_POINTS_3[place] : LAST_POINTS_3[tier];
    }
    return place < 3 ? PLACE_POINTS_4[place] : LAST_POINTS_4[tier];
  }

  private static double gap(GameMode mode) {
    return switch (mode) {
      case RIICHI -> RIICHI_GAP;
      case GUOBIAO -> GUOBIAO_GAP;
      case DONGBEI -> DONGBEI_GAP;
    };
  }

  /**
   * Moves a full star up and a negative one down, half full; 斗战圣佛 drops once its 魂珠 go negative.
   */
  public static State apply(State before, double gain, boolean protectedNewcomer) {
    int level = before.level();
    double points = before.points() + gain;
    if (isDou(level)) {
      return points >= 0
          ? new State(level, points)
          : new State(level - 1, starCap(level - 1) / 2.0);
    }
    if (points >= starCap(level)) {
      level++;
      points = isDou(level) ? DOU_START : starCap(level) / 2.0;
    } else if (points < 0 && level > 0) {
      level--;
      points = starCap(level) / 2.0;
    } else if (level == 0) {
      points = Math.max(points, 0);
    }
    if (protectedNewcomer && level < START_LEVEL) {
      return new State(START_LEVEL, 0);
    }
    return new State(level, points);
  }
}
