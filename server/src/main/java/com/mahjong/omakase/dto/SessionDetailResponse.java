package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SessionDetailResponse {
  private Long id;
  private String name;
  private String gameMode;
  private String gameModeDisplayName;
  private int playerCount;
  private String status;
  private LocalDateTime createdAt;
  private List<PlayerInfo> players;
  private List<RoundInfo> rounds;
  private Map<Long, Integer> totalScores;
  private double startingPoints;

  /** 每位玩家本场对局的段位分变化. Empty while the session is in progress. */
  private Map<Long, Double> ratingDeltas = Collections.emptyMap();

  private String tableStrength;

  @Getter
  @Setter
  @AllArgsConstructor
  public static class PlayerInfo {
    private Long id;
    private String userName;
    private Integer seat;
    private String tier;

    public PlayerInfo(Long id, String userName, Integer seat) {
      this(id, userName, seat, null);
    }
  }

  @Getter
  @AllArgsConstructor
  public static class RoundInfo {
    private int roundNumber;
    private Map<Long, Integer> scores;
    private Long winnerId;
    private String winHand;
    private String fanDetails;
    private Integer fanCount;
    private Long dealInPlayerId;
    private String dealInPlayerName;
    private Integer prevalentWind;
    private List<Long> riichiPlayerIds;
    private List<Long> tenpaiPlayerIds;
  }
}
