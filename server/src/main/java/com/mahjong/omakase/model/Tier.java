package com.mahjong.omakase.model;

/**
 * Player tier within a single game mode. Derived from skill rating + per-mode game count + the
 * "throne" (single highest-rated player gets LV4_THRONE).
 *
 * <p>Tier names map to images in ui/public/rank/lv{1-4}.png.
 */
public enum Tier {
  /** < 10 games in this mode — display "挑战中 X/10". */
  UNRANKED,
  /** 灵明石猴: rating < 1400. */
  LV1,
  /** 美猴王: 1400 ≤ rating < 1500. */
  LV2,
  /** 齐天大圣: rating ≥ 1500 (and not currently the throne holder). */
  LV3,
  /** 斗战圣佛: the single highest-rated player in this mode (≥ LV3 cutoff). */
  LV4_THRONE
}
