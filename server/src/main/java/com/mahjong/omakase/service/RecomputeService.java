package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

/** Admin recompute: fix mis-scored rounds, replay the ladder, and say what changed. */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class RecomputeService {

  public record Placement(String player, int total) {}

  public record SessionImpact(
      long sessionId,
      String status,
      List<Placement> before,
      List<Placement> after,
      boolean placementChanged) {}

  public record PlayerImpact(
      String player,
      String mode,
      String ladderBefore,
      String ladderAfter,
      int gamesBefore,
      int gamesAfter) {}

  public record Report(
      boolean dryRun,
      int processed,
      int skipped,
      List<RoundRecomputer.Change> rounds,
      List<RoundRecomputer.Unresolved> unresolved,
      List<SessionImpact> sessions,
      List<PlayerImpact> players) {}

  private final GameSessionRepository sessionRepo;
  private final PlayerRepository playerRepo;
  private final TierService tierService;
  private final RoundRecomputer roundRecomputer;

  /**
   * With {@code dryRun} nothing is kept: the same work runs and is rolled back. {@code sessionIds}
   * limits which sessions have their rounds re-scored; the ladder replay always covers everything.
   */
  public Report run(boolean recomputeRounds, boolean dryRun, Collection<Long> sessionIds) {
    List<GameSession> sessions = sessionRepo.findAll();
    Map<Long, List<Placement>> placementsBefore = new HashMap<>();
    for (GameSession s : sessions) placementsBefore.put(s.getId(), placements(s));
    Map<String, String> ladderBefore = ladders();
    Map<String, Integer> gamesBefore = games();

    RoundRecomputer.Result fixes =
        recomputeRounds
            ? roundRecomputer.recompute(
                sessions.stream()
                    .filter(
                        s ->
                            sessionIds == null
                                || sessionIds.isEmpty()
                                || sessionIds.contains(s.getId()))
                    .toList())
            : new RoundRecomputer.Result(List.of(), List.of());
    TierService.BackfillResult replay = tierService.backfillLadder();

    Set<Long> touched = new HashSet<>();
    for (RoundRecomputer.Change c : fixes.changed()) touched.add(c.sessionId());
    List<SessionImpact> impacts = new ArrayList<>();
    for (GameSession s : sessions) {
      if (!touched.contains(s.getId())) continue;
      List<Placement> before = placementsBefore.get(s.getId());
      List<Placement> after = placements(s);
      boolean changed =
          !before.stream()
              .map(Placement::player)
              .toList()
              .equals(after.stream().map(Placement::player).toList());
      impacts.add(new SessionImpact(s.getId(), s.getStatus().name(), before, after, changed));
    }

    Map<String, String> ladderAfter = ladders();
    Map<String, Integer> gamesAfter = games();
    List<PlayerImpact> players = new ArrayList<>();
    for (String key : ladderBefore.keySet()) {
      String[] parts = key.split("\\|");
      if (ladderBefore.get(key).equals(ladderAfter.get(key))
          && gamesBefore.get(key).equals(gamesAfter.get(key))) {
        continue;
      }
      players.add(
          new PlayerImpact(
              parts[0],
              parts[1],
              ladderBefore.get(key),
              ladderAfter.get(key),
              gamesBefore.get(key),
              gamesAfter.get(key)));
    }

    if (dryRun) TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
    log.info(
        "Recompute {}: {} rounds fixed, {} unresolved, {} players changed",
        dryRun ? "dry run" : "applied",
        fixes.changed().size(),
        fixes.unresolved().size(),
        players.size());
    return new Report(
        dryRun,
        replay.processed(),
        replay.skipped(),
        fixes.changed(),
        fixes.unresolved(),
        impacts,
        players);
  }

  private List<Placement> placements(GameSession session) {
    Map<String, Integer> totals = new LinkedHashMap<>();
    for (var gsp : session.getPlayers()) {
      if (gsp.getPlayer() != null) totals.put(gsp.getPlayer().getUserName(), 0);
    }
    for (var round : session.getRounds()) {
      for (var rs : round.getScores()) {
        if (rs.getPlayer() != null)
          totals.merge(rs.getPlayer().getUserName(), rs.getScore(), Integer::sum);
      }
    }
    return totals.entrySet().stream()
        .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
        .map(e -> new Placement(e.getKey(), e.getValue()))
        .toList();
  }

  /** "name|MODE" to the ladder position as text. */
  private Map<String, String> ladders() {
    Map<String, String> out = new LinkedHashMap<>();
    for (Player p : playerRepo.findAll()) {
      if (p.isBot()) continue;
      for (GameMode mode : GameMode.values()) {
        Ladder.State s = TierService.getLadder(p, mode);
        out.put(
            p.getUserName() + "|" + mode.name(),
            String.format(
                "%s %d星 %.0f/%d",
                Ladder.tierOf(s.level()).name(),
                Ladder.stars(s.level()),
                s.points(),
                Ladder.starCap(s.level())));
      }
    }
    return out;
  }

  private Map<String, Integer> games() {
    Map<String, Integer> out = new LinkedHashMap<>();
    for (Player p : playerRepo.findAll()) {
      if (p.isBot()) continue;
      for (GameMode mode : GameMode.values()) {
        out.put(p.getUserName() + "|" + mode.name(), TierService.getGames(p, mode));
      }
    }
    return out;
  }
}
