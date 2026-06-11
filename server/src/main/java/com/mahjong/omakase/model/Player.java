package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "players")
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

  /**
   * Hibernate optimistic-lock version. Guards setupProfile / claim flows: if two concurrent
   * transactions race to bind a Google account to the same legacy Player, only the first commit
   * succeeds; the second one's UPDATE checks {@code version = ?} mismatches and Hibernate throws an
   * {@link jakarta.persistence.OptimisticLockException}, which Spring surfaces as a 409/500.
   */
  @Version private Long version;

  public Player() {}

  public Player(String userName, String firstName, String lastName) {
    this.userName = userName;
    this.firstName = firstName;
    this.lastName = lastName;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getUserName() {
    return userName;
  }

  public void setUserName(String userName) {
    this.userName = userName;
  }

  public String getFirstName() {
    return firstName;
  }

  public void setFirstName(String firstName) {
    this.firstName = firstName;
  }

  public String getLastName() {
    return lastName;
  }

  public void setLastName(String lastName) {
    this.lastName = lastName;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public String getDisplayName() {
    return firstName + " " + lastName;
  }

  public boolean isBot() {
    return bot || (this.userName != null && this.userName.equalsIgnoreCase("BOT"));
  }

  public void setBot(boolean bot) {
    this.bot = bot;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPictureUrl() {
    return pictureUrl;
  }

  public void setPictureUrl(String pictureUrl) {
    this.pictureUrl = pictureUrl;
  }

  @Column(nullable = false, columnDefinition = "boolean default false")
  private boolean merged = false;

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }

  public boolean isMerged() {
    return merged;
  }

  public void setMerged(boolean merged) {
    this.merged = merged;
  }
}
