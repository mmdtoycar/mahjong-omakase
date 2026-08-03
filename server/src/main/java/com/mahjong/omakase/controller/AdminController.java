package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.SessionSummaryResponse;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.service.AdminAuthService;
import com.mahjong.omakase.service.GameService;
import com.mahjong.omakase.service.TierService;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestController
@RequestMapping("/api/admin")
public class AdminController {

  private final GameService gameService;
  private final TierService tierService;
  private final AdminAuthService adminAuth;

  public AdminController(
      GameService gameService, TierService tierService, AdminAuthService adminAuth) {
    this.gameService = gameService;
    this.tierService = tierService;
    this.adminAuth = adminAuth;
  }

  /**
   * Resolve and authorize the caller. Rejects with 403 unless the Authorization header carries a
   * valid Bearer token whose Player.email is in the admin whitelist (see {@link AdminAuthService}).
   */
  private void requireAdmin(String authHeader) {
    if (adminAuth.resolveAdmin(authHeader).isEmpty()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin authorization required");
    }
  }

  @GetMapping("/players")
  public List<Player> listPlayers(
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    requireAdmin(authHeader);
    return gameService.getAllPlayers();
  }

  @DeleteMapping("/players/{id}")
  public Map<String, String> deletePlayer(
      @PathVariable Long id,
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    requireAdmin(authHeader);
    gameService.deletePlayer(id);
    log.info("Admin deleted player id={}", id);
    return Map.of("message", "Player deleted");
  }

  @PutMapping("/players/{id}")
  public Player updatePlayer(
      @PathVariable Long id,
      @RequestHeader(value = "Authorization", required = false) String authHeader,
      @RequestBody Map<String, String> body) {
    requireAdmin(authHeader);
    Player updated =
        gameService.updatePlayer(
            id, body.get("userName"), body.get("firstName"), body.get("lastName"));
    log.info("Admin updated player id={}", id);
    return updated;
  }

  @GetMapping("/sessions")
  public List<SessionSummaryResponse> listSessions(
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    requireAdmin(authHeader);
    return gameService.getAllSessionSummaries().stream()
        .filter(s -> "COMPLETED".equals(s.getStatus()))
        .toList();
  }

  @DeleteMapping("/sessions/{id}")
  public Map<String, String> deleteSession(
      @PathVariable Long id,
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    requireAdmin(authHeader);
    gameService.deleteSession(id);
    log.info("Admin deleted session id={}", id);
    return Map.of("message", "Session deleted");
  }

  /**
   * Skill rating backfill: replays every completed session in chronological order to seed current
   * ELO ratings for all players. After the first deploy + curl invocation succeeds, incremental
   * updates happen automatically in {@link com.mahjong.omakase.service.GameService#completeSession}
   * and the monthly cron handles the soft reset. This endpoint then has no reason to exist.
   */
  @PostMapping("/tier/backfill")
  public Map<String, Object> backfillTier(
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    requireAdmin(authHeader);
    TierService.BackfillResult r = tierService.backfillAllHistory();
    gameService.evictAllCaches();
    log.info("Admin triggered tier backfill: processed={} skipped={}", r.processed(), r.skipped());
    return Map.of("processed", r.processed(), "skipped", r.skipped());
  }
}
