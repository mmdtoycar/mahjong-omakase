package com.mahjong.omakase.controller;

import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.service.GameService;
import java.util.List;
import java.util.Map;
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

  public AdminController(GameService gameService) {
    this.gameService = gameService;
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
    Player updated = gameService.updatePlayer(id, body.get("firstName"), body.get("lastName"));
    log.info("Admin updated player id={}", id);
    return updated;
  }
}
