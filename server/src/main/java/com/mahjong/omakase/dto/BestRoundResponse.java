package com.mahjong.omakase.dto;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
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
}
