package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.service.scoring.RpCalculator;
import java.time.LocalDateTime;
import java.util.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
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

  /** "铳之间" / "狠之间" / "贪之间" / "狱之间" / "大圣之间" — null if mode doesn't track ratings. */
  private String tableStrength;

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

    if (session.getRounds() != null) {
      for (var round : session.getRounds()) {
        for (var rs : round.getScores()) {
          if (rs.getPlayer() != null) {
            totals.merge(rs.getPlayer().getId(), rs.getScore(), Integer::sum);
          }
        }
      }
    }

    GameMode mode = session.getGameMode();
    List<RpCalculator.RankEntry> ranked =
        RpCalculator.rankPlayers(
            totals, mode.getRpFactor(), mode.getUmaDist(session.getPlayerCount()));

    List<PlayerPerformanceDTO> results = new ArrayList<>();
    for (var entry : ranked) {
      results.add(
          PlayerPerformanceDTO.builder()
              .playerId(entry.playerId())
              .userName(names.get(entry.playerId()))
              .totalScore(entry.score())
              .rp(entry.rp())
              .rank(entry.rank())
              .build());
    }
    return results;
  }
}
