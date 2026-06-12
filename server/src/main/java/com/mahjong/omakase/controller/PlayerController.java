package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.CreatePlayerRequest;
import com.mahjong.omakase.dto.PlayerDetailResponse;
import com.mahjong.omakase.dto.PlayerTierResponse;
import com.mahjong.omakase.dto.TierInfo;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import com.mahjong.omakase.service.GameService;
import com.mahjong.omakase.service.TierService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/players")
public class PlayerController {
  private final GameService gameService;
  private final TierService tierService;
  private final PlayerRepository playerRepo;

  public PlayerController(
      GameService gameService, TierService tierService, PlayerRepository playerRepo) {
    this.gameService = gameService;
    this.tierService = tierService;
    this.playerRepo = playerRepo;
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

  @GetMapping("/{id}/detail")
  public PlayerDetailResponse detail(@PathVariable Long id) {
    return gameService.getPlayerDetail(id);
  }

  /** Get tier + skill rating for a player in both ranked modes (国标 / 立直). */
  @GetMapping("/{id}/tier")
  public PlayerTierResponse tier(@PathVariable Long id) {
    Player p =
        playerRepo.findById(id).orElseThrow(() -> new NoSuchElementException("Player not found"));
    return PlayerTierResponse.builder()
        .playerId(p.getId())
        .userName(p.getUserName())
        .guobiao(TierInfo.of(tierService, p, GameMode.GUOBIAO))
        .riichi(TierInfo.of(tierService, p, GameMode.RIICHI))
        .build();
  }

  /** Bulk tier lookup for a list of player ids — used by 排行榜 / 计分板 / GameCard. */
  @GetMapping("/tier")
  public List<PlayerTierResponse> tiersBulk(@RequestParam List<Long> ids) {
    return playerRepo.findAllById(ids).stream()
        .map(
            p ->
                PlayerTierResponse.builder()
                    .playerId(p.getId())
                    .userName(p.getUserName())
                    .guobiao(TierInfo.of(tierService, p, GameMode.GUOBIAO))
                    .riichi(TierInfo.of(tierService, p, GameMode.RIICHI))
                    .build())
        .toList();
  }
}
