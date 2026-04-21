package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import java.util.List;

public class PlayerDetailResponse {
  private Long playerId;
  private String userName;
  private String firstName;
  private String lastName;
  private List<GameEntry> games;

  public static class GameEntry {
    private Long sessionId;
    private String sessionName;
    private String gameMode;
    private String gameModeDisplayName;
    private String status;
    private LocalDateTime createdAt;
    private int totalScore;

    public Long getSessionId() {
      return sessionId;
    }

    public void setSessionId(Long sessionId) {
      this.sessionId = sessionId;
    }

    public String getSessionName() {
      return sessionName;
    }

    public void setSessionName(String sessionName) {
      this.sessionName = sessionName;
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

    public int getTotalScore() {
      return totalScore;
    }

    public void setTotalScore(int totalScore) {
      this.totalScore = totalScore;
    }
  }

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

  public String getFirstName() {
    return firstName;
  }

  public void setFirstName(String firstName) {
    this.firstName = firstName;
  }

  public String getLastName() {
    return lastName;
  }

  public void setLastName(String lastName) {
    this.lastName = lastName;
  }

  public List<GameEntry> getGames() {
    return games;
  }

  public void setGames(List<GameEntry> games) {
    this.games = games;
  }
}
