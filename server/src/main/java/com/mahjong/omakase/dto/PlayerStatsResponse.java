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

  /** 段位战 stars, points into the star and the star's cap. Null for months before 段位战. */
  private Integer stars;

  private Double ladderPoints;
  private Integer starCap;

  /** 斗战圣佛 Lv.1 and up, 0 below it. Null for months before 段位战. */
  private Integer douLevel;
}
