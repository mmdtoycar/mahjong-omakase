package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.service.TierService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Tier + skill information for one player in one game mode. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TierInfo {
  /** "UNRANKED" / "LV1" / "LV2" / "LV3" / "LV4_THRONE" */
  private String tier;

  /** 0 (unranked) / 1 / 2 / 3 / 4 — used to map to lv*.png images */
  private int level;

  /** Current skill rating */
  private double rating;

  /** Games played in this mode (国标 or 立直). */
  private int games;

  /** 0 if ranked, else (RANKED_MIN_GAMES - games). For "挑战中 X/10" display per mode. */
  private int gamesNeeded;

  /** All-time peak rating in this mode */
  private double peakRating;

  public static TierInfo of(TierService tierService, Player p, GameMode mode) {
    Tier t = tierService.computeTier(p, mode);
    int level =
        switch (t) {
          case UNRANKED -> 0;
          case LV1 -> 1;
          case LV2 -> 2;
          case LV3 -> 3;
          case LV4_THRONE -> 4;
        };
    double rating = mode == GameMode.GUOBIAO ? p.getSkillGuobiao() : p.getSkillRiichi();
    int games = mode == GameMode.GUOBIAO ? p.getGamesGuobiao() : p.getGamesRiichi();
    double peak = mode == GameMode.GUOBIAO ? p.getPeakSkillGuobiao() : p.getPeakSkillRiichi();
    int needed = t == Tier.UNRANKED ? Math.max(0, TierService.RANKED_MIN_GAMES - games) : 0;
    return TierInfo.builder()
        .tier(t.name())
        .level(level)
        .rating(rating)
        .games(games)
        .gamesNeeded(needed)
        .peakRating(peak)
        .build();
  }
}
