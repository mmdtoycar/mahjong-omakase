package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "fan_discoveries")
@Getter
@Setter
@NoArgsConstructor
public class FanDiscovery {
  @Id
  @Column(length = 50)
  private String fanName;

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
      String fanName, Player player, Round round, String exampleHand, LocalDateTime discoveredAt) {
    this.fanName = fanName;
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
    return Objects.equals(fanName, that.fanName);
  }

  @Override
  public int hashCode() {
    return Objects.hash(fanName);
  }

  @Override
  public String toString() {
    return "FanDiscovery{" + "fanName='" + fanName + '\'' + '}';
  }
}
