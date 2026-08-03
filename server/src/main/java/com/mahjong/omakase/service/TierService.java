package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.PlayerMonthlySkill;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.time.LocalDateTime;
import java.time.YearMonth;
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
 * into tiers (灵明石猴/美猴王/齐天大圣/斗战圣佛), runs the monthly soft reset, and writes per-month skill
 * snapshots used to render historical tier on the players-stats page.
 *
 * <p>All three modes (国标 / 立直 / 东北) are ranked, each with its own independent rating, throne and
 * monthly reset.
 *
 * <p>Tiers are derived state — never persisted directly. Persisted state is the rating, the game
 * count, the all-time peak rating per mode, the per-session rating delta (for the 结算 display), and
 * the per-month snapshots.
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
  private final PlayerMonthlySkillRepository monthlySkillRepo;

  /**
   * Update skill ratings for all human players in this completed session, and record each player's
   * rating change on their {@link com.mahjong.omakase.model.GameSessionPlayer} row so the session
   * page can show it at 结算. Bots are skipped (their rating doesn't change and they're filtered out
   * of the pairwise updates).
   */
  public void onSessionCompleted(GameSession session, Map<Long, Integer> totalScoresByPlayer) {
    if (session.getStatus() != SessionStatus.COMPLETED) return;
    GameMode mode = session.getGameMode();

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

    Map<Long, Double> deltas = applyPairwiseElo(mode, ranked);

    for (Map.Entry<Player, Integer> e : ranked) {
      Player p = e.getKey();
      incrementGames(p, mode);
      bumpPeak(p, mode);
      playerRepo.save(p);
    }

    for (GameSessionPlayer gsp : session.getPlayers()) {
      Player p = gsp.getPlayer();
      if (p == null) continue;
      Double delta = deltas.get(p.getId());
      if (delta == null) continue;
      gsp.setRatingDelta(delta);
      gsp.setRatingAfter(getRating(p, mode));
    }
    sessionRepo.save(session);
  }

  /** Applies the pairwise ELO update and returns each player's rating delta for this session. */
  private Map<Long, Double> applyPairwiseElo(
      GameMode mode, List<Map.Entry<Player, Integer>> ranked) {
    int n = ranked.size();
    // Snapshot starting ratings + games BEFORE the loop. Reading from the live Player object
    // inside the nested loop would let earlier pairings perturb later ones, making the result
    // depend on iteration order instead of just the final standings.
    double[] startRatings = new double[n];
    int[] startGames = new int[n];
    double[] deltas = new double[n];
    for (int i = 0; i < n; i++) {
      Player p = ranked.get(i).getKey();
      startRatings[i] = getRating(p, mode);
      startGames[i] = getGames(p, mode);
    }
    for (int i = 0; i < n; i++) {
      for (int j = i + 1; j < n; j++) {
        double si = startRatings[i];
        double sj = startRatings[j];
        int gi = startGames[i];
        int gj = startGames[j];

        double actual = ranked.get(i).getValue().equals(ranked.get(j).getValue()) ? 0.5 : 1.0;
        double expected = 1.0 / (1.0 + Math.pow(10, (sj - si) / 400.0));
        double softDelta = Math.tanh((actual - expected) * TANH_SCALE);

        double kI = (gi < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;
        double kJ = (gj < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;

        deltas[i] += kI * softDelta;
        deltas[j] -= kJ * softDelta;
      }
    }
    Map<Long, Double> deltaByPlayer = new HashMap<>();
    for (int i = 0; i < n; i++) {
      Player p = ranked.get(i).getKey();
      setRating(p, mode, startRatings[i] + deltas[i]);
      deltaByPlayer.put(p.getId(), deltas[i]);
    }
    return deltaByPlayer;
  }

  /** Monthly soft reset: pulls every rating toward MEAN by (1 - ALPHA). Peaks are untouched. */
  public void monthlyReset() {
    List<Player> all = playerRepo.findAll();
    int n = 0;
    for (Player p : all) {
      if (p.isBot()) continue;
      for (GameMode mode : GameMode.values()) {
        setRating(p, mode, INITIAL_RATING + RESET_ALPHA * (getRating(p, mode) - INITIAL_RATING));
      }
      playerRepo.save(p);
      n++;
    }
    log.info("Monthly soft-reset applied to {} players (alpha={})", n, RESET_ALPHA);
  }

  /**
   * Write per-(player, mode) snapshots of the player's CURRENT skill state, tagged with the given
   * (year, month). Must be called BEFORE applying the soft reset for that month boundary, so the
   * snapshot reflects end-of-month rating. Idempotent — re-runs upsert in place.
   *
   * <p>Only writes a row for a (player, mode) where the player has at least one lifetime game in
   * that mode. {@code monthlyGames} can be 0 (player didn't play that mode this month but already
   * has a tier from earlier).
   */
  public void snapshotMonth(int year, int month) {
    LocalDateTime[] range = monthUtcRangeFor(java.time.LocalDate.of(year, month, 1));
    // Bulk: 1 SQL per mode for the whole month, then map.get per (player, mode).
    Map<GameMode, Map<Long, Integer>> monthlyByMode = new java.util.EnumMap<>(GameMode.class);
    for (GameMode mode : GameMode.values()) {
      monthlyByMode.put(mode, monthlyGamesByPlayer(mode, range[0], range[1]));
    }
    List<Player> all = playerRepo.findAll();
    int written = 0;
    for (Player p : all) {
      if (p.isBot()) continue;
      for (GameMode mode : GameMode.values()) {
        if (getGames(p, mode) == 0) continue;
        int mgames = monthlyByMode.get(mode).getOrDefault(p.getId(), 0);
        double rating = getRating(p, mode);
        double peak = getPeak(p, mode);
        PlayerMonthlySkill snap =
            monthlySkillRepo
                .findByPlayerIdAndModeAndYearAndMonth(p.getId(), mode, year, month)
                .orElseGet(PlayerMonthlySkill::new);
        snap.setPlayer(p);
        snap.setMode(mode);
        snap.setYear(year);
        snap.setMonth(month);
        snap.setSkillRating(rating);
        snap.setGames(getGames(p, mode));
        snap.setMonthlyGames(mgames);
        snap.setPeakRating(peak);
        monthlySkillRepo.save(snap);
        written++;
      }
    }
    log.info("Snapshot {}/{} wrote {} rows", year, month, written);
  }

  /** Compute tier for a player in a given mode, factoring in the throne (单 1 位). */
  public Tier computeTier(Player p, GameMode mode) {
    return computeTier(p, mode, findThroneId(mode));
  }

  /**
   * Throne-aware overload — caller passes the precomputed throne id so we don't redo {@code
   * findThrone} (= {@code playerRepo.findAll()} + monthly count) for every player in a stats
   * response. Pass {@code null} when no qualified throne holder exists.
   */
  public Tier computeTier(Player p, GameMode mode, Long throneId) {
    if (getGames(p, mode) < RANKED_MIN_GAMES) return Tier.UNRANKED;
    double rating = getRating(p, mode);
    if (rating < LV2_CUTOFF) return Tier.LV1;
    if (rating < LV3_CUTOFF) return Tier.LV2;
    return (throneId != null && throneId.equals(p.getId())) ? Tier.LV4_THRONE : Tier.LV3;
  }

  /**
   * Find the throne holder for a mode. 王座 还要求本月活跃 (≥ THRONE_MONTHLY_MIN_GAMES 场). Ties at the top
   * rating produce no throne holder, so the result is deterministic and 不随 iteration order 摆动.
   */
  public Player findThrone(GameMode mode) {
    LocalDateTime[] monthRange = currentMonthUtcRange();
    Map<Long, Integer> monthly = monthlyGamesByPlayer(mode, monthRange[0], monthRange[1]);
    List<Player> qualified =
        playerRepo.findAll().stream()
            .filter(p -> !p.isBot())
            .filter(p -> getGames(p, mode) >= RANKED_MIN_GAMES)
            .filter(p -> getRating(p, mode) >= LV3_CUTOFF)
            .filter(p -> monthly.getOrDefault(p.getId(), 0) >= THRONE_MONTHLY_MIN_GAMES)
            .toList();
    if (qualified.isEmpty()) return null;
    double topRating =
        qualified.stream().mapToDouble(p -> getRating(p, mode)).max().orElse(Double.NaN);
    List<Player> top = qualified.stream().filter(p -> getRating(p, mode) == topRating).toList();
    return top.size() == 1 ? top.get(0) : null;
  }

  /**
   * Just the throne's player id (or null) — saves loading the full Player when only the id is
   * needed.
   */
  public Long findThroneId(GameMode mode) {
    Player throne = findThrone(mode);
    return throne != null ? throne.getId() : null;
  }

  /** Snapshot of one player's tier for a historical month. */
  public record MonthlyTierInfo(Tier tier, double skillRating, int gamesNeeded) {}

  /**
   * Look up historical tiers for every player who has a snapshot for (mode, year, month). Throne =
   * single highest-rating snapshot meeting LV3 cutoff + ≥ {@link #RANKED_MIN_GAMES} cumulative + ≥
   * {@link #THRONE_MONTHLY_MIN_GAMES} that month. Returns map by playerId.
   */
  public Map<Long, MonthlyTierInfo> computeMonthlySnapshotTiers(
      GameMode mode, int year, int month) {
    List<PlayerMonthlySkill> rows = monthlySkillRepo.findByModeAndYearAndMonth(mode, year, month);
    if (rows.isEmpty()) return Map.of();

    List<PlayerMonthlySkill> throneCandidates =
        rows.stream()
            .filter(s -> s.getSkillRating() >= LV3_CUTOFF)
            .filter(s -> s.getGames() >= RANKED_MIN_GAMES)
            .filter(s -> s.getMonthlyGames() >= THRONE_MONTHLY_MIN_GAMES)
            .toList();
    Long throneId = null;
    if (!throneCandidates.isEmpty()) {
      double topRating =
          throneCandidates.stream()
              .mapToDouble(PlayerMonthlySkill::getSkillRating)
              .max()
              .orElse(Double.NaN);
      List<PlayerMonthlySkill> top =
          throneCandidates.stream().filter(s -> s.getSkillRating() == topRating).toList();
      if (top.size() == 1) {
        throneId = top.get(0).getPlayer().getId();
      }
    }

    Map<Long, MonthlyTierInfo> result = new HashMap<>();
    for (PlayerMonthlySkill s : rows) {
      Tier tier;
      if (s.getGames() < RANKED_MIN_GAMES) {
        tier = Tier.UNRANKED;
      } else if (s.getSkillRating() < LV2_CUTOFF) {
        tier = Tier.LV1;
      } else if (s.getSkillRating() < LV3_CUTOFF) {
        tier = Tier.LV2;
      } else if (throneId != null && throneId.equals(s.getPlayer().getId())) {
        tier = Tier.LV4_THRONE;
      } else {
        tier = Tier.LV3;
      }
      int needed = tier == Tier.UNRANKED ? Math.max(0, RANKED_MIN_GAMES - s.getGames()) : 0;
      result.put(s.getPlayer().getId(), new MonthlyTierInfo(tier, s.getSkillRating(), needed));
    }
    return result;
  }

  /**
   * Resolve per-player tier for everyone, as of the given session's PT calendar month. For past
   * months we read from {@link PlayerMonthlySkill} snapshots; for the current/future month we fall
   * back to live state. Used by {@link TableStrengthService} so historical sessions show the label
   * they had at the time, not what today's ratings would suggest.
   */
  public Map<Long, Tier> resolveTiersForDate(GameMode mode, LocalDateTime referenceUtc) {
    YearMonth queryMonth =
        YearMonth.from(
            referenceUtc.atZone(ZONE_UTC).withZoneSameInstant(ZONE_PACIFIC).toLocalDate());
    YearMonth currentMonth = YearMonth.from(java.time.LocalDate.now(ZONE_PACIFIC));
    if (queryMonth.isBefore(currentMonth)) {
      Map<Long, MonthlyTierInfo> snap =
          computeMonthlySnapshotTiers(mode, queryMonth.getYear(), queryMonth.getMonthValue());
      Map<Long, Tier> out = new HashMap<>();
      snap.forEach((pid, info) -> out.put(pid, info.tier()));
      return out;
    }
    Map<Long, Tier> out = new HashMap<>();
    Long throneId = findThroneId(mode);
    for (Player p : playerRepo.findAll()) {
      if (p.isBot()) continue;
      out.put(p.getId(), computeTier(p, mode, throneId));
    }
    return out;
  }

  private LocalDateTime[] currentMonthUtcRange() {
    return monthUtcRangeFor(java.time.LocalDate.now(ZONE_PACIFIC));
  }

  private LocalDateTime[] monthUtcRangeFor(java.time.LocalDate pacificDate) {
    YearMonth ym = YearMonth.from(pacificDate);
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

  /**
   * Bulk: per-player count of completed sessions in [start, end) for a mode. One SQL — replaces
   * per-player {@code findAll}+filter scans that were causing N+1 lazy collection loads on the
   * stats / session-list / profile pages.
   */
  public Map<Long, Integer> monthlyGamesByPlayer(
      GameMode mode, LocalDateTime startUtc, LocalDateTime endUtc) {
    Map<Long, Integer> out = new HashMap<>();
    for (Object[] row : sessionRepo.countMonthlyGamesByPlayer(mode, startUtc, endUtc)) {
      out.put((Long) row[0], ((Number) row[1]).intValue());
    }
    return out;
  }

  private int monthlyGames(Player p, GameMode mode, LocalDateTime startUtc, LocalDateTime endUtc) {
    return monthlyGamesByPlayer(mode, startUtc, endUtc).getOrDefault(p.getId(), 0);
  }

  // ===== Backfill =====

  /**
   * Reset all players' skill state and replay every completed session in chronological order. At
   * each PT month boundary we cross during replay, write end-of-month snapshots and apply the soft
   * reset (mirroring what the scheduled cron would have done). After replay, snapshots exist for
   * every past calendar month so historical tier views work.
   */
  public BackfillResult backfillAllHistory() {
    // 1. Reset live state.
    List<Player> all = playerRepo.findAll();
    for (Player p : all) {
      for (GameMode mode : GameMode.values()) {
        setRating(p, mode, INITIAL_RATING);
        setGames(p, mode, 0);
        setPeak(p, mode, INITIAL_RATING);
      }
    }
    playerRepo.saveAll(all);

    // 2. Wipe historical snapshots so this is idempotent.
    monthlySkillRepo.deleteAllInBatch();

    // 3. Replay sessions chronologically, snapshotting + resetting at each PT month boundary.
    List<GameSession> sessions =
        sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.COMPLETED);
    sessions = new ArrayList<>(sessions);
    sessions.sort(Comparator.comparing(GameSession::getCreatedAt));

    YearMonth currentMonth = null;
    YearMonth currentPtMonth = YearMonth.from(java.time.LocalDate.now(ZONE_PACIFIC));

    int processed = 0;
    int skipped = 0;
    for (GameSession s : sessions) {
      YearMonth sessionMonth = ymPacific(s.getCreatedAt());
      if (currentMonth == null) {
        currentMonth = sessionMonth;
      } else if (sessionMonth.isAfter(currentMonth)) {
        // Close out every month from currentMonth up to (but not including) sessionMonth.
        while (currentMonth.isBefore(sessionMonth)) {
          snapshotMonth(currentMonth.getYear(), currentMonth.getMonthValue());
          monthlyReset();
          currentMonth = currentMonth.plusMonths(1);
        }
      }

      Map<Long, Integer> scores = aggregateSessionScores(s);
      if (scores.isEmpty()) {
        skipped++;
        continue;
      }
      onSessionCompleted(s, scores);
      processed++;
    }

    // 4. Close out any past months remaining (after the last session's month, up to but excluding
    //    the current PT month — current month never gets a snapshot until its cron fires).
    if (currentMonth != null) {
      while (currentMonth.isBefore(currentPtMonth)) {
        snapshotMonth(currentMonth.getYear(), currentMonth.getMonthValue());
        monthlyReset();
        currentMonth = currentMonth.plusMonths(1);
      }
    }

    log.info("Backfill complete: {} sessions processed, {} skipped", processed, skipped);
    return new BackfillResult(processed, skipped);
  }

  private YearMonth ymPacific(LocalDateTime utc) {
    return YearMonth.from(utc.atZone(ZONE_UTC).withZoneSameInstant(ZONE_PACIFIC).toLocalDate());
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

  /**
   * 这三个 setter 是 switch <b>语句</b>, 编译器不像 switch 表达式那样强制穷尽. 新增 GameMode 又漏改 setter 时, 没有 default 会静默
   * no-op, 让那个模式的 rating/games/peak 永远不更新 —— 宁可直接抛.
   */
  private static IllegalArgumentException unhandledMode(GameMode mode) {
    return new IllegalArgumentException("Unhandled GameMode: " + mode);
  }

  private double getRating(Player p, GameMode mode) {
    return switch (mode) {
      case GUOBIAO -> p.getSkillGuobiao();
      case RIICHI -> p.getSkillRiichi();
      case DONGBEI -> p.getSkillDongbei();
    };
  }

  private void setRating(Player p, GameMode mode, double v) {
    switch (mode) {
      case GUOBIAO -> p.setSkillGuobiao(v);
      case RIICHI -> p.setSkillRiichi(v);
      case DONGBEI -> p.setSkillDongbei(v);
      default -> throw unhandledMode(mode);
    }
  }

  private int getGames(Player p, GameMode mode) {
    return switch (mode) {
      case GUOBIAO -> p.getGamesGuobiao();
      case RIICHI -> p.getGamesRiichi();
      case DONGBEI -> p.getGamesDongbei();
    };
  }

  private void setGames(Player p, GameMode mode, int v) {
    switch (mode) {
      case GUOBIAO -> p.setGamesGuobiao(v);
      case RIICHI -> p.setGamesRiichi(v);
      case DONGBEI -> p.setGamesDongbei(v);
      default -> throw unhandledMode(mode);
    }
  }

  private void incrementGames(Player p, GameMode mode) {
    setGames(p, mode, getGames(p, mode) + 1);
  }

  private double getPeak(Player p, GameMode mode) {
    return switch (mode) {
      case GUOBIAO -> p.getPeakSkillGuobiao();
      case RIICHI -> p.getPeakSkillRiichi();
      case DONGBEI -> p.getPeakSkillDongbei();
    };
  }

  private void setPeak(Player p, GameMode mode, double v) {
    switch (mode) {
      case GUOBIAO -> p.setPeakSkillGuobiao(v);
      case RIICHI -> p.setPeakSkillRiichi(v);
      case DONGBEI -> p.setPeakSkillDongbei(v);
      default -> throw unhandledMode(mode);
    }
  }

  private void bumpPeak(Player p, GameMode mode) {
    double current = getRating(p, mode);
    if (current > getPeak(p, mode)) setPeak(p, mode, current);
  }
}
