package com.mahjong.omakase.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FanDiscoveryResponse {
    private String fanName;
    private Long playerId;
    private String playerName;
    private String exampleHand;
    private LocalDateTime discoveredAt;
}
