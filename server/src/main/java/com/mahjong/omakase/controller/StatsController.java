package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.PlayerStatsResponse;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.GameService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestController
@RequestMapping("/api/stats")
public class StatsController {
  private final GameService gameService;

  public StatsController(GameService gameService) {
    this.gameService = gameService;
  }

  @GetMapping
  public List<PlayerStatsResponse> getStats(
      @RequestParam(required = false) String gameMode,
      @RequestParam(required = false) Integer year,
      @RequestParam(required = false) Integer month) {
    GameMode mode = null;
    if (gameMode != null && !gameMode.isEmpty()) {
      try {
        mode = GameMode.valueOf(gameMode);
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid game mode: " + gameMode);
      }
    }

    LocalDateTime start = null;
    LocalDateTime end = null;
    if (year != null || month != null) {
      if (year == null || month == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Both year and month must be provided");
      }
      if (month < 1 || month > 12) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must be between 1 and 12");
      }
      start = LocalDateTime.of(year, month, 1, 0, 0);
      end = start.plusMonths(1);
    }

    return gameService.getPlayerStats(mode, start, end);
  }

  @GetMapping("/seasons")
  public List<Map<String, Integer>> getActiveSeasons() {
    return gameService.getActiveSeasons();
  }

  @GetMapping("/best-rounds")
  public List<com.mahjong.omakase.dto.BestRoundResponse> getBestRounds(
      @RequestParam(required = false) String gameMode,
      @RequestParam(required = false) Integer year,
      @RequestParam(required = false) Integer month) {
    GameMode mode = null;
    if (gameMode != null && !gameMode.isEmpty()) {
      try {
        mode = GameMode.valueOf(gameMode);
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid game mode: " + gameMode);
      }
    }

    LocalDateTime start = null;
    LocalDateTime end = null;
    if (year != null || month != null) {
      if (year == null || month == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Both year and month must be provided");
      }
      if (month < 1 || month > 12) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must be between 1 and 12");
      }
      start = LocalDateTime.of(year, month, 1, 0, 0);
      end = start.plusMonths(1);
    }
    return gameService.getBestRounds(mode, start, end);
  }
}
