package com.mahjong.omakase.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Snapshot of a player's skill state at the END of a given Pacific calendar month, for the given
 * mode. Written by the monthly snapshot cron. Used to render historical tier on the players-stats
 * page.
 */
@Entity
@Table(
    name = "player_monthly_skill",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_player_mode_year_month",
            columnNames = {"player_id", "mode", "season_year", "season_month"}))
@Getter
@Setter
@NoArgsConstructor
public class PlayerMonthlySkill {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "player_id", nullable = false)
  private Player player;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private GameMode mode;

  @Column(name = "season_year", nullable = false)
  private int year;

  @Column(name = "season_month", nullable = false)
  private int month;

  /** The old ELO rating at end of month. */
  @Column(nullable = false)
  private double skillRating;

  /** Cumulative game count in this mode through the end of this month. */
  @Column(nullable = false)
  private int games;

  /** Games played by this player in this mode during this month only. */
  @Column(nullable = false)
  private int monthlyGames;

  /** All-time peak rating through the end of this month. */
  @Column(nullable = false)
  private double peakRating;

  /** Ladder level at month end; null before 段位战, whose tier comes from {@link #skillRating}. */
  @Column private Integer ladderLevel;

  /** Points or 魂珠 into that level at month end. */
  @Column private Double ladderPoints;
}
