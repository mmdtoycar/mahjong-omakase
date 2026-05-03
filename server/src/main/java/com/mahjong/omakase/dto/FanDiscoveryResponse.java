package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FanDiscoveryResponse {
  private String fanName;
  private Long playerId;
  private String playerName;
  private String exampleHand;
  private LocalDateTime discoveredAt;
  private Double bonusRp;
  private String season;
}
