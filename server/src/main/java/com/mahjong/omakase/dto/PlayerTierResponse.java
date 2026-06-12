package com.mahjong.omakase.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Per-player tier summary covering both ranked modes (国标 / 立直). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerTierResponse {
  private Long playerId;
  private String userName;
  private TierInfo guobiao;
  private TierInfo riichi;
}
