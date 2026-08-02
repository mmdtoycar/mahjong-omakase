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
}
