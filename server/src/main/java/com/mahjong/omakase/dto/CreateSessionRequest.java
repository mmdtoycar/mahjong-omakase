package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Data;

@Data
public class CreateSessionRequest {
  @Size(max = 100, message = "Session name must be at most 100 characters")
  private String name;

  @NotBlank(message = "Game mode is required")
  private String gameMode;

  @NotEmpty(message = "At least one player is required")
  @Size(min = 3, max = 4, message = "Game requires 3 or 4 players")
  private List<Long> playerIds;
}
