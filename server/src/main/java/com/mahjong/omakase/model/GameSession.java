package com.mahjong.omakase.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "game_sessions")
public class GameSession {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String name;

  @Column(nullable = false)
  private int playerCount;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SessionStatus status = SessionStatus.IN_PROGRESS;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private GameMode gameMode;

  @Column(nullable = false)
  private LocalDateTime createdAt = LocalDateTime.now();

  @JsonIgnore
  @OneToMany(mappedBy = "gameSession", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<GameSessionPlayer> players = new ArrayList<>();

  @JsonIgnore
  @OneToMany(mappedBy = "gameSession", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("roundNumber ASC")
  private List<Round> rounds = new ArrayList<>();

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

  public int getPlayerCount() {
    return playerCount;
  }

  public void setPlayerCount(int playerCount) {
    this.playerCount = playerCount;
  }

  public SessionStatus getStatus() {
    return status;
  }

  public void setStatus(SessionStatus status) {
    this.status = status;
  }

  public GameMode getGameMode() {
    return gameMode;
  }

  public void setGameMode(GameMode gameMode) {
    this.gameMode = gameMode;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public List<GameSessionPlayer> getPlayers() {
    return players;
  }

  public void setPlayers(List<GameSessionPlayer> players) {
    this.players = players;
  }

  public List<Round> getRounds() {
    return rounds;
  }

  public void setRounds(List<Round> rounds) {
    this.rounds = rounds;
  }
}
