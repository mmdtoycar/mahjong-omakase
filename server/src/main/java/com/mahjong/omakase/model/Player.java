package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "players")
@Getter
@Setter
@NoArgsConstructor
public class Player {

  /**
   * The one place this bound is written down. Every table on the site sizes its name column against
   * it — a longer name wraps and pushes the statistic columns out of their cells on a phone.
   */
  public static final int MAX_USERNAME_LENGTH = 12;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String userName;

  @Column(nullable = false)
  private String firstName;

  @Column(nullable = false)
  private String lastName;

  @Column(nullable = false)
  private LocalDateTime createdAt = LocalDateTime.now();

  @Column(nullable = false, columnDefinition = "boolean default false")
  private boolean bot = false;

  @Column(unique = true)
  private String email;

  @Column(length = 1024)
  private String pictureUrl;

  @Column(unique = true)
  private String token;

  @Column(nullable = false, columnDefinition = "boolean default false")
  private boolean merged = false;

  // ===== Hidden skill rating (per mode) =====
  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double skillGuobiao = 1500.0;

  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double skillRiichi = 1500.0;

  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double skillDongbei = 1500.0;

  @Column(nullable = false, columnDefinition = "int default 0")
  private int gamesGuobiao = 0;

  @Column(nullable = false, columnDefinition = "int default 0")
  private int gamesRiichi = 0;

  @Column(nullable = false, columnDefinition = "int default 0")
  private int gamesDongbei = 0;

  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double peakSkillGuobiao = 1500.0;

  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double peakSkillRiichi = 1500.0;

  @Column(nullable = false, columnDefinition = "double default 1500.0")
  private double peakSkillDongbei = 1500.0;

  public Player(String userName, String firstName, String lastName) {
    this.userName = userName;
    this.firstName = firstName;
    this.lastName = lastName;
  }

  public String getDisplayName() {
    return firstName + " " + lastName;
  }

  public boolean isBot() {
    return bot || "BOT".equalsIgnoreCase(this.userName);
  }

  public boolean isHuman() {
    return !isBot();
  }
}
