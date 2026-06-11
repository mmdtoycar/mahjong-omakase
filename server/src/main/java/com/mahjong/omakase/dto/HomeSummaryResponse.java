package com.mahjong.omakase.dto;

import java.util.List;
import java.util.Map;

public class HomeSummaryResponse {
  private final List<SessionDetailResponse> activeSessions;
  private final Map<String, ModeRanking> rankings;

  public HomeSummaryResponse(
      List<SessionDetailResponse> activeSessions, Map<String, ModeRanking> rankings) {
    this.activeSessions = activeSessions;
    this.rankings = rankings;
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
      this.top = top;
      this.best = best;
    }

    public List<PlayerStatsResponse> getTop() {
      return top;
    }

    public BestRoundResponse getBest() {
      return best;
    }
  }
}
