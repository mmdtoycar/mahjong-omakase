package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.HomeSummaryResponse;
import com.mahjong.omakase.service.GameService;
import java.time.LocalDateTime;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/home-summary")
public class HomeSummaryController {

  private final GameService gameService;

  public HomeSummaryController(GameService gameService) {
    this.gameService = gameService;
  }

  @GetMapping
  public HomeSummaryResponse getHomeSummary(
      @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
    LocalDateTime[] range = RequestParsers.parseDateRange(year, month);
    return gameService.getHomeSummary(range[0], range[1]);
  }
}
