package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.service.Ladder;
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

  /** 段位战 stars within the tier, 1 to 3. */
  private int stars;

  /** 段位战 points into the current star. */
  private double points;

  /** Points that fill the current star, or 豆 that complete a 斗战圣佛 level. */
  private int starCap;

  /** 斗战圣佛 Lv.1 and up; 0 below it, where {@link #stars} applies instead. */
  private int douLevel;

  public static TierInfo of(TierService tierService, Player p, GameMode mode) {
    Tier t = tierService.computeTier(p, mode);
    TierInfo info = ofLadder(t, TierService.getLadder(p, mode));
    info.setRating(
        switch (mode) {
          case GUOBIAO -> p.getSkillGuobiao();
          case RIICHI -> p.getSkillRiichi();
          case DONGBEI -> p.getSkillDongbei();
        });
    int games =
        switch (mode) {
          case GUOBIAO -> p.getGamesGuobiao();
          case RIICHI -> p.getGamesRiichi();
          case DONGBEI -> p.getGamesDongbei();
        };
    info.setGames(games);
    info.setGamesNeeded(t == Tier.UNRANKED ? Math.max(0, TierService.RANKED_MIN_GAMES - games) : 0);
    info.setPeakRating(
        switch (mode) {
          case GUOBIAO -> p.getPeakSkillGuobiao();
          case RIICHI -> p.getPeakSkillRiichi();
          case DONGBEI -> p.getPeakSkillDongbei();
        });
    return info;
  }

  /** Tier and 段位战 position only, for a seat's state after a past game. */
  public static TierInfo ofLadder(Tier t, Ladder.State ladder) {
    int level =
        switch (t) {
          case UNRANKED -> 0;
          case LV1 -> 1;
          case LV2 -> 2;
          case LV3 -> 3;
          case LV4_THRONE -> 4;
        };
    return TierInfo.builder()
        .tier(t.name())
        .level(level)
        .stars(Ladder.stars(ladder.level()))
        .points(ladder.points())
        .starCap(Ladder.starCap(ladder.level()))
        .douLevel(Ladder.douLevel(ladder.level()))
        .build();
  }
}
