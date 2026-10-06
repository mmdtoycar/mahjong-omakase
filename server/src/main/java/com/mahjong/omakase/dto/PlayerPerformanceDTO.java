package com.mahjong.omakase.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerPerformanceDTO {
  private Long playerId;
  private String userName;
  private Integer totalScore;
  private Integer rank;

  /** Tier in the session's mode: "UNRANKED|LV1|LV2|LV3|LV4_THRONE", null if mode untracked. */
  private String tier;

  /** 段位战 position after this game, as in {@link TierInfo}. */
  private Integer stars;

  private Double points;
  private Integer starCap;
  private Integer douLevel;

  public void setLadder(TierInfo info) {
    tier = info.getTier();
    stars = info.getStars();
    points = info.getPoints();
    starCap = info.getStarCap();
    douLevel = info.getDouLevel();
  }
}
