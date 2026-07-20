package com.mahjong.omakase.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlayerStatsResponse {
  private Long playerId;
  private String userName;
  private String displayName;
  private int gamesPlayed;
  private int totalScore;
  private double avgScore;
  private double avgRank;
  private int wins;
  private double totalRP;
  private double baseRP;
  private double tieredBonus;
  private double adminBonus;
  private double fanDiscoveryBonus;
  private int roundsPlayed;
  private int handWins;
  private int tsumoWins;
  private int dealIns;
  private double avgWinPoints;
  private double avgDealInPoints;
  private String tier;
  private double skillRating;
  private int gamesNeeded;
}
