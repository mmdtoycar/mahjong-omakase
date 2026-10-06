package com.mahjong.omakase.service;

import com.mahjong.omakase.dto.TierInfo;
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

/** 段位战 per mode (rules in {@link Ladder}), tiers and monthly snapshots. */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TierService {

  // Tier cutoffs of the old ELO rating, for months whose snapshots predate 段位战.
  public static final double LV2_CUTOFF = 1400.0;
  public static final double LV3_CUTOFF = 1500.0;

  /** Games before a player was ranked, in months before 段位战. */
  public static final int RANKED_MIN_GAMES = 5;

  /** Games that month for the single 斗战圣佛 of months before 段位战. */
  public static final int THRONE_MIN_GAMES = 5;

  // Pacific timezone — month boundary uses PT.
  private static final java.time.ZoneId ZONE_PACIFIC = java.time.ZoneId.of("America/Los_Angeles");
  private static final java.time.ZoneId ZONE_UTC = java.time.ZoneId.of("UTC");

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;
  private final PlayerMonthlySkillRepository monthlySkillRepo;

  /** Moves each human along the ladder; bots keep their place but are not rated. */
  public void onSessionCompleted(GameSession session, Map<Long, Integer> totalScoresByPlayer) {
    if (session.getStatus() != SessionStatus.COMPLETED) return;
    rate(session, totalScoresByPlayer, null);
    sessionRepo.save(session);
  }

  /** {@code gamesBefore} is set when replaying history. */
  private void rate(
      GameSession session, Map<Long, Integer> totals, Map<Long, Integer> gamesBefore) {
    GameMode mode = session.getGameMode();
    List<Integer> table = totals.values().stream().sorted(Comparator.reverseOrder()).toList();
    // 魂珠 double when two or more at the table are 斗战圣佛 before the game — a bot never is.
    Map<Long, Player> seated = new HashMap<>();
    for (GameSessionPlayer gsp : session.getPlayers()) {
      if (gsp.getPlayer() != null) seated.put(gsp.getPlayer().getId(), gsp.getPlayer());
    }
    boolean doubled =
        totals.keySet().stream()
                .map(seated::get)
                .filter(p -> p != null && !p.isBot() && Ladder.isDou(getLadder(p, mode).level()))
                .count()
            >= Ladder.DOU_TO_DOUBLE;

    for (GameSessionPlayer gsp : session.getPlayers()) {
      Player p = gsp.getPlayer();
      if (p == null || p.isBot()) continue;
      Integer score = totals.get(p.getId());
      if (score == null) continue;

      int[] places =
          IntStream.range(0, table.size()).filter(i -> table.get(i).equals(score)).toArray();
      int games = gamesBefore != null ? gamesBefore.getOrDefault(p.getId(), 0) : getGames(p, mode);
      Ladder.State before = getLadder(p, mode);
      double gain = Ladder.gain(places, table.size(), score, mode, before.level(), doubled);
      Ladder.State after = Ladder.apply(before, gain, games < Ladder.PROTECTED_GAMES);
      setLadder(p, mode, after);
      gsp.setLadderDelta(gain);
      gsp.setLadderLevelBefore(before.level());
      gsp.setLadderLevelAfter(after.level());
      gsp.setLadderPointsAfter(after.points());

      if (gamesBefore != null) {
        gamesBefore.merge(p.getId(), 1, Integer::sum);
        continue;
      }
      incrementGames(p, mode);
      playerRepo.save(p);
    }
  }

  /** Upserts each player's current state for (year, month), for modes they have played. */
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

  /** The ladder level's tier from the first game; bots are never ranked. */
  public Tier computeTier(Player p, GameMode mode) {
    if (p.isBot()) return Tier.UNRANKED;
    return Ladder.tierOf(getLadder(p, mode).level());
  }

  /** A historical tier; the ladder fields are null for months before 段位战. */
  public record MonthlyTierInfo(
      Tier tier,
      double sortScore,
      int gamesNeeded,
      Integer stars,
      Double ladderPoints,
      Integer starCap) {}

  /** Tiers for a month: the ladder if recorded, else the old ELO and its one 斗战圣佛. */
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
            .filter(s -> s.getLadderLevel() == null)
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
      if (s.getLadderLevel() == null && s.getGames() < RANKED_MIN_GAMES) {
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

  /** The seat's 段位 after this game if it was rated, else the player's current one. */
  public TierInfo seatTier(GameSessionPlayer gsp, GameMode mode) {
    Player p = gsp.getPlayer();
    if (gsp.getLadderLevelAfter() == null) return TierInfo.of(this, p, mode);
    Ladder.State after = new Ladder.State(gsp.getLadderLevelAfter(), gsp.getLadderPointsAfter());
    return TierInfo.ofLadder(Ladder.tierOf(after.level()), after);
  }

  // ===== Backfill =====

  /**
   * Replays every completed session into the live ladder and each seat's result; safe to re-run.
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

    // Month-end snapshots from the 段位战 era follow the replay; older ELO ones are left alone.
    java.util.NavigableMap<YearMonth, List<PlayerMonthlySkill>> snapshots =
        new java.util.TreeMap<>();
    for (PlayerMonthlySkill snap : monthlySkillRepo.findAll()) {
      if (snap.getLadderLevel() == null) continue;
      snapshots
          .computeIfAbsent(YearMonth.of(snap.getYear(), snap.getMonth()), k -> new ArrayList<>())
          .add(snap);
    }
    Map<Long, Player> byId = new HashMap<>();
    for (Player p : all) byId.put(p.getId(), p);

    Map<GameMode, Map<Long, Integer>> gamesSoFar = new java.util.EnumMap<>(GameMode.class);
    int processed = 0;
    int skipped = 0;
    for (GameSession s : sessions) {
      YearMonth month =
          YearMonth.from(s.getCreatedAt().atZone(ZONE_UTC).withZoneSameInstant(ZONE_PACIFIC));
      refreshSnapshots(snapshots.headMap(month, false), byId);
      Map<Long, Integer> scores = aggregateSessionScores(s);
      // A session completed without a single round has nothing to rate.
      if (scores.isEmpty()) {
        skipped++;
        continue;
      }
      rate(s, scores, gamesSoFar.computeIfAbsent(s.getGameMode(), m -> new HashMap<>()));
      processed++;
    }
    refreshSnapshots(snapshots, byId);
    playerRepo.saveAll(all);
    log.info("Ladder backfill complete: {} sessions processed, {} skipped", processed, skipped);
    return new BackfillResult(processed, skipped);
  }

  /** Writes the replayed state into these months' snapshots, then drops them from the map. */
  private void refreshSnapshots(
      Map<YearMonth, List<PlayerMonthlySkill>> months, Map<Long, Player> byId) {
    for (List<PlayerMonthlySkill> rows : months.values()) {
      for (PlayerMonthlySkill snap : rows) {
        Ladder.State state = getLadder(byId.get(snap.getPlayer().getId()), snap.getMode());
        snap.setLadderLevel(state.level());
        snap.setLadderPoints(state.points());
      }
      monthlySkillRepo.saveAll(rows);
    }
    months.clear();
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

  /** The setters are switch statements, not checked for exhaustiveness, so a missed mode throws. */
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
