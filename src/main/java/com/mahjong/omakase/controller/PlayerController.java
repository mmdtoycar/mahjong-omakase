package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.CreatePlayerRequest;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.service.GameService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/players")
public class PlayerController {
  private final GameService gameService;

  public PlayerController(GameService gameService) {
    this.gameService = gameService;
  }

  @GetMapping
  public List<Player> list() {
    return gameService.getAllPlayers();
  }

  @PostMapping
  public Player create(@Valid @RequestBody CreatePlayerRequest request) {
    return gameService.createPlayer(request);
  }

  @GetMapping("/check-username")
  public Map<String, Boolean> checkUserName(@RequestParam String userName) {
    return Map.of("available", !gameService.isUserNameTaken(userName));
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id) {
    gameService.deletePlayer(id);
  }
}
