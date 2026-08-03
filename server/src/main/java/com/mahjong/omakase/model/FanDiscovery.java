package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "fan_discoveries_v2",
    uniqueConstraints = {@UniqueConstraint(columnNames = {"season", "fanName"})})
@Getter
@Setter
@NoArgsConstructor
public class FanDiscovery {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 50, nullable = false)
  private String fanName;

  @Column(length = 7, nullable = false)
  private String season; // format: YYYY-MM

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "player_id", nullable = false)
  private Player player;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "round_id", nullable = false)
  private Round round;

  @Column(columnDefinition = "TEXT")
  private String exampleHand;

  @Column(nullable = false)
  private LocalDateTime discoveredAt;

  public FanDiscovery(
      String fanName,
      String season,
      Player player,
      Round round,
      String exampleHand,
      LocalDateTime discoveredAt) {
    this.fanName = fanName;
    this.season = season;
    this.player = player;
    this.round = round;
    this.exampleHand = exampleHand;
    this.discoveredAt = discoveredAt;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    FanDiscovery that = (FanDiscovery) o;
    return Objects.equals(id, that.id);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id);
  }

  @Override
  public String toString() {
    return "FanDiscovery{"
        + "id="
        + id
        + ", fanName='"
        + fanName
        + '\''
        + ", season='"
        + season
        + '\''
        + '}';
  }
}
