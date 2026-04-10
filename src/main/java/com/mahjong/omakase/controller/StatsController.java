package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.PlayerStatsResponse;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.GameService;
import java.util.List;
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
  public List<PlayerStatsResponse> getStats(@RequestParam(required = false) String gameMode) {
    GameMode mode = null;
    if (gameMode != null && !gameMode.isEmpty()) {
      mode = GameMode.valueOf(gameMode);
    }
    return gameService.getPlayerStats(mode);
  }
}
