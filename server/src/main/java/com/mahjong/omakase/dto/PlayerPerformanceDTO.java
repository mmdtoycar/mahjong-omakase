package com.mahjong.omakase.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerPerformanceDTO {
  private String userName;
  private Integer totalScore;
  private Double rp;
  private Integer rank;
}
