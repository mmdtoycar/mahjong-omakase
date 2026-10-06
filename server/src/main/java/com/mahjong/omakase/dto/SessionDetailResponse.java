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

  @Getter
  @Setter
  @AllArgsConstructor
  public static class PlayerInfo {
    private Long id;
    private String userName;
    private Integer seat;
    private String tier;

    /** 段位战 position after this game (live while in progress), as in {@link TierInfo}. */
    private Integer stars;

    private Double points;
    private Integer starCap;
    private Integer douLevel;

    /** TIER_UP / STAR_UP / STAR_DOWN / TIER_DOWN at 结算; null if the level held. */
    private String ladderMove;

    public PlayerInfo(Long id, String userName, Integer seat) {
      this(id, userName, seat, null, null, null, null, null, null);
    }

    public void setLadder(TierInfo info) {
      tier = info.getTier();
      stars = info.getStars();
      points = info.getPoints();
      starCap = info.getStarCap();
      douLevel = info.getDouLevel();
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
