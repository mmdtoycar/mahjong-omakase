package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rounds")
public class Round {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "game_session_id", nullable = false)
  private GameSession gameSession;

  @Column(nullable = false)
  private int roundNumber;

  @OneToMany(mappedBy = "round", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<RoundScore> scores = new ArrayList<>();

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public GameSession getGameSession() {
    return gameSession;
  }

  public void setGameSession(GameSession gameSession) {
    this.gameSession = gameSession;
  }

  public int getRoundNumber() {
    return roundNumber;
  }

  public void setRoundNumber(int roundNumber) {
    this.roundNumber = roundNumber;
  }

  public List<RoundScore> getScores() {
    return scores;
  }

  public void setScores(List<RoundScore> scores) {
    this.scores = scores;
  }
}
