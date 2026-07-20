package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlayerDetailResponse {
  private Long playerId;
  private String userName;
  private String firstName;
  private String lastName;
  private List<GameEntry> games;

  /** Per-mode round-level metrics (和牌率/放铳率/平均打点/平均铳点), keyed by GameMode name. */
  private Map<String, ModeStats> statsByMode;

  @Getter
  @Setter
  public static class GameEntry {
    private Long sessionId;
    private String sessionName;
    private String gameMode;
    private String gameModeDisplayName;
    private String status;
    private LocalDateTime createdAt;
    private int totalScore;
  }

  @Getter
  @Setter
  public static class ModeStats {
    private int roundsPlayed;
    private int handWins;
    private int tsumoWins;
    private int dealIns;
    private double avgWinPoints;
    private double avgDealInPoints;
  }
}
