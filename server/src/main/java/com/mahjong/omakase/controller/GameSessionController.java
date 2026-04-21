package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.*;
import com.mahjong.omakase.service.GameService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/sessions")
public class GameSessionController {
  private final GameService gameService;

  public GameSessionController(GameService gameService) {
    this.gameService = gameService;
  }

  @GetMapping
  public List<SessionSummaryResponse> list() {
    return gameService.getAllSessions().stream().map(SessionSummaryResponse::from).toList();
  }

  @PostMapping
  public SessionSummaryResponse create(@Valid @RequestBody CreateSessionRequest request) {
    return SessionSummaryResponse.from(gameService.createSession(request));
  }

  @GetMapping("/{id}")
  public SessionDetailResponse detail(@PathVariable Long id) {
    return gameService.getSessionDetail(id);
  }

  @PostMapping("/{id}/rounds")
  public void addRound(@PathVariable Long id, @Valid @RequestBody AddRoundRequest request) {
    gameService.addRound(id, request);
  }

  @DeleteMapping("/{id}/rounds/{roundNumber}")
  public void deleteRound(@PathVariable Long id, @PathVariable int roundNumber) {
    gameService.deleteRound(id, roundNumber);
  }

  @PutMapping("/{id}/complete")
  public void complete(@PathVariable Long id) {
    gameService.completeSession(id);
  }
}
