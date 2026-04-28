package com.mahjong.omakase.dto;

public class PlayerStatsResponse {
  private Long playerId;
  private String userName;
  private String displayName;
  private int gamesPlayed;
  private int totalScore;
  private double avgScore;
  private int wins;
  private double totalRP;
  private double baseRP;

  public Long getPlayerId() {
    return playerId;
  }

  public void setPlayerId(Long playerId) {
    this.playerId = playerId;
  }

  public String getUserName() {
    return userName;
  }

  public void setUserName(String userName) {
    this.userName = userName;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public int getGamesPlayed() {
    return gamesPlayed;
  }

  public void setGamesPlayed(int gamesPlayed) {
    this.gamesPlayed = gamesPlayed;
  }

  public int getTotalScore() {
    return totalScore;
  }

  public void setTotalScore(int totalScore) {
    this.totalScore = totalScore;
  }

  public double getAvgScore() {
    return avgScore;
  }

  public void setAvgScore(double avgScore) {
    this.avgScore = avgScore;
  }

  public int getWins() {
    return wins;
  }

  public void setWins(int wins) {
    this.wins = wins;
  }

  public double getTotalRP() {
    return totalRP;
  }

  public void setTotalRP(double totalRP) {
    this.totalRP = totalRP;
  }

  public double getBaseRP() {
    return baseRP;
  }

  public void setBaseRP(double baseRP) {
    this.baseRP = baseRP;
  }
}
