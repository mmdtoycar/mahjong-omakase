package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Tier;

/**
 * 段位战 rules: points earned per game, and how they move a player between stars.
 *
 * <p>Nine levels, three stars in each of 灵明石猴 / 美猴王 / 齐天大圣. Everyone starts at 美猴王 1 star, half
 * full. Placement points are the same at every tier; only the last place costs more the higher you
 * are, so an average player keeps climbing out of 灵明石猴, drifts slowly upward through 美猴王, and is
 * pushed back down from 齐天大圣 unless they really finish better than the table.
 */
public final class Ladder {

  private Ladder() {}

  public static final int LEVELS = 9;
  public static final int START_LEVEL = 3;

  /** Points needed to fill one star, by tier. */
  private static final int[] STAR_CAP = {60, 100, 150};

  private static final int[] PLACE_POINTS_4 = {30, 10, 0};
  private static final int[] LAST_POINTS_4 = {0, -30, -50};
  private static final int[] PLACE_POINTS_3 = {30, 0};
  private static final int[] LAST_POINTS_3 = {0, -25, -40};

  /**
   * How much a game's 素点 counts. Half, so placement stays the bulk of every game and one big hand
   * does not decide a star on its own.
   */
  private static final double SOTEN_WEIGHT = 0.5;

  /**
   * The median gap between two players' session totals in each mode, measured over the sessions
   * played April to October 2026. 立直's is used as the unit, so 1000 立直 points is one point of 素点
   * and the other modes are scaled to the same typical swing.
   */
  private static final double RIICHI_GAP = 14550;

  private static final double GUOBIAO_GAP = 62;
  private static final double DONGBEI_GAP = 32;

  /** A newcomer cannot drop out of 美猴王 in their first this-many games of a mode. */
  public static final int PROTECTED_GAMES = 10;

  /** Where a player stands: {@code level} 0..8, {@code points} into the current star. */
  public record State(int level, double points) {
    public static State start() {
      return new State(START_LEVEL, starCap(START_LEVEL) / 2.0);
    }
  }

  public static int starCap(int level) {
    return STAR_CAP[level / 3];
  }

  /** 1, 2 or 3. */
  public static int stars(int level) {
    return level % 3 + 1;
  }

  /** LV1 / LV2 / LV3 for the level alone; the throne is decided elsewhere. */
  public static Tier tierOf(int level) {
    return switch (level / 3) {
      case 0 -> Tier.LV1;
      case 1 -> Tier.LV2;
      default -> Tier.LV3;
    };
  }

  /** One number that orders players by ladder position, for sorting. */
  public static double sortKey(State s) {
    return s.level() * 1000.0 + s.points();
  }

  /**
   * Points for one game. {@code places} is the 0-based placements this player shares — one entry
   * normally, several when tied — and tied players split those places' points evenly.
   */
  public static double gain(int[] places, int tableSize, int score, GameMode mode, int level) {
    int tier = level / 3;
    double placement = 0;
    for (int place : places) {
      placement += placePoints(place, tableSize, tier);
    }
    placement /= places.length;
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
   * Applies one game's points. A full star promotes to the next, starting half full; dropping below
   * zero demotes to the previous one, also half full. The bottom star never drops, the top star
   * stops filling at its cap, and while {@code protectedNewcomer} the player stays in 美猴王.
   */
  public static State apply(State before, double gain, boolean protectedNewcomer) {
    int level = before.level();
    double points = before.points() + gain;
    if (points >= starCap(level) && level < LEVELS - 1) {
      level++;
      points = starCap(level) / 2.0;
    } else if (points < 0 && level > 0) {
      level--;
      points = starCap(level) / 2.0;
    } else if (level == LEVELS - 1) {
      points = Math.min(points, starCap(level));
    } else if (level == 0) {
      points = Math.max(points, 0);
    }
    if (protectedNewcomer && level < START_LEVEL) {
      return new State(START_LEVEL, 0);
    }
    return new State(level, points);
  }
}
