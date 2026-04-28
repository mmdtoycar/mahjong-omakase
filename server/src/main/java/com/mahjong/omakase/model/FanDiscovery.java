package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "fan_discoveries")
@Data
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

  public FanDiscovery(String fanName, Player player, Round round, String exampleHand) {
    this.fanName = fanName;
    this.player = player;
    this.round = round;
    this.exampleHand = exampleHand;
    this.discoveredAt = LocalDateTime.now();
  }
}
