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

  /** Games played in this mode (国标 / 立直 / 东北). */
  private int games;

  /** 0 if ranked, else (RANKED_MIN_GAMES - games). For "挑战中 X/5" display per mode. */
  private int gamesNeeded;

  /** All-time peak rating in this mode */
  private double peakRating;

  public static TierInfo of(TierService tierService, Player p, GameMode mode) {
    return of(tierService, p, mode, tierService.findThroneId(mode));
  }

  public static TierInfo of(TierService tierService, Player p, GameMode mode, Long throneId) {
    Tier t = tierService.computeTier(p, mode, throneId);
    int level =
        switch (t) {
          case UNRANKED -> 0;
          case LV1 -> 1;
          case LV2 -> 2;
          case LV3 -> 3;
          case LV4_THRONE -> 4;
        };
    double rating =
        switch (mode) {
          case GUOBIAO -> p.getSkillGuobiao();
          case RIICHI -> p.getSkillRiichi();
          case DONGBEI -> p.getSkillDongbei();
        };
    int games =
        switch (mode) {
          case GUOBIAO -> p.getGamesGuobiao();
          case RIICHI -> p.getGamesRiichi();
          case DONGBEI -> p.getGamesDongbei();
        };
    double peak =
        switch (mode) {
          case GUOBIAO -> p.getPeakSkillGuobiao();
          case RIICHI -> p.getPeakSkillRiichi();
          case DONGBEI -> p.getPeakSkillDongbei();
        };
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
