package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

public class SessionSummaryResponse {
  private Long id;
  private String name;
  private String gameMode;
  private String gameModeDisplayName;
  private int playerCount;
  private String status;
  private LocalDateTime createdAt;
  private Double participationBonus;
  private int roundCount;
  private List<PlayerPerformanceDTO> rankings;

  public static SessionSummaryResponse from(GameSession session) {
    SessionSummaryResponse r = new SessionSummaryResponse();
    r.id = session.getId();
    r.name = session.getName();
    r.gameMode = session.getGameMode().name();
    r.gameModeDisplayName = session.getGameMode().getDisplayName();
    r.playerCount = session.getPlayerCount();
    r.status = session.getStatus().name();
    r.createdAt = session.getCreatedAt();
    r.participationBonus = session.getParticipationBonus();
    r.roundCount = session.getRounds() != null ? session.getRounds().size() : 0;

    // Calculate rankings and RP
    r.rankings = calculateRankings(session);

    return r;
  }

  private static List<PlayerPerformanceDTO> calculateRankings(GameSession session) {
    if (session.getPlayers() == null || session.getPlayers().isEmpty()) {
      return Collections.emptyList();
    }

    Map<Long, Integer> totals = new HashMap<>();
    Map<Long, String> names = new HashMap<>();
    for (var gsp : session.getPlayers()) {
      if (gsp.getPlayer() != null) {
        totals.put(gsp.getPlayer().getId(), 0);
        names.put(gsp.getPlayer().getId(), gsp.getPlayer().getUserName());
      }
    }

    for (var round : session.getRounds()) {
      for (var rs : round.getScores()) {
        if (rs.getPlayer() != null) {
          totals.merge(rs.getPlayer().getId(), rs.getScore(), (a, b) -> a + b);
        }
      }
    }

    GameMode mode = session.getGameMode();
    double factor = mode.getRpFactor();
    double[] umaDist = mode.getUmaDist(session.getPlayerCount());

    List<Long> sortedIds =
        totals.keySet().stream()
            .sorted((a, b) -> totals.get(b).compareTo(totals.get(a)))
            .collect(Collectors.toList());

    List<PlayerPerformanceDTO> results = new ArrayList<>();
    int i = 0;
    while (i < sortedIds.size()) {
      int j = i;
      while (j < sortedIds.size()
          && totals.get(sortedIds.get(j)).equals(totals.get(sortedIds.get(i)))) {
        j++;
      }

      int groupSize = j - i;
      int rank = i + 1;
      double totalUma = 0;
      for (int k = i; k < j; k++) {
        totalUma += (k < umaDist.length) ? umaDist[k] : 0;
      }
      double avgUma = totalUma / groupSize;

      for (int k = i; k < j; k++) {
        Long pid = sortedIds.get(k);
        int score = totals.get(pid);
        double rp = (score / factor) + avgUma;
        results.add(
            PlayerPerformanceDTO.builder()
                .userName(names.get(pid))
                .totalScore(score)
                .rp(rp)
                .rank(rank)
                .build());
      }
      i = j;
    }

    return results;
  }

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getGameMode() {
    return gameMode;
  }

  public String getGameModeDisplayName() {
    return gameModeDisplayName;
  }

  public int getPlayerCount() {
    return playerCount;
  }

  public String getStatus() {
    return status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public Double getParticipationBonus() {
    return participationBonus;
  }

  public int getRoundCount() {
    return roundCount;
  }

  public List<PlayerPerformanceDTO> getRankings() {
    return rankings;
  }
}
