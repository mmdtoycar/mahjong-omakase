package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.SessionSummaryResponse;
import com.mahjong.omakase.model.AppSetting;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.AppSettingRepository;
import com.mahjong.omakase.service.GameService;
import com.mahjong.omakase.service.TierService;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestController
@RequestMapping("/api/admin")
public class AdminController {

  @Value("${ADMIN_PASSWORD:}")
  private String adminPassword;

  private final GameService gameService;
  private final AppSettingRepository appSettingRepo;
  private final TierService tierService;

  public AdminController(
      GameService gameService, AppSettingRepository appSettingRepo, TierService tierService) {
    this.gameService = gameService;
    this.appSettingRepo = appSettingRepo;
    this.tierService = tierService;
  }

  private void checkPassword(String password) {
    if (adminPassword == null || adminPassword.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin not configured");
    }
    if (password == null || !adminPassword.equals(password)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid password");
    }
  }

  @PostMapping("/login")
  public Map<String, Boolean> login(@RequestBody Map<String, String> body) {
    checkPassword(body != null ? body.get("password") : null);
    return Map.of("success", true);
  }

  @GetMapping("/players")
  public List<Player> listPlayers(@RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    return gameService.getAllPlayers();
  }

  @DeleteMapping("/players/{id}")
  public Map<String, String> deletePlayer(
      @PathVariable Long id, @RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    gameService.deletePlayer(id);
    log.info("Admin deleted player id={}", id);
    return Map.of("message", "Player deleted");
  }

  @PutMapping("/players/{id}")
  public Player updatePlayer(
      @PathVariable Long id,
      @RequestHeader("X-Admin-Password") String password,
      @RequestBody Map<String, String> body) {
    checkPassword(password);
    Player updated =
        gameService.updatePlayer(
            id, body.get("userName"), body.get("firstName"), body.get("lastName"));
    log.info("Admin updated player id={}", id);
    return updated;
  }

  @GetMapping("/sessions")
  public List<SessionSummaryResponse> listSessions(
      @RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    return gameService.getAllSessionSummaries().stream()
        .filter(s -> "COMPLETED".equals(s.getStatus()))
        .toList();
  }

  @DeleteMapping("/sessions/{id}")
  public Map<String, String> deleteSession(
      @PathVariable Long id, @RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    gameService.deleteSession(id);
    log.info("Admin deleted session id={}", id);
    return Map.of("message", "Session deleted");
  }

  @GetMapping("/settings")
  public Map<String, String> getSettings(@RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    return appSettingRepo.findAll().stream()
        .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
  }

  private static final Map<String, Predicate<String>> SETTING_VALIDATORS =
      Map.of(
          "participation_bonus",
          v -> {
            try {
              double d = Double.parseDouble(v);
              return d >= 0;
            } catch (NumberFormatException e) {
              return false;
            }
          });

  @PutMapping("/settings")
  public Map<String, String> updateSettings(
      @RequestHeader("X-Admin-Password") String password, @RequestBody Map<String, String> body) {
    checkPassword(password);
    body.forEach(
        (key, value) -> {
          var validator = SETTING_VALIDATORS.get(key);
          if (validator != null && !validator.test(value)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Invalid value for setting: " + key);
          }
          AppSetting setting =
              appSettingRepo
                  .findById(Objects.requireNonNull(key))
                  .orElse(new AppSetting(key, value));
          setting.setValue(value);
          appSettingRepo.save(setting);
        });
    log.info("Admin updated settings: {}", body.keySet());
    gameService.reloadSettings();
    return body;
  }

  /**
   * Skill rating backfill: replays every completed session in chronological order to seed current
   * ELO ratings for all players. After the first deploy + curl invocation succeeds, incremental
   * updates happen automatically in {@link com.mahjong.omakase.service.GameService#completeSession}
   * and the monthly cron handles the soft reset. This endpoint then has no reason to exist.
   */
  @PostMapping("/tier/backfill")
  public Map<String, Object> backfillTier(@RequestHeader("X-Admin-Password") String password) {
    checkPassword(password);
    TierService.BackfillResult r = tierService.backfillAllHistory();
    gameService.evictAllCaches();
    log.info("Admin triggered tier backfill: processed={} skipped={}", r.processed(), r.skipped());
    return Map.of("processed", r.processed(), "skipped", r.skipped());
  }
}
