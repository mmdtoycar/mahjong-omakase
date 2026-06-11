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
