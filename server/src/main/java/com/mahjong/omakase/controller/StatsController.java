package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.FanDiscoveryResponse;
import com.mahjong.omakase.dto.PlayerStatsResponse;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.GameService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
    GameMode mode = RequestParsers.parseGameMode(gameMode);
    LocalDateTime[] range = RequestParsers.parseDateRange(year, month);
    return gameService.getPlayerStats(mode, range[0], range[1]);
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
    GameMode mode = RequestParsers.parseGameMode(gameMode);
    LocalDateTime[] range = RequestParsers.parseDateRange(year, month);
    return gameService.getBestRounds(mode, range[0], range[1]);
  }

  @GetMapping("/fan-discoveries")
  public List<FanDiscoveryResponse> getFanDiscoveries(
      @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
    LocalDateTime[] range = RequestParsers.parseDateRange(year, month);
    return gameService.getFanDiscoveries(range[0], range[1]);
  }
}
