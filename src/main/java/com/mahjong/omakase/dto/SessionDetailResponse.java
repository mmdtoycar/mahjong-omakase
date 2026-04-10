package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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

  public static class PlayerInfo {
    private Long id;
    private String userName;
    private String firstName;
    private String lastName;

    public PlayerInfo(Long id, String userName, String firstName, String lastName) {
      this.id = id;
      this.userName = userName;
      this.firstName = firstName;
      this.lastName = lastName;
    }

    public Long getId() {
      return id;
    }

    public String getUserName() {
      return userName;
    }

    public String getFirstName() {
      return firstName;
    }

    public String getLastName() {
      return lastName;
    }

    public String getDisplayName() {
      return firstName + " " + lastName;
    }
  }

  public static class RoundInfo {
    private int roundNumber;
    private Map<Long, Integer> scores;

    public RoundInfo(int roundNumber, Map<Long, Integer> scores) {
      this.roundNumber = roundNumber;
      this.scores = scores;
    }

    public int getRoundNumber() {
      return roundNumber;
    }

    public Map<Long, Integer> getScores() {
      return scores;
    }
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getGameMode() {
    return gameMode;
  }

  public void setGameMode(String gameMode) {
    this.gameMode = gameMode;
  }

  public String getGameModeDisplayName() {
    return gameModeDisplayName;
  }

  public void setGameModeDisplayName(String gameModeDisplayName) {
    this.gameModeDisplayName = gameModeDisplayName;
  }

  public int getPlayerCount() {
    return playerCount;
  }

  public void setPlayerCount(int playerCount) {
    this.playerCount = playerCount;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public List<PlayerInfo> getPlayers() {
    return players;
  }

  public void setPlayers(List<PlayerInfo> players) {
    this.players = players;
  }

  public List<RoundInfo> getRounds() {
    return rounds;
  }

  public void setRounds(List<RoundInfo> rounds) {
    this.rounds = rounds;
  }

  public Map<Long, Integer> getTotalScores() {
    return totalScores;
  }

  public void setTotalScores(Map<Long, Integer> totalScores) {
    this.totalScores = totalScores;
  }
}
