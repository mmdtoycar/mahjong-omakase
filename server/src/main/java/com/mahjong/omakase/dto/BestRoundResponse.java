package com.mahjong.omakase.dto;

import java.util.Map;

public class BestRoundResponse {
  private Long sessionId;
  private int roundNumber;
  private Long winnerId;
  private String winnerName;
  private String winHand;
  private String fanDetails;
  private Integer fanCount;
  private Map<Long, Integer> scores;
  private Long dealInPlayerId;
  private String dealInPlayerName;

  public BestRoundResponse(
      Long sessionId,
      int roundNumber,
      Long winnerId,
      String winnerName,
      String winHand,
      String fanDetails,
      Integer fanCount,
      Map<Long, Integer> scores,
      Long dealInPlayerId,
      String dealInPlayerName) {
    this.sessionId = sessionId;
    this.roundNumber = roundNumber;
    this.winnerId = winnerId;
    this.winnerName = winnerName;
    this.winHand = winHand;
    this.fanDetails = fanDetails;
    this.fanCount = fanCount;
    this.scores = scores;
    this.dealInPlayerId = dealInPlayerId;
    this.dealInPlayerName = dealInPlayerName;
  }

  // Getters
  public Long getSessionId() {
    return sessionId;
  }

  public int getRoundNumber() {
    return roundNumber;
  }

  public Long getWinnerId() {
    return winnerId;
  }

  public String getWinnerName() {
    return winnerName;
  }

  public String getWinHand() {
    return winHand;
  }

  public String getFanDetails() {
    return fanDetails;
  }

  public Integer getFanCount() {
    return fanCount;
  }

  public Map<Long, Integer> getScores() {
    return scores;
  }

  public Long getDealInPlayerId() {
    return dealInPlayerId;
  }

  public String getDealInPlayerName() {
    return dealInPlayerName;
  }
}
