package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.SessionSummaryResponse;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.service.AdminAuthService;
import com.mahjong.omakase.service.GameService;
import com.mahjong.omakase.service.RecomputeService;
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
  private final RecomputeService recomputeService;
  private final AdminAuthService adminAuth;

  public AdminController(
      GameService gameService, RecomputeService recomputeService, AdminAuthService adminAuth) {
    this.gameService = gameService;
    this.recomputeService = recomputeService;
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
   * Replays completed sessions into the ladder; optionally re-scores stale rounds, or only
   * previews.
   */
  @PostMapping("/tier/backfill")
  public RecomputeService.Report backfillTier(
      @RequestHeader(value = "Authorization", required = false) String authHeader,
      @RequestParam(defaultValue = "false") boolean recomputeRounds,
      @RequestParam(defaultValue = "false") boolean dryRun,
      @RequestParam(required = false) List<Long> sessionIds) {
    requireAdmin(authHeader);
    RecomputeService.Report r = recomputeService.run(recomputeRounds, dryRun, sessionIds);
    if (!dryRun) gameService.evictAllCaches();
    log.info(
        "Admin backfill: recomputeRounds={} dryRun={} processed={} skipped={} roundsFixed={}",
        recomputeRounds,
        dryRun,
        r.processed(),
        r.skipped(),
        r.rounds().size());
    return r;
  }
}
