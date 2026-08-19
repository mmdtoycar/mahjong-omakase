package com.mahjong.omakase.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlayerStatsResponse {
  private Long playerId;
  private String userName;
  private int gamesPlayed;
  private int totalScore;
  private double avgRank;
  private int wins;
  private int fourthPlaces;
  private int roundsPlayed;
  private int handWins;
  private int tsumoWins;
  private int dealIns;
  private double avgWinPoints;
  private double avgDealInPoints;
  private int riichiWins;
  private int meldWins;
  private int recordedHandWins;
  private String tier;
  private double skillRating;
  private int gamesNeeded;
}
