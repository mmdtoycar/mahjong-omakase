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
  private double rpFactor;
  private double rpOrigin;
  private double[] umaDist;
  private Double participationBonus;

  public static class PlayerInfo {
    private Long id;
    private String userName;
    private String firstName;
    private String lastName;
    private Integer seat;

    public PlayerInfo(Long id, String userName, String firstName, String lastName, Integer seat) {
      this.id = id;
      this.userName = userName;
      this.firstName = firstName;
      this.lastName = lastName;
      this.seat = seat;
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

    public Integer getSeat() {
      return seat;
    }
  }

  public static class RoundInfo {
    private int roundNumber;
    private Map<Long, Integer> scores;
    private Long winnerId;
    private String winHand;
    private String fanDetails;
    private Integer fanCount;
    private Long dealInPlayerId;
    private String dealInPlayerName;

    public RoundInfo(
        int roundNumber,
        Map<Long, Integer> scores,
        Long winnerId,
        String winHand,
        String fanDetails,
        Integer fanCount,
        Long dealInPlayerId,
        String dealInPlayerName) {
      this.roundNumber = roundNumber;
      this.scores = scores;
      this.winnerId = winnerId;
      this.winHand = winHand;
      this.fanDetails = fanDetails;
      this.fanCount = fanCount;
      this.dealInPlayerId = dealInPlayerId;
      this.dealInPlayerName = dealInPlayerName;
    }

    public int getRoundNumber() {
      return roundNumber;
    }

    public Map<Long, Integer> getScores() {
      return scores;
    }

    public Long getWinnerId() {
      return winnerId;
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

    public Long getDealInPlayerId() {
      return dealInPlayerId;
    }

    public String getDealInPlayerName() {
      return dealInPlayerName;
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

  public double getRpFactor() {
    return rpFactor;
  }

  public void setRpFactor(double rpFactor) {
    this.rpFactor = rpFactor;
  }

  public double getRpOrigin() {
    return rpOrigin;
  }

  public void setRpOrigin(double rpOrigin) {
    this.rpOrigin = rpOrigin;
  }

  public double[] getUmaDist() {
    return umaDist;
  }

  public void setUmaDist(double[] umaDist) {
    this.umaDist = umaDist;
  }

  public Double getParticipationBonus() {
    return participationBonus;
  }

  public void setParticipationBonus(Double participationBonus) {
    this.participationBonus = participationBonus;
  }
}
