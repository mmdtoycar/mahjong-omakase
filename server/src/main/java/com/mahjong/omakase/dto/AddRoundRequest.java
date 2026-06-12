package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.RoundType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.util.List;
import lombok.Data;

@Data
public class AddRoundRequest {
  private String roundType; // "WIN" (default) or "DRAWN_GAME"

  private Long winnerId;

  @Positive(message = "Score must be positive")
  private Integer score;

  @Min(value = 0, message = "Fan must be non-negative")
  private Integer fan;

  @Min(value = 20, message = "Fu must be at least 20")
  private Integer fu;

  private Long dealerId;

  @Min(value = 0, message = "Honba must be non-negative")
  private Integer honba;

  @Min(value = 0, message = "Kyoutaku must be non-negative")
  private Integer kyoutaku;

  private Long dealInPlayerId;

  private List<Long> bimenPlayerIds;

  private List<Long> tenpaiPlayerIds; // for drawn games

  private List<Long> riichiPlayerIds; // players who declared riichi

  private Boolean backfill;

  private String winHand;

  private String fanDetails;

  @Min(value = 0, message = "Fan count must be non-negative")
  private Integer fanCount;

  @Min(value = 1, message = "Prevalent wind must be between 1 and 4")
  @Max(value = 4, message = "Prevalent wind must be between 1 and 4")
  private Integer prevalentWind;

  private Boolean chombo;

  public RoundType getParsedRoundType() {
    return RoundType.fromString(roundType);
  }

  public boolean isDrawnGame() {
    return getParsedRoundType() == RoundType.DRAWN_GAME;
  }

  public boolean isSelfDraw() {
    return dealInPlayerId == null;
  }
}
