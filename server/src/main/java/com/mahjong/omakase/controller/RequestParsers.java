package com.mahjong.omakase.controller;

import com.mahjong.omakase.model.GameMode;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Shared request-parameter parsing for stats-style endpoints (year/month range, optional GameMode).
 * Kept package-private so it stays a controller-layer helper.
 */
final class RequestParsers {
  private RequestParsers() {}

  static GameMode parseGameMode(String gameMode) {
    if (gameMode == null || gameMode.isEmpty()) return null;
    try {
      return GameMode.valueOf(gameMode);
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid game mode: " + gameMode);
    }
  }

  static LocalDateTime[] parseDateRange(Integer year, Integer month) {
    if (year == null && month == null) return new LocalDateTime[] {null, null};
    if (year == null || month == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Both year and month must be provided");
    }
    if (month < 1 || month > 12) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must be between 1 and 12");
    }
    LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
    return new LocalDateTime[] {start, start.plusMonths(1)};
  }
}
