package com.mahjong.omakase.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "game_sessions")
@Getter
@Setter
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
  private LocalDateTime createdAt = LocalDateTime.now(ZoneOffset.UTC);

  @JsonIgnore
  @OneToMany(mappedBy = "gameSession", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<GameSessionPlayer> players = new ArrayList<>();

  @JsonIgnore
  @OneToMany(mappedBy = "gameSession", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("roundNumber ASC")
  private List<Round> rounds = new ArrayList<>();
}
