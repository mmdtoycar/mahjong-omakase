package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.GameSession;
import java.time.LocalDateTime;

public class SessionSummaryResponse {
  private Long id;
  private String name;
  private String gameMode;
  private String gameModeDisplayName;
  private int playerCount;
  private String status;
  private LocalDateTime createdAt;

  public static SessionSummaryResponse from(GameSession session) {
    SessionSummaryResponse r = new SessionSummaryResponse();
    r.id = session.getId();
    r.name = session.getName();
    r.gameMode = session.getGameMode().name();
    r.gameModeDisplayName = session.getGameMode().getDisplayName();
    r.playerCount = session.getPlayerCount();
    r.status = session.getStatus().name();
    r.createdAt = session.getCreatedAt();
    return r;
  }

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getGameMode() {
    return gameMode;
  }

  public String getGameModeDisplayName() {
    return gameModeDisplayName;
  }

  public int getPlayerCount() {
    return playerCount;
  }

  public String getStatus() {
    return status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }
}
