package com.mahjong.omakase.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
    name = "game_session_players",
    uniqueConstraints = @UniqueConstraint(columnNames = {"game_session_id", "seat"}))
@Getter
@Setter
public class GameSessionPlayer {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @JsonIgnore
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "game_session_id", nullable = false)
  private GameSession gameSession;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "player_id")
  private Player player;

  @Column(name = "seat")
  private Integer seat;

  /**
   * 本场对局结束后段位分的变化量. Written by {@link com.mahjong.omakase.service.TierService#onSessionCompleted}.
   * Null for sessions that are still in progress, or completed sessions from before this column
   * existed (run the tier backfill to fill those in).
   */
  @Column private Double ratingDelta;

  /** 本场对局结束后的段位分. Null under the same conditions as {@link #ratingDelta}. */
  @Column private Double ratingAfter;
}
