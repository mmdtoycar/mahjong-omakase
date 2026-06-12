package com.mahjong.omakase.dto;

import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class HomeSummaryResponse {
  private final List<SessionDetailResponse> activeSessions;
  private final Map<String, ModeRanking> rankings;

  @Data
  @AllArgsConstructor
  public static class ModeRanking {
    private final List<PlayerStatsResponse> top;

    /** null when no best round exists yet for this mode/season. */
    private final BestRoundResponse best;
  }
}
