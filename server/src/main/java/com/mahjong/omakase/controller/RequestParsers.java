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
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Invalid game mode: " + gameMode, e);
    }
  }

  /**
   * Parses optional year/month query parameters into a half-open date range {@code [start, end)}
   * suitable for "all sessions in this month" queries.
   *
   * <ul>
   *   <li>Both {@code null}: returns {@code {null, null}} → callers treat this as "no date filter"
   *       (all-time).
   *   <li>Both provided, with {@code 1 <= month <= 12}: returns {@code {start,
   *       start.plusMonths(1)}} where {@code start = LocalDateTime.of(year, month, 1, 0, 0)}. End
   *       is exclusive — the first instant of the following month.
   *   <li>Only one of the two provided, or {@code month} out of [1, 12]: throws {@link
   *       ResponseStatusException} with HTTP 400.
   * </ul>
   */
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
