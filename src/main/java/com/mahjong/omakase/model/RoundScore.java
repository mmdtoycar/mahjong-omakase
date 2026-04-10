package com.mahjong.omakase.model;

import jakarta.persistence.*;

@Entity
@Table(name = "round_scores")
public class RoundScore {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "round_id", nullable = false)
  private Round round;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "player_id", nullable = false)
  private Player player;

  @Column(nullable = false)
  private int score;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Round getRound() {
    return round;
  }

  public void setRound(Round round) {
    this.round = round;
  }

  public Player getPlayer() {
    return player;
  }

  public void setPlayer(Player player) {
    this.player = player;
  }

  public int getScore() {
    return score;
  }

  public void setScore(int score) {
    this.score = score;
  }
}
