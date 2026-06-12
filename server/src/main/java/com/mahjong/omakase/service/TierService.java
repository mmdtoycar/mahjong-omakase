package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Computes hidden skill ratings (per mode) using Pairwise ELO + tanh softening, classifies players
 * into tiers (灵明石猴/美猴王/齐天大圣/斗战圣佛), and runs the monthly soft reset.
 *
 * <p>Tiers are derived state — never persisted directly. Persisted state is the rating, the game
 * count, and the all-time peak rating per mode.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TierService {

  // Tunables — keep in sync with EloSimulationTest defaults.
  public static final double INITIAL_RATING = 1500.0;
  public static final double K_NEW = 48.0;
  public static final double K_STABLE = 24.0;
  public static final int NEW_PLAYER_GAMES = 10;
  public static final double TANH_SCALE = 2.0;

  // Tier cutoffs (locked: < 1400 / 1400-1500 / > 1500 + throne).
  public static final double LV2_CUTOFF = 1400.0;
  public static final double LV3_CUTOFF = 1500.0;
  public static final int RANKED_MIN_GAMES = 5;

  /** 王座(斗战圣佛)还要本月至少 N 场, 否则不流转给不活跃高分玩家. */
  public static final int THRONE_MONTHLY_MIN_GAMES = 5;

  // Pacific timezone — month boundary uses PT.
  private static final java.time.ZoneId ZONE_PACIFIC = java.time.ZoneId.of("America/Los_Angeles");
  private static final java.time.ZoneId ZONE_UTC = java.time.ZoneId.of("UTC");

  // Monthly soft reset: new = MEAN + ALPHA * (old - MEAN). 0.7 = mild regression to the mean.
  public static final double RESET_ALPHA = 0.7;

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;

  /**
   * Update skill ratings for all human players in this completed session. Bots are skipped (their
   * rating doesn't change and they're filtered out of the pairwise updates).
   */
  public void onSessionCompleted(GameSession session, Map<Long, Integer> totalScoresByPlayer) {
    if (session.getStatus() != SessionStatus.COMPLETED) return;
    GameMode mode = session.getGameMode();
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return;

    // Filter to humans with a recorded score, sorted by score descending = rank order.
    List<Map.Entry<Player, Integer>> ranked = new ArrayList<>();
    for (Player p : session.getPlayers().stream().map(gsp -> gsp.getPlayer()).toList()) {
      if (p == null || p.isBot()) continue;
      Integer score = totalScoresByPlayer.get(p.getId());
      if (score == null) continue;
      ranked.add(Map.entry(p, score));
    }
    ranked.sort(Map.Entry.<Player, Integer>comparingByValue().reversed());

    if (ranked.size() < 2) return;

    applyPairwiseElo(mode, ranked);

    for (Map.Entry<Player, Integer> e : ranked) {
      Player p = e.getKey();
      incrementGames(p, mode);
      bumpPeak(p, mode);
      playerRepo.save(p);
    }
  }

  private void applyPairwiseElo(GameMode mode, List<Map.Entry<Player, Integer>> ranked) {
    int n = ranked.size();
    for (int i = 0; i < n; i++) {
      for (int j = i + 1; j < n; j++) {
        Player pi = ranked.get(i).getKey();
        Player pj = ranked.get(j).getKey();
        double si = getRating(pi, mode);
        double sj = getRating(pj, mode);
        int gi = getGames(pi, mode);
        int gj = getGames(pj, mode);

        double actual = ranked.get(i).getValue().equals(ranked.get(j).getValue()) ? 0.5 : 1.0;
        double expected = 1.0 / (1.0 + Math.pow(10, (sj - si) / 400.0));
        double softDelta = Math.tanh((actual - expected) * TANH_SCALE);

        double kI = (gi < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;
        double kJ = (gj < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;

        setRating(pi, mode, si + kI * softDelta);
        setRating(pj, mode, sj - kJ * softDelta);
      }
    }
  }

  /** Monthly soft reset: pulls every rating toward MEAN by (1 - ALPHA). Peaks are untouched. */
  public void monthlyReset() {
    List<Player> all = playerRepo.findAll();
    int n = 0;
    for (Player p : all) {
      if (p.isBot()) continue;
      double newGuobiao = INITIAL_RATING + RESET_ALPHA * (p.getSkillGuobiao() - INITIAL_RATING);
      double newRiichi = INITIAL_RATING + RESET_ALPHA * (p.getSkillRiichi() - INITIAL_RATING);
      p.setSkillGuobiao(newGuobiao);
      p.setSkillRiichi(newRiichi);
      playerRepo.save(p);
      n++;
    }
    log.info("Monthly soft-reset applied to {} players (alpha={})", n, RESET_ALPHA);
  }

  /** Compute tier for a player in a given mode, factoring in the throne (单 1 位). */
  public Tier computeTier(Player p, GameMode mode) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return Tier.UNRANKED;
    // 该模式累计 ≥ 10 场才入段.
    if (getGames(p, mode) < RANKED_MIN_GAMES) return Tier.UNRANKED;

    double rating = getRating(p, mode);
    if (rating < LV2_CUTOFF) return Tier.LV1;
    if (rating < LV3_CUTOFF) return Tier.LV2;

    // LV3 vs LV4_THRONE: only the single highest-rated qualified player gets the throne.
    Player throne = findThrone(mode);
    return (throne != null && throne.getId().equals(p.getId())) ? Tier.LV4_THRONE : Tier.LV3;
  }

  /** Find the throne holder for a mode. 王座 还要求本月活跃 (≥ THRONE_MONTHLY_MIN_GAMES 场). */
  public Player findThrone(GameMode mode) {
    LocalDateTime[] monthRange = currentMonthUtcRange();
    return playerRepo.findAll().stream()
        .filter(p -> !p.isBot())
        .filter(p -> getGames(p, mode) >= RANKED_MIN_GAMES)
        .filter(p -> getRating(p, mode) >= LV3_CUTOFF)
        .filter(
            p -> monthlyGames(p, mode, monthRange[0], monthRange[1]) >= THRONE_MONTHLY_MIN_GAMES)
        .max(Comparator.comparingDouble(p -> getRating(p, mode)))
        .orElse(null);
  }

  private LocalDateTime[] currentMonthUtcRange() {
    java.time.LocalDate today = java.time.LocalDate.now(ZONE_PACIFIC);
    java.time.YearMonth ym = java.time.YearMonth.from(today);
    LocalDateTime startPacific = ym.atDay(1).atStartOfDay();
    LocalDateTime endPacific = ym.plusMonths(1).atDay(1).atStartOfDay();
    LocalDateTime startUtc =
        startPacific.atZone(ZONE_PACIFIC).withZoneSameInstant(ZONE_UTC).toLocalDateTime();
    LocalDateTime endUtc =
        endPacific.atZone(ZONE_PACIFIC).withZoneSameInstant(ZONE_UTC).toLocalDateTime();
    return new LocalDateTime[] {startUtc, endUtc};
  }

  /** Count completed sessions THIS MONTH (Pacific) where player participated, in given mode. */
  public int monthlyGames(Player p, GameMode mode) {
    LocalDateTime[] r = currentMonthUtcRange();
    return monthlyGames(p, mode, r[0], r[1]);
  }

  private int monthlyGames(Player p, GameMode mode, LocalDateTime startUtc, LocalDateTime endUtc) {
    return (int)
        sessionRepo.findAll().stream()
            .filter(s -> s.getStatus() == SessionStatus.COMPLETED)
            .filter(s -> s.getGameMode() == mode)
            .filter(s -> !s.getCreatedAt().isBefore(startUtc) && s.getCreatedAt().isBefore(endUtc))
            .filter(
                s ->
                    s.getPlayers().stream()
                        .anyMatch(
                            gsp ->
                                gsp.getPlayer() != null
                                    && gsp.getPlayer().getId().equals(p.getId())))
            .count();
  }

  // ===== Backfill =====

  /**
   * Reset all players' skill state and replay every completed session in chronological order. Run
   * this once after deploying tier columns; subsequent updates happen incrementally via {@link
   * #onSessionCompleted}.
   */
  public BackfillResult backfillAllHistory() {
    // Reset skill state (preserve peak — actually we'll recompute peak too, since peak is derived).
    List<Player> all = playerRepo.findAll();
    for (Player p : all) {
      p.setSkillGuobiao(INITIAL_RATING);
      p.setSkillRiichi(INITIAL_RATING);
      p.setGamesGuobiao(0);
      p.setGamesRiichi(0);
      p.setPeakSkillGuobiao(INITIAL_RATING);
      p.setPeakSkillRiichi(INITIAL_RATING);
    }
    playerRepo.saveAll(all);

    List<GameSession> sessions =
        sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.COMPLETED);
    sessions = new ArrayList<>(sessions);
    sessions.sort(
        Comparator.comparing(GameSession::getCreatedAt)); // ascending for chronological replay

    int processed = 0;
    int skipped = 0;
    for (GameSession s : sessions) {
      Map<Long, Integer> scores = aggregateSessionScores(s);
      if (scores.isEmpty()) {
        skipped++;
        continue;
      }
      onSessionCompleted(s, scores);
      processed++;
    }
    log.info("Backfill complete: {} sessions processed, {} skipped", processed, skipped);
    return new BackfillResult(processed, skipped);
  }

  /** Aggregate total score per player across all rounds of a session. */
  private Map<Long, Integer> aggregateSessionScores(GameSession session) {
    Map<Long, Integer> totals = new HashMap<>();
    for (Round r : session.getRounds()) {
      r.getScores()
          .forEach(
              rs -> {
                if (rs.getPlayer() == null) return;
                totals.merge(rs.getPlayer().getId(), rs.getScore(), Integer::sum);
              });
    }
    return totals;
  }

  /** Result of a backfill run. */
  public record BackfillResult(int processed, int skipped) {}

  // ===== Per-mode getters/setters =====

  private double getRating(Player p, GameMode mode) {
    return mode == GameMode.GUOBIAO ? p.getSkillGuobiao() : p.getSkillRiichi();
  }

  private void setRating(Player p, GameMode mode, double v) {
    if (mode == GameMode.GUOBIAO) p.setSkillGuobiao(v);
    else p.setSkillRiichi(v);
  }

  private int getGames(Player p, GameMode mode) {
    return mode == GameMode.GUOBIAO ? p.getGamesGuobiao() : p.getGamesRiichi();
  }

  private void incrementGames(Player p, GameMode mode) {
    if (mode == GameMode.GUOBIAO) p.setGamesGuobiao(p.getGamesGuobiao() + 1);
    else p.setGamesRiichi(p.getGamesRiichi() + 1);
  }

  private void bumpPeak(Player p, GameMode mode) {
    double current = getRating(p, mode);
    if (mode == GameMode.GUOBIAO) {
      if (current > p.getPeakSkillGuobiao()) p.setPeakSkillGuobiao(current);
    } else {
      if (current > p.getPeakSkillRiichi()) p.setPeakSkillRiichi(current);
    }
  }
}
