package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "rounds")
@Getter
@Setter
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

  @OneToMany(mappedBy = "round", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<FanDiscovery> discoveries = new ArrayList<>();

  private Long winnerId;

  @Column(columnDefinition = "TEXT")
  private String winHand;

  @Column(columnDefinition = "TEXT")
  private String fanDetails;

  private Integer fanCount;

  private Long dealInPlayerId;
  private Integer prevalentWind;

  @Column(columnDefinition = "TEXT")
  private String riichiPlayerIds;

  @Column(columnDefinition = "TEXT")
  private String tenpaiPlayerIds;

  private Boolean backfill;
}
