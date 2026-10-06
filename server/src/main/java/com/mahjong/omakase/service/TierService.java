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
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs 段位战 (per mode), classifies players into tiers (灵明石猴/美猴王/齐天大圣/斗战圣佛), and writes per-month
 * snapshots used to render historical tier on the players-stats page.
 *
 * <p>Each of 国标 / 立直 / 东北 has its own ladder and throne. The rules are in {@link Ladder}. Nothing
 * is reset: points carry over from one month to the next.
 *
 * <p>Months before 段位战 were rated by a pairwise ELO. Their snapshots and per-session deltas are
 * kept as they were, and the tier shown for those months is still read from that rating.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TierService {

  // Tier cutoffs of the old ELO rating, for months whose snapshots predate 段位战.
  public static final double LV2_CUTOFF = 1400.0;
  public static final double LV3_CUTOFF = 1500.0;
  public static final int RANKED_MIN_GAMES = 5;

  /**
   * 王座 also needs this many games in the window below (live) or in the month (history), so it
   * passes on when its holder stops playing. A rolling window rather than the calendar month, or
   * the throne would sit empty at the start of every month.
   */
  public static final int THRONE_MIN_GAMES = 5;

  public static final int THRONE_WINDOW_DAYS = 30;

  // Pacific timezone — month boundary uses PT.
  private static final java.time.ZoneId ZONE_PACIFIC = java.time.ZoneId.of("America/Los_Angeles");
  private static final java.time.ZoneId ZONE_UTC = java.time.ZoneId.of("UTC");

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;
  private final PlayerMonthlySkillRepository monthlySkillRepo;

  /**
   * Moves every human player in this completed session along their ladder for its mode, and records
   * what the session earned on their {@link GameSessionPlayer} row for the 结算 display. Bots are not
   * rated but keep their place at the table: finishing behind one still costs a place.
   */
  public void onSessionCompleted(GameSession session, Map<Long, Integer> totalScoresByPlayer) {
    if (session.getStatus() != SessionStatus.COMPLETED) return;
    if (!rate(session, totalScoresByPlayer, null)) return;
    sessionRepo.save(session);
  }

  /**
   * Applies one session to the ladder. {@code gamesBefore} supplies each player's games so far in
   * this mode when replaying history; null means read the live counter, record the result on the
   * session, and count the game. Returns false when the table is not three or four players.
   */
  private boolean rate(
      GameSession session, Map<Long, Integer> totals, Map<Long, Integer> gamesBefore) {
    GameMode mode = session.getGameMode();
    List<Integer> table = totals.values().stream().sorted(Comparator.reverseOrder()).toList();
    if (table.size() != 3 && table.size() != 4) {
      log.warn("Session id={} has {} scored players, not rated", session.getId(), table.size());
      return false;
    }
    for (GameSessionPlayer gsp : session.getPlayers()) {
      Player p = gsp.getPlayer();
      if (p == null || p.isBot()) continue;
      Integer score = totals.get(p.getId());
      if (score == null) continue;

      int[] places =
          IntStream.range(0, table.size()).filter(i -> table.get(i).equals(score)).toArray();
      int games = gamesBefore != null ? gamesBefore.getOrDefault(p.getId(), 0) : getGames(p, mode);
      Ladder.State before = getLadder(p, mode);
      double gain = Ladder.gain(places, table.size(), score, mode, before.level());
      Ladder.State after = Ladder.apply(before, gain, games < Ladder.PROTECTED_GAMES);
      setLadder(p, mode, after);

      if (gamesBefore != null) {
        gamesBefore.merge(p.getId(), 1, Integer::sum);
        continue;
      }
      incrementGames(p, mode);
      playerRepo.save(p);
      gsp.setLadderDelta(gain);
      gsp.setLadderLevelAfter(after.level());
      gsp.setLadderPointsAfter(after.points());
    }
    return true;
  }

  /**
   * Write per-(player, mode) snapshots of the player's CURRENT state, tagged with the given (year,
   * month). Idempotent — re-runs upsert in place.
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
        PlayerMonthlySkill snap =
            monthlySkillRepo
                .findByPlayerIdAndModeAndYearAndMonth(p.getId(), mode, year, month)
                .orElseGet(PlayerMonthlySkill::new);
        snap.setPlayer(p);
        snap.setMode(mode);
        snap.setYear(year);
        snap.setMonth(month);
        snap.setSkillRating(getRating(p, mode));
        snap.setGames(getGames(p, mode));
        snap.setMonthlyGames(mgames);
        snap.setPeakRating(getPeak(p, mode));
        Ladder.State ladder = getLadder(p, mode);
        snap.setLadderLevel(ladder.level());
        snap.setLadderPoints(ladder.points());
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
   * findThrone} for every player in a stats response. Pass {@code null} when no qualified throne
   * holder exists.
   */
  public Tier computeTier(Player p, GameMode mode, Long throneId) {
    if (getGames(p, mode) < RANKED_MIN_GAMES) return Tier.UNRANKED;
    Tier tier = Ladder.tierOf(getLadder(p, mode).level());
    boolean throne = tier == Tier.LV3 && throneId != null && throneId.equals(p.getId());
    return throne ? Tier.LV4_THRONE : tier;
  }

  /**
   * The throne holder for a mode: the single furthest-along 齐天大圣 with at least {@link
   * #THRONE_MIN_GAMES} games in the last {@link #THRONE_WINDOW_DAYS} days. A tie at the top
   * produces no holder, so the result does not depend on iteration order.
   */
  public Player findThrone(GameMode mode) {
    LocalDateTime now = LocalDateTime.now(ZONE_UTC);
    Map<Long, Integer> recent =
        monthlyGamesByPlayer(mode, now.minusDays(THRONE_WINDOW_DAYS), now.plusMinutes(1));
    List<Player> qualified =
        playerRepo.findAll().stream()
            .filter(p -> !p.isBot())
            .filter(p -> getGames(p, mode) >= RANKED_MIN_GAMES)
            .filter(p -> Ladder.tierOf(getLadder(p, mode).level()) == Tier.LV3)
            .filter(p -> recent.getOrDefault(p.getId(), 0) >= THRONE_MIN_GAMES)
            .toList();
    if (qualified.isEmpty()) return null;
    double top =
        qualified.stream().mapToDouble(p -> Ladder.sortKey(getLadder(p, mode))).max().orElseThrow();
    List<Player> best =
        qualified.stream().filter(p -> Ladder.sortKey(getLadder(p, mode)) == top).toList();
    return best.size() == 1 ? best.get(0) : null;
  }

  /**
   * Just the throne's player id (or null) — saves loading the full Player when only the id is
   * needed.
   */
  public Long findThroneId(GameMode mode) {
    Player throne = findThrone(mode);
    return throne != null ? throne.getId() : null;
  }

  /**
   * One player's tier for a historical month. {@code sortScore} orders players within that month;
   * the ladder fields are null for months from before 段位战.
   */
  public record MonthlyTierInfo(
      Tier tier,
      double sortScore,
      int gamesNeeded,
      Integer stars,
      Double ladderPoints,
      Integer starCap) {}

  /**
   * Historical tiers for every player who has a snapshot for (mode, year, month). Months written by
   * 段位战 read the ladder; older months read the ELO rating with its old cutoffs. Throne = the single
   * best snapshot that is in the top tier with ≥ {@link #RANKED_MIN_GAMES} games overall and ≥
   * {@link #THRONE_MIN_GAMES} that month.
   */
  public Map<Long, MonthlyTierInfo> computeMonthlySnapshotTiers(
      GameMode mode, int year, int month) {
    List<PlayerMonthlySkill> rows = monthlySkillRepo.findByModeAndYearAndMonth(mode, year, month);
    if (rows.isEmpty()) return Map.of();

    Map<Long, Double> score = new HashMap<>();
    Map<Long, Tier> base = new HashMap<>();
    for (PlayerMonthlySkill s : rows) {
      Long id = s.getPlayer().getId();
      if (s.getLadderLevel() != null) {
        score.put(id, Ladder.sortKey(new Ladder.State(s.getLadderLevel(), s.getLadderPoints())));
        base.put(id, Ladder.tierOf(s.getLadderLevel()));
      } else {
        double r = s.getSkillRating();
        score.put(id, r);
        base.put(id, r < LV2_CUTOFF ? Tier.LV1 : r < LV3_CUTOFF ? Tier.LV2 : Tier.LV3);
      }
    }

    List<PlayerMonthlySkill> throneCandidates =
        rows.stream()
            .filter(s -> base.get(s.getPlayer().getId()) == Tier.LV3)
            .filter(s -> s.getGames() >= RANKED_MIN_GAMES)
            .filter(s -> s.getMonthlyGames() >= THRONE_MIN_GAMES)
            .toList();
    Long throneId = null;
    if (!throneCandidates.isEmpty()) {
      double top =
          throneCandidates.stream()
              .mapToDouble(s -> score.get(s.getPlayer().getId()))
              .max()
              .orElseThrow();
      List<PlayerMonthlySkill> best =
          throneCandidates.stream().filter(s -> score.get(s.getPlayer().getId()) == top).toList();
      if (best.size() == 1) {
        throneId = best.get(0).getPlayer().getId();
      }
    }

    Map<Long, MonthlyTierInfo> result = new HashMap<>();
    for (PlayerMonthlySkill s : rows) {
      Long id = s.getPlayer().getId();
      Tier tier;
      if (s.getGames() < RANKED_MIN_GAMES) {
        tier = Tier.UNRANKED;
      } else if (id.equals(throneId)) {
        tier = Tier.LV4_THRONE;
      } else {
        tier = base.get(id);
      }
      int needed = tier == Tier.UNRANKED ? Math.max(0, RANKED_MIN_GAMES - s.getGames()) : 0;
      Integer level = s.getLadderLevel();
      result.put(
          id,
          new MonthlyTierInfo(
              tier,
              score.get(id),
              needed,
              level != null ? Ladder.stars(level) : null,
              s.getLadderPoints(),
              level != null ? Ladder.starCap(level) : null));
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
   * Seeds every player's ladder from the completed sessions on record, replayed oldest first. Only
   * the live ladder state is written: past sessions keep the delta shown at their 结算, past months
   * keep the tier they were shown with, and game counts are left alone. Everyone starts over at
   * {@link Ladder.State#start} each run, so it is safe to run again.
   */
  public BackfillResult backfillLadder() {
    List<Player> all = playerRepo.findAll();
    for (Player p : all) {
      for (GameMode mode : GameMode.values()) {
        setLadder(p, mode, Ladder.State.start());
      }
    }

    List<GameSession> sessions =
        new ArrayList<>(sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.COMPLETED));
    sessions.sort(
        Comparator.comparing(GameSession::getCreatedAt).thenComparing(GameSession::getId));

    Map<GameMode, Map<Long, Integer>> gamesSoFar = new java.util.EnumMap<>(GameMode.class);
    int processed = 0;
    int skipped = 0;
    for (GameSession s : sessions) {
      Map<Long, Integer> games = gamesSoFar.computeIfAbsent(s.getGameMode(), m -> new HashMap<>());
      if (rate(s, aggregateSessionScores(s), games)) {
        processed++;
      } else {
        skipped++;
      }
    }
    playerRepo.saveAll(all);
    log.info("Ladder backfill complete: {} sessions processed, {} skipped", processed, skipped);
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

  /**
   * The setters are switch <b>statements</b>, which the compiler does not check for exhaustiveness
   * the way it checks switch expressions. A GameMode added later and missed here would silently
   * never update — so throw instead.
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

  public static Ladder.State getLadder(Player p, GameMode mode) {
    return switch (mode) {
      case GUOBIAO -> new Ladder.State(p.getLadderLevelGuobiao(), p.getLadderPointsGuobiao());
      case RIICHI -> new Ladder.State(p.getLadderLevelRiichi(), p.getLadderPointsRiichi());
      case DONGBEI -> new Ladder.State(p.getLadderLevelDongbei(), p.getLadderPointsDongbei());
    };
  }

  private void setLadder(Player p, GameMode mode, Ladder.State s) {
    switch (mode) {
      case GUOBIAO -> {
        p.setLadderLevelGuobiao(s.level());
        p.setLadderPointsGuobiao(s.points());
      }
      case RIICHI -> {
        p.setLadderLevelRiichi(s.level());
        p.setLadderPointsRiichi(s.points());
      }
      case DONGBEI -> {
        p.setLadderLevelDongbei(s.level());
        p.setLadderPointsDongbei(s.points());
      }
      default -> throw unhandledMode(mode);
    }
  }
}
