package com.mahjong.omakase.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlayerDetailResponse {
  private Long playerId;
  private String userName;
  private String firstName;
  private String lastName;
  private List<GameEntry> games;

  @Getter
  @Setter
  public static class GameEntry {
    private Long sessionId;
    private String sessionName;
    private String gameMode;
    private String gameModeDisplayName;
    private String status;
    private LocalDateTime createdAt;
    private int totalScore;
  }
}
