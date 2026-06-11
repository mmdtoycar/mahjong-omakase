package com.mahjong.omakase.dto;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public class HomeSummaryResponse {
  private final List<SessionDetailResponse> activeSessions;
  private final Map<String, ModeRanking> rankings;

  public HomeSummaryResponse(
      List<SessionDetailResponse> activeSessions, Map<String, ModeRanking> rankings) {
    this.activeSessions = Objects.requireNonNull(activeSessions, "activeSessions");
    this.rankings = Objects.requireNonNull(rankings, "rankings");
  }

  public List<SessionDetailResponse> getActiveSessions() {
    return activeSessions;
  }

  public Map<String, ModeRanking> getRankings() {
    return rankings;
  }

  public static class ModeRanking {
    private final List<PlayerStatsResponse> top;
    private final BestRoundResponse best;

    public ModeRanking(List<PlayerStatsResponse> top, BestRoundResponse best) {
      this.top = Objects.requireNonNull(top, "top");
      this.best = best; // null is intentional when no best round exists yet
    }

    public List<PlayerStatsResponse> getTop() {
      return top;
    }

    public BestRoundResponse getBest() {
      return best;
    }
  }
}
