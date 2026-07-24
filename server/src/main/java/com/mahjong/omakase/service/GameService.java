package com.mahjong.omakase.service;

import com.mahjong.omakase.dto.*;
import com.mahjong.omakase.model.*;
import com.mahjong.omakase.repository.*;
import com.mahjong.omakase.service.handler.GameModeHandler;
import com.mahjong.omakase.service.scoring.RpCalculator;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@Transactional
public class GameService {

  private static final ZoneId ZONE_UTC = ZoneId.of("UTC");
  private static final ZoneId ZONE_PACIFIC = ZoneId.of("America/Los_Angeles");

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;
  private final RoundRepository roundRepo;
  private final RoundScoreRepository roundScoreRepo;
  private final GameSessionPlayerRepository gameSessionPlayerRepo;
  private final AppSettingRepository appSettingRepo;
  private final FanDiscoveryRepository fanDiscoveryRepo;
  private final TierService tierService;
  private final TableStrengthService tableStrengthService;
  private final PlayerMonthlySkillRepository monthlySkillRepo;
  private final CacheManager cacheManager;
  private final Map<GameMode, GameModeHandler> handlers;
  private volatile double participationBonus;

  public GameService(
      PlayerRepository playerRepo,
      GameSessionRepository sessionRepo,
      RoundRepository roundRepo,
      RoundScoreRepository roundScoreRepo,
      GameSessionPlayerRepository gameSessionPlayerRepo,
      AppSettingRepository appSettingRepo,
      FanDiscoveryRepository fanDiscoveryRepo,
      TierService tierService,
      TableStrengthService tableStrengthService,
      PlayerMonthlySkillRepository monthlySkillRepo,
      CacheManager cacheManager,
      List<GameModeHandler> handlerList) {
    this.playerRepo = playerRepo;
    this.sessionRepo = sessionRepo;
    this.roundRepo = roundRepo;
    this.roundScoreRepo = roundScoreRepo;
    this.gameSessionPlayerRepo = gameSessionPlayerRepo;
    this.appSettingRepo = appSettingRepo;
    this.fanDiscoveryRepo = fanDiscoveryRepo;
    this.tierService = tierService;
    this.tableStrengthService = tableStrengthService;
    this.monthlySkillRepo = monthlySkillRepo;
    this.cacheManager = cacheManager;
    this.handlers =
        handlerList.stream()
            .collect(Collectors.toMap(GameModeHandler::getGameMode, Function.identity()));
    this.participationBonus = loadParticipationBonus();
  }

  /**
   * Wipes every derived-state cache. Called from every write path that could change session list,
   * player stats, home summary, or active seasons. Cheaper than fine-grained per-cache eviction —
   * caches refill on the next read.
   */
  public void evictAllCaches() {
    for (String name : cacheManager.getCacheNames()) {
      var cache = cacheManager.getCache(name);
      if (cache != null) cache.clear();
    }
  }

  @EventListener(ApplicationReadyEvent.class)
  public void init() {
    initializeDiscoveries();
    warmupCaches();
  }

  /**
   * Pre-populate the read caches so the first user request after deploy doesn't pay the cold cost.
   * Without this, deploy + idle hours = the next user gets a slow page even though the Caffeine
   * cache exists — it would just be empty.
   */
  private void warmupCaches() {
    log.info("Warming up read caches...");
    try {
      getAllSessionSummaries();
      getActiveSeasons();
      java.time.LocalDate today = java.time.LocalDate.now(ZONE_PACIFIC);
      LocalDateTime ptStart = YearMonth.from(today).atDay(1).atStartOfDay();
      LocalDateTime ptEnd = YearMonth.from(today).plusMonths(1).atDay(1).atStartOfDay();
      getHomeSummary(ptStart, ptEnd);
      for (GameMode mode : GameMode.values()) {
        getPlayerStats(mode, ptStart, ptEnd);
      }
      log.info("Cache warmup done");
    } catch (RuntimeException e) {
      // Don't fail boot if warmup hits an issue — caches will fill on first real request anyway.
      log.warn("Cache warmup hit an error (caches will fill lazily): {}", e.getMessage());
    }
  }

  public void initializeDiscoveries() {
    log.info("Checking for new fan discoveries from historical rounds...");

    int page = 0;
    int size = 100;
    int newDiscoveries = 0;

    while (true) {
      Pageable pageable = PageRequest.of(page, size);
      Page<Round> roundPage = roundRepo.findAllOrderByTime(pageable);
      List<Round> rounds = roundPage.getContent();

      if (rounds.isEmpty()) {
        break;
      }

      for (Round round : rounds) {
        if (round.getWinnerId() == null || round.getFanDetails() == null) continue;
        if (round.getGameSession().getGameMode() != GameMode.GUOBIAO) continue;
        Player winner = loadActivePlayer(round.getWinnerId());
        if (winner == null) continue;

        String season = getSeasonStringFromUtc(round.getGameSession().getCreatedAt());
        newDiscoveries +=
            processFanDiscoveries(
                round.getFanDetails(),
                season,
                winner,
                round,
                round.getWinHand(),
                round.getGameSession().getCreatedAt());
      }
      page++;
    }
    log.info("Fan discoveries initialization complete. Found {} new discoveries.", newDiscoveries);
  }

  private LocalDateTime toUtcTime(LocalDateTime pacificTime) {
    if (pacificTime == null) return null;
    return pacificTime.atZone(ZONE_PACIFIC).withZoneSameInstant(ZONE_UTC).toLocalDateTime();
  }

  private LocalDateTime toPacificTime(LocalDateTime utcTime) {
    if (utcTime == null) return null;
    return utcTime.atZone(ZONE_UTC).withZoneSameInstant(ZONE_PACIFIC).toLocalDateTime();
  }

  private String getSeasonStringFromUtc(LocalDateTime utcTime) {
    if (utcTime == null) return null;
    return getSeasonStringFromPacific(toPacificTime(utcTime));
  }

  private String getSeasonStringFromPacific(LocalDateTime pacificTime) {
    if (pacificTime == null) return null;
    return YearMonth.from(pacificTime).toString();
  }

  /** Returns the player if found and not a bot, else null. */
  private Player loadActivePlayer(Long playerId) {
    if (playerId == null) return null;
    Player p = playerRepo.findById(playerId).orElse(null);
    return (p != null && p.isHuman()) ? p : null;
  }

  /**
   * Picks one of four query suppliers based on whether mode/date filters are present. Used to
   * collapse parallel if/else ladders that all branch on (hasMode, hasDate).
   */
  private <T> T queryByModeAndDate(
      boolean hasMode,
      boolean hasDate,
      Supplier<T> modeAndDate,
      Supplier<T> modeOnly,
      Supplier<T> dateOnly,
      Supplier<T> none) {
    if (hasMode && hasDate) return modeAndDate.get();
    if (hasMode) return modeOnly.get();
    if (hasDate) return dateOnly.get();
    return none.get();
  }

  public void reloadSettings() {
    this.participationBonus = loadParticipationBonus();
    evictAllCaches();
  }

  private double loadParticipationBonus() {
    return appSettingRepo
        .findById("participation_bonus")
        .map(
            s -> {
              try {
                return Double.parseDouble(s.getValue());
              } catch (NumberFormatException e) {
                log.warn("Invalid participation_bonus value '{}', using default", s.getValue());
                return 0.0;
              }
            })
        .orElse(0.0);
  }

  public List<Player> getAllPlayers() {
    return playerRepo.findAll();
  }

  public Player createPlayer(CreatePlayerRequest request) {
    if ("BOT".equalsIgnoreCase(request.getUserName())) {
      throw new IllegalArgumentException("Username 'BOT' is reserved");
    }
    if (playerRepo.existsByUserName(request.getUserName())) {
      log.warn("Duplicate userName '{}'", request.getUserName());
      throw new IllegalArgumentException(
          "Username '" + request.getUserName() + "' is already taken");
    }
    log.info(
        "Creating player userName='{}', name='{} {}'",
        request.getUserName(),
        request.getFirstName(),
        request.getLastName());
    try {
      return playerRepo.save(
          new Player(request.getUserName(), request.getFirstName(), request.getLastName()));
    } catch (DataIntegrityViolationException e) {
      throw new IllegalArgumentException(
          "Username '" + request.getUserName() + "' is already taken", e);
    }
  }

  public boolean isUserNameTaken(String userName) {
    return playerRepo.existsByUserName(userName);
  }

  public Player updatePlayer(Long id, String userName, String firstName, String lastName) {
    Player player =
        playerRepo
            .findById(Objects.requireNonNull(id))
            .orElseThrow(() -> new IllegalArgumentException("Player not found"));
    if (userName != null && !userName.isBlank()) {
      String trimmed = userName.trim();
      if ("BOT".equalsIgnoreCase(trimmed)) {
        throw new IllegalArgumentException("Username 'BOT' is reserved");
      }
      if (!trimmed.equalsIgnoreCase(player.getUserName())
          && playerRepo.existsByUserNameIgnoreCase(trimmed)) {
        throw new IllegalArgumentException("Username already taken");
      }
      player.setUserName(trimmed);
    }
    if (firstName != null && !firstName.isBlank()) {
      player.setFirstName(firstName.trim());
    }
    if (lastName != null && !lastName.isBlank()) {
      player.setLastName(lastName.trim());
    }
    log.info(
        "Updated player id={}, userName='{}', name='{} {}'",
        id,
        player.getUserName(),
        player.getFirstName(),
        player.getLastName());
    Player saved = playerRepo.save(player);
    evictAllCaches();
    return saved;
  }

  public void deletePlayer(Long id) {
    log.info("Deleting player id={}", id);

    List<GameSession> activeSessions =
        sessionRepo.findByPlayersPlayerIdOrderByCreatedAtDesc(id).stream()
            .filter(s -> s.getStatus() == SessionStatus.IN_PROGRESS)
            .toList();
    if (!activeSessions.isEmpty()) {
      log.warn("Cannot delete player id={}, in {} active game(s)", id, activeSessions.size());
      throw new IllegalStateException(
          "Cannot delete player who is in " + activeSessions.size() + " active game(s)");
    }

    roundScoreRepo.nullifyPlayerScores(id);
    gameSessionPlayerRepo.deleteByPlayerId(id);
    monthlySkillRepo.deleteByPlayerId(id);
    playerRepo.deleteById(Objects.requireNonNull(id));
    evictAllCaches();
  }

  @Transactional(readOnly = true)
  @Cacheable("sessionSummaries")
  public List<SessionSummaryResponse> getAllSessionSummaries() {
    List<GameSession> sessions = sessionRepo.findAllByOrderByCreatedAtDesc();
    Map<String, Map<Long, Tier>> tiersCache = new HashMap<>();
    return sessions.stream().map(s -> toSummary(s, tiersCache)).toList();
  }

  private String monthCacheKey(GameMode mode, LocalDateTime sessionUtc) {
    java.time.LocalDate pt =
        sessionUtc.atZone(ZONE_UTC).withZoneSameInstant(ZONE_PACIFIC).toLocalDate();
    return mode.name() + ":" + pt.getYear() + "-" + pt.getMonthValue();
  }

  private SessionSummaryResponse toSummary(GameSession s, Map<String, Map<Long, Tier>> tiersCache) {
    SessionSummaryResponse r = SessionSummaryResponse.from(s);
    GameMode mode = s.getGameMode();
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return r;
    List<Player> players =
        s.getPlayers().stream().map(GameSessionPlayer::getPlayer).filter(Objects::nonNull).toList();

    String key = monthCacheKey(mode, s.getCreatedAt());
    Map<Long, Tier> tiers =
        tiersCache.computeIfAbsent(
            key, k -> tierService.resolveTiersForDate(mode, s.getCreatedAt()));

    r.setTableStrength(tableStrengthService.compute(players, mode, tiers).getDisplayName());
    annotateRankingsTier(r.getRankings(), players, tiers, mode);
    return r;
  }

  private void annotateRankingsTier(
      List<PlayerPerformanceDTO> rankings,
      List<Player> players,
      Map<Long, Tier> tiers,
      GameMode mode) {
    if (rankings == null) return;
    Map<Long, Player> byId = new HashMap<>();
    for (Player p : players) byId.put(p.getId(), p);
    for (PlayerPerformanceDTO row : rankings) {
      Player p = byId.get(row.getPlayerId());
      if (p == null) continue;
      Tier t = tiers.get(p.getId());
      row.setTier((t != null ? t : tierService.computeTier(p, mode)).name());
    }
  }

  public List<GameSession> getAllSessions() {
    return sessionRepo.findAllByOrderByCreatedAtDesc();
  }

  public GameSession createSession(CreateSessionRequest request) {
    Map<Long, Player> playerMap = new HashMap<>();
    for (Player p : playerRepo.findAllById(Objects.requireNonNull(request.getPlayerIds()))) {
      playerMap.put(p.getId(), p);
    }
    if (playerMap.size() != request.getPlayerIds().size()) {
      throw new IllegalArgumentException("Some player IDs are invalid");
    }

    GameSession session = new GameSession();
    session.setName(request.getName());
    session.setGameMode(GameMode.valueOf(request.getGameMode()));
    session.setPlayerCount(request.getPlayerIds().size());
    session.setParticipationBonus(this.participationBonus);
    session = sessionRepo.save(session);

    int seat = 1;
    for (Long playerId : request.getPlayerIds()) {
      Player player = playerMap.get(playerId);
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(session);
      gsp.setPlayer(player);
      gsp.setSeat(seat++);
      session.getPlayers().add(gsp);
    }
    session = sessionRepo.save(session);
    log.info(
        "Created session id={} '{}' with {} players",
        session.getId(),
        session.getName(),
        session.getPlayerCount());
    evictAllCaches();
    return session;
  }

  public SessionDetailResponse getSessionDetail(Long sessionId) {
    GameSession session =
        sessionRepo
            .findById(Objects.requireNonNull(sessionId))
            .orElseThrow(() -> new NoSuchElementException("Session not found"));

    SessionDetailResponse resp = new SessionDetailResponse();
    resp.setId(session.getId());
    resp.setName(session.getName());
    resp.setGameMode(session.getGameMode().name());
    resp.setGameModeDisplayName(session.getGameMode().getDisplayName());
    resp.setPlayerCount(session.getPlayerCount());
    resp.setStatus(session.getStatus().name());
    resp.setCreatedAt(session.getCreatedAt());

    GameMode sessionMode = session.getGameMode();
    final Long sessionThroneId =
        (sessionMode == GameMode.GUOBIAO || sessionMode == GameMode.RIICHI)
            ? tierService.findThroneId(sessionMode)
            : null;

    resp.setPlayers(
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(
                gsp -> {
                  Player p = gsp.getPlayer();
                  SessionDetailResponse.PlayerInfo info =
                      new SessionDetailResponse.PlayerInfo(
                          p.getId(),
                          p.getUserName(),
                          p.getFirstName(),
                          p.getLastName(),
                          gsp.getSeat());
                  if (sessionMode == GameMode.GUOBIAO || sessionMode == GameMode.RIICHI) {
                    info.setTier(tierService.computeTier(p, sessionMode, sessionThroneId).name());
                  }
                  return info;
                })
            .collect(Collectors.toList()));

    if (sessionMode == GameMode.GUOBIAO || sessionMode == GameMode.RIICHI) {
      List<Player> players =
          session.getPlayers().stream()
              .map(GameSessionPlayer::getPlayer)
              .filter(Objects::nonNull)
              .toList();
      resp.setTableStrength(
          tableStrengthService
              .compute(players, sessionMode, session.getCreatedAt())
              .getDisplayName());
    }

    Map<Long, String> playerNameMap =
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .collect(
                Collectors.toMap(
                    gsp -> gsp.getPlayer().getId(), gsp -> gsp.getPlayer().getUserName()));

    resp.setRounds(
        session.getRounds().stream()
            .map(
                round -> {
                  Map<Long, Integer> scores =
                      round.getScores().stream()
                          .filter(rs -> rs.getPlayer() != null)
                          .collect(
                              Collectors.toMap(rs -> rs.getPlayer().getId(), RoundScore::getScore));

                  String dealInName = null;
                  if (round.getDealInPlayerId() != null) {
                    dealInName = playerNameMap.getOrDefault(round.getDealInPlayerId(), "?");
                  }

                  List<Long> riichiIds = null;
                  if (round.getRiichiPlayerIds() != null && !round.getRiichiPlayerIds().isBlank()) {
                    riichiIds =
                        Arrays.stream(round.getRiichiPlayerIds().split(","))
                            .map(String::trim)
                            .filter(s -> !s.isEmpty())
                            .map(Long::valueOf)
                            .toList();
                  }

                  return new SessionDetailResponse.RoundInfo(
                      round.getRoundNumber(),
                      scores,
                      round.getWinnerId(),
                      round.getWinHand(),
                      round.getFanDetails(),
                      round.getFanCount(),
                      round.getDealInPlayerId(),
                      dealInName,
                      round.getPrevalentWind(),
                      riichiIds,
                      round.getBackfill());
                })
            .collect(Collectors.toList()));

    Map<Long, Integer> totals = new HashMap<>();
    for (var round : session.getRounds()) {
      for (var rs : round.getScores()) {
        if (rs.getPlayer() != null) {
          totals.merge(rs.getPlayer().getId(), rs.getScore(), (a, b) -> a + b);
        }
      }
    }
    resp.setTotalScores(totals);
    resp.setRpFactor(session.getGameMode().getRpFactor());
    resp.setRpOrigin(session.getGameMode().getRpOrigin());
    resp.setUmaDist(session.getGameMode().getUmaDist(session.getPlayerCount()));
    resp.setParticipationBonus(
        session.getParticipationBonus() != null ? session.getParticipationBonus() : 0.0);
    resp.setPlayerBonuses(computeSessionPlayerBonuses(session));

    return resp;
  }

  /**
   * Computes per-player bonus contributed by this one session = tieredBonus + adminBonus +
   * fanDiscoveryBonus. Matches what getPlayerStats aggregates across all sessions. Returns empty
   * for sessions with no round scores (no bonus for empty sessions).
   */
  private Map<Long, Double> computeSessionPlayerBonuses(GameSession session) {
    Map<Long, Double> bonuses = new HashMap<>();

    List<Object[]> currentSessionScores = roundScoreRepo.getTotalScoresBySession(session.getId());
    if (currentSessionScores.isEmpty()) {
      return bonuses;
    }

    YearMonth seasonYm = YearMonth.from(toPacificTime(session.getCreatedAt()));
    LocalDateTime seasonStartUtc = toUtcTime(seasonYm.atDay(1).atStartOfDay());
    LocalDateTime seasonEndUtc = toUtcTime(seasonYm.plusMonths(1).atDay(1).atStartOfDay());

    List<GameSession> seasonSessions =
        sessionRepo.findCompletedInSeasonUpTo(
            session.getGameMode(), seasonStartUtc, seasonEndUtc, session.getCreatedAt());

    Map<Long, Integer> gameIndexUpToHere = new HashMap<>();
    if (!seasonSessions.isEmpty()) {
      List<Long> seasonSessionIds = seasonSessions.stream().map(GameSession::getId).toList();
      for (Object[] row : roundScoreRepo.getGamesPlayedPerPlayerInSessions(seasonSessionIds)) {
        if (row[0] != null) {
          gameIndexUpToHere.put((Long) row[0], ((Number) row[1]).intValue());
        }
      }
    }
    boolean currentIncluded =
        seasonSessions.stream().anyMatch(s -> s.getId().equals(session.getId()));

    double adminBonus =
        session.getParticipationBonus() != null ? session.getParticipationBonus() : 0.0;

    for (Object[] row : currentSessionScores) {
      if (row[0] == null) continue;
      Long pid = (Long) row[0];
      int idx = gameIndexUpToHere.getOrDefault(pid, 0);
      if (!currentIncluded) idx += 1;
      double tiered = idx <= 10 ? 10.0 : idx <= 20 ? 5.0 : 0.0;
      bonuses.merge(pid, tiered + adminBonus, Double::sum);
    }

    if (session.getGameMode() == GameMode.GUOBIAO) {
      for (FanDiscovery fd : fanDiscoveryRepo.findByRoundGameSessionId(session.getId())) {
        if (fd.getBonusRp() > 0 && fd.getPlayer() != null) {
          bonuses.merge(fd.getPlayer().getId(), fd.getBonusRp(), Double::sum);
        }
      }
    }

    return bonuses;
  }

  public void addRound(Long sessionId, AddRoundRequest request) {
    GameSession session =
        sessionRepo
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));

    if (session.getStatus() == SessionStatus.COMPLETED) {
      log.warn("Attempted to add round to completed session id={}", sessionId);
      throw new IllegalStateException("Cannot add rounds to a completed session");
    }

    List<Long> sessionPlayerIds =
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(gsp -> gsp.getPlayer().getId())
            .toList();

    // Common validation for WIN rounds
    if (!request.isDrawnGame()) {
      if (request.getWinnerId() == null) {
        throw new IllegalArgumentException("Winner is required");
      }
      if (!sessionPlayerIds.contains(request.getWinnerId())) {
        throw new IllegalArgumentException("Winner is not in this session");
      }
      if (!request.isSelfDraw() && !sessionPlayerIds.contains(request.getDealInPlayerId())) {
        throw new IllegalArgumentException("Deal-in player is not in this session");
      }
      if (!request.isSelfDraw() && request.getWinnerId().equals(request.getDealInPlayerId())) {
        throw new IllegalArgumentException("Winner and deal-in player cannot be the same");
      }
    }

    GameModeHandler handler = getHandler(session.getGameMode());
    Map<Long, Integer> computedScores = handler.calculateRoundScores(request, sessionPlayerIds);

    int nextRoundNumber = roundRepo.countByGameSessionId(sessionId) + 1;
    log.info(
        "Adding round {} to session id={}, type={}, mode={}",
        nextRoundNumber,
        sessionId,
        request.getParsedRoundType(),
        session.getGameMode());

    saveRoundScores(
        session,
        nextRoundNumber,
        computedScores,
        request.getWinnerId(),
        request.getWinHand(),
        request.getFanDetails(),
        request.getFanCount(),
        request.isSelfDraw() ? null : request.getDealInPlayerId(),
        request.getPrevalentWind(),
        request.getRiichiPlayerIds(),
        request.getBackfill());
    evictAllCaches();
  }

  public void deleteRound(Long sessionId, int roundNumber) {
    log.info("Deleting round {} from session id={}", roundNumber, sessionId);
    GameSession session =
        sessionRepo
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));

    Round round =
        session.getRounds().stream()
            .filter(r -> r.getRoundNumber() == roundNumber)
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Round not found"));

    session.getRounds().remove(round);
    roundRepo.delete(Objects.requireNonNull(round));

    int num = 1;
    for (Round r : session.getRounds()) {
      r.setRoundNumber(num++);
    }
    sessionRepo.save(session);
    evictAllCaches();
  }

  public void completeSession(Long sessionId) {
    GameSession session =
        sessionRepo
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));
    if (session.getStatus() == SessionStatus.COMPLETED) {
      // Idempotency guard: a retry would otherwise re-apply ELO + games + peak twice.
      log.info("Session id={} already COMPLETED, skipping tier update", sessionId);
      return;
    }
    session.setStatus(SessionStatus.COMPLETED);
    sessionRepo.save(session);

    // Update hidden skill ratings (国标 / 立直 only).
    Map<Long, Integer> totals = new HashMap<>();
    for (Object[] row : roundScoreRepo.getTotalScoresBySession(sessionId)) {
      if (row[0] != null) totals.put((Long) row[0], ((Number) row[1]).intValue());
    }
    tierService.onSessionCompleted(session, totals);

    log.info("Completed session id={}", sessionId);
    evictAllCaches();
  }

  public void deleteSession(Long sessionId) {
    GameSession session =
        sessionRepo
            .findById(Objects.requireNonNull(sessionId))
            .orElseThrow(() -> new NoSuchElementException("Session not found"));
    GameMode mode = session.getGameMode();
    LocalDateTime sessionTime = session.getCreatedAt();
    sessionRepo.delete(session);
    log.info("Deleted session id={}", sessionId);
    rederiveDiscoveriesForSeason(mode, sessionTime);
    evictAllCaches();
  }

  private void rederiveDiscoveriesForSeason(GameMode mode, LocalDateTime sessionTime) {
    if (mode != GameMode.GUOBIAO) return;
    LocalDateTime pacificTime = toPacificTime(sessionTime);
    YearMonth ym = YearMonth.from(pacificTime);
    LocalDateTime startPacific = ym.atDay(1).atStartOfDay();
    LocalDateTime endPacific = ym.plusMonths(1).atDay(1).atStartOfDay();
    LocalDateTime startUtc = toUtcTime(startPacific);
    LocalDateTime endUtc = toUtcTime(endPacific);
    String season = ym.toString();
    int rederived = 0;
    for (Round round :
        roundRepo.findByGameModeAndSessionDateRangeOrderByTime(mode, startUtc, endUtc)) {
      if (round.getWinnerId() == null || round.getFanDetails() == null) continue;
      Player winner = loadActivePlayer(round.getWinnerId());
      if (winner == null) continue;
      rederived +=
          processFanDiscoveries(
              round.getFanDetails(),
              season,
              winner,
              round,
              round.getWinHand(),
              round.getGameSession().getCreatedAt());
    }
    log.info("Re-derived {} fan discoveries for season '{}' mode={}", rederived, season, mode);
  }

  /**
   * Retrieves the best rounds for the specified game mode and date range.
   *
   * @param gameMode the game mode to filter by, or null for all
   * @param start the start date-time, expected in Pacific timezone (or UTC with Pacific conversion)
   * @param end the end date-time, expected in Pacific timezone (or UTC with Pacific conversion)
   * @return the list of best round responses
   *     <p>Note: Callers must supply start/end in Pacific timezone. If start/end are null, it falls
   *     back to searching all-time best rounds without date range filters.
   */
  public List<BestRoundResponse> getBestRounds(
      GameMode gameMode, LocalDateTime start, LocalDateTime end) {
    boolean hasMode = gameMode != null;
    boolean hasDate = start != null && end != null;
    LocalDateTime startUtc = toUtcTime(start);
    LocalDateTime endUtc = toUtcTime(end);

    Integer maxFan =
        queryByModeAndDate(
            hasMode,
            hasDate,
            () -> roundRepo.findMaxFanCountByModeAndDateRange(gameMode, startUtc, endUtc),
            () -> roundRepo.findMaxFanCountByMode(gameMode),
            () -> roundRepo.findMaxFanCountByDateRange(startUtc, endUtc),
            () -> roundRepo.findMaxFanCount());

    if (maxFan == null || maxFan == 0) return Collections.emptyList();

    final Integer fan = maxFan;
    List<Round> bestRounds =
        queryByModeAndDate(
            hasMode,
            hasDate,
            () -> roundRepo.findByFanCountAndModeAndDateRange(fan, gameMode, startUtc, endUtc),
            () -> roundRepo.findByFanCountAndMode(fan, gameMode),
            () -> roundRepo.findByFanCountAndDateRange(fan, startUtc, endUtc),
            () -> roundRepo.findByFanCount(fan));

    if (bestRounds.isEmpty()) return Collections.emptyList();

    // Batch-fetch all referenced players in a single query to avoid N+1 lookups
    // (one findById per winner + dealInPlayer per row).
    Set<Long> playerIds = new HashSet<>();
    for (Round r : bestRounds) {
      if (r.getWinnerId() != null) playerIds.add(r.getWinnerId());
      if (r.getDealInPlayerId() != null) playerIds.add(r.getDealInPlayerId());
    }
    Map<Long, String> userNameById = new HashMap<>();
    for (Player p : playerRepo.findAllById(playerIds)) {
      userNameById.put(p.getId(), p.getUserName());
    }

    return bestRounds.stream()
        .map(
            round -> {
              Map<Long, Integer> scores =
                  round.getScores().stream()
                      .filter(rs -> rs.getPlayer() != null)
                      .collect(
                          Collectors.toMap(rs -> rs.getPlayer().getId(), RoundScore::getScore));

              String winnerName =
                  round.getWinnerId() != null
                      ? userNameById.getOrDefault(round.getWinnerId(), "?")
                      : null;

              Long dealInId = round.getDealInPlayerId();
              String dealInName =
                  dealInId != null ? userNameById.getOrDefault(dealInId, "?") : null;

              return new BestRoundResponse(
                  round.getGameSession().getId(),
                  round.getRoundNumber(),
                  round.getWinnerId(),
                  winnerName,
                  round.getWinHand(),
                  round.getFanDetails(),
                  round.getFanCount(),
                  scores,
                  dealInId,
                  dealInName);
            })
        .collect(Collectors.toList());
  }

  @Cacheable("activeSeasons")
  public List<Map<String, Integer>> getActiveSeasons() {
    List<LocalDateTime> creationTimes = sessionRepo.findSessionCreationTimesWithRounds();
    Set<YearMonth> seasons = new TreeSet<>(Comparator.reverseOrder());
    for (LocalDateTime time : creationTimes) {
      seasons.add(YearMonth.from(toPacificTime(time)));
    }

    return seasons.stream()
        .map(
            ym -> {
              Map<String, Integer> m = new LinkedHashMap<>();
              m.put("year", ym.getYear());
              m.put("month", ym.getMonthValue());
              return m;
            })
        .collect(Collectors.toList());
  }

  /**
   * Aggregates everything HomePage needs in a single call: in-progress sessions (with full detail)
   * and per-mode rankings (top 3 by RP + best round). Replaces 1 + N + 2M frontend round-trips with
   * one response.
   */
  @Cacheable("homeSummary")
  public HomeSummaryResponse getHomeSummary(LocalDateTime start, LocalDateTime end) {
    List<SessionDetailResponse> activeSessions =
        sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.IN_PROGRESS).stream()
            .map(s -> getSessionDetail(s.getId()))
            .collect(Collectors.toList());

    Map<String, HomeSummaryResponse.ModeRanking> rankings = new LinkedHashMap<>();
    for (GameMode mode : GameMode.values()) {
      List<PlayerStatsResponse> stats = getPlayerStats(mode, start, end);
      stats.sort((a, b) -> Double.compare(b.getTotalRP(), a.getTotalRP()));
      List<PlayerStatsResponse> top = stats.subList(0, Math.min(3, stats.size()));

      List<BestRoundResponse> bests = getBestRounds(mode, start, end);
      BestRoundResponse best = bests.isEmpty() ? null : bests.get(0);

      rankings.put(mode.name(), new HomeSummaryResponse.ModeRanking(top, best));
    }

    return new HomeSummaryResponse(activeSessions, rankings);
  }

  /**
   * Retrieves player stats for the specified game mode and date range.
   *
   * @param gameMode the game mode (e.g. GUOBIAO) to filter by, or null for all
   * @param start the start date-time, expected in Pacific timezone (or UTC with Pacific conversion)
   * @param end the end date-time, expected in Pacific timezone (or UTC with Pacific conversion)
   * @return the list of player stats responses
   *     <p>Note: Callers must supply start/end in Pacific timezone. If start/end are null, it falls
   *     back to returning all-time statistics. The season string is derived consistently using
   *     getSeasonStringFromUtc.
   */
  @Cacheable("playerStats")
  public List<PlayerStatsResponse> getPlayerStats(
      GameMode gameMode, LocalDateTime start, LocalDateTime end) {
    List<Player> players = playerRepo.findAll();
    boolean hasDateRange = start != null && end != null;
    LocalDateTime startUtc = toUtcTime(start);
    LocalDateTime endUtc = toUtcTime(end);

    // Historical tier snapshot lookup — only for past PT months in GUOBIAO/RIICHI.
    // Current/future months keep using live Player state (no snapshot exists yet).
    Map<Long, TierService.MonthlyTierInfo> historicalTiers = null;
    if (hasDateRange && (gameMode == GameMode.GUOBIAO || gameMode == GameMode.RIICHI)) {
      YearMonth queryMonth = YearMonth.of(start.getYear(), start.getMonthValue());
      YearMonth currentPtMonth = YearMonth.from(java.time.LocalDate.now(ZONE_PACIFIC));
      if (queryMonth.isBefore(currentPtMonth)) {
        historicalTiers =
            tierService.computeMonthlySnapshotTiers(
                gameMode, queryMonth.getYear(), queryMonth.getMonthValue());
      }
    }
    final Map<Long, TierService.MonthlyTierInfo> historicalTiersFinal = historicalTiers;

    final Long liveThroneId =
        (historicalTiers == null && (gameMode == GameMode.GUOBIAO || gameMode == GameMode.RIICHI))
            ? tierService.findThroneId(gameMode)
            : null;

    Map<Long, Integer> totalScores = new HashMap<>();
    Map<Long, Integer> gamesPlayed = new HashMap<>();
    Map<Long, Integer> wins = new HashMap<>();
    Map<Long, Integer> totalRanks = new HashMap<>();
    Map<Long, Integer> fourthPlaces = new HashMap<>();
    Map<Long, Double> totalRP = new HashMap<>();
    Map<Long, Double> tieredBonusPerPlayer = new HashMap<>();
    Map<Long, Double> adminBonusPerPlayer = new HashMap<>();
    Map<Long, Double> fanBonusPerPlayer = new HashMap<>();
    Map<Long, Integer> roundsPlayed = new HashMap<>();
    Map<Long, Integer> handWins = new HashMap<>();
    Map<Long, Integer> tsumoWins = new HashMap<>();
    Map<Long, Integer> dealIns = new HashMap<>();
    Map<Long, Integer> winPointsSum = new HashMap<>();
    Map<Long, Integer> dealInPointsSum = new HashMap<>();
    List<GameSession> completedSessions =
        sessionRepo.findAll().stream()
            .filter(s -> s.getStatus() == SessionStatus.COMPLETED)
            .filter(s -> gameMode == null || s.getGameMode() == gameMode)
            .filter(
                s ->
                    !hasDateRange
                        || (!s.getCreatedAt().isBefore(startUtc)
                            && s.getCreatedAt().isBefore(endUtc)))
            .sorted(Comparator.comparing(GameSession::getCreatedAt))
            .toList();

    // Tracks chronological game count per (season, mode, player) for tiered bonus.
    // Keyed separately by mode so each game mode has its own 20-game tier per season.
    Map<String, Map<Long, Integer>> gameIndexBySeasonModePlayer = new HashMap<>();

    // Add Fan Discovery Bonuses (GUOBIAO only)
    if (gameMode == null || gameMode == GameMode.GUOBIAO) {
      if (hasDateRange) {
        // Callers supply start in Pacific timezone; convert to UTC to consistently derive season
        String season = getSeasonStringFromUtc(startUtc);
        List<FanDiscovery> discoveries = fanDiscoveryRepo.findBySeason(season);
        for (FanDiscovery fd : discoveries) {
          if (fd.getBonusRp() > 0) {
            fanBonusPerPlayer.merge(fd.getPlayer().getId(), fd.getBonusRp(), (a, b) -> a + b);
          }
        }
      } else {
        // All-time: Sum bonuses from all seasons
        List<FanDiscovery> allDiscoveries = fanDiscoveryRepo.findAll();
        for (FanDiscovery fd : allDiscoveries) {
          if (fd.getBonusRp() > 0) {
            fanBonusPerPlayer.merge(fd.getPlayer().getId(), fd.getBonusRp(), (a, b) -> a + b);
          }
        }
      }
    }

    // Bulk-load total scores per session — replaces N+1 calls to getTotalScoresBySession.
    Map<Long, List<Object[]>> scoresBySessionId = new HashMap<>();
    if (!completedSessions.isEmpty()) {
      List<Long> sessionIds = completedSessions.stream().map(GameSession::getId).toList();
      for (Object[] row : roundScoreRepo.getTotalScoresBySessions(sessionIds)) {
        Long sid = (Long) row[0];
        // Reshape into [playerId, score] tuples to keep the existing inner-loop format.
        scoresBySessionId
            .computeIfAbsent(sid, k -> new ArrayList<>())
            .add(new Object[] {row[1], row[2]});
      }
    }

    // Bulk-load round details for ALL completed sessions in scope — one SQL — feeds the round-level
    // metrics (和牌率/放铳率/自摸率/平均打点/平均铳点).
    Map<Long, List<Object[]>> roundsBySessionId = new HashMap<>();
    List<Long> allSessionIds = completedSessions.stream().map(GameSession::getId).toList();
    if (!allSessionIds.isEmpty()) {
      for (Object[] row : roundScoreRepo.getRoundDetailsBySessions(allSessionIds)) {
        Long sid = (Long) row[0];
        // Drop the leading sessionId so the per-session shape matches accumulateRoundStats.
        roundsBySessionId
            .computeIfAbsent(sid, k -> new ArrayList<>())
            .add(new Object[] {row[1], row[2], row[3], row[4], row[5]});
      }
    }

    for (GameSession session : completedSessions) {
      List<Object[]> sessionScores = scoresBySessionId.getOrDefault(session.getId(), List.of());
      if (!sessionScores.isEmpty()) {
        String season = getSeasonStringFromUtc(session.getCreatedAt());
        String seasonModeKey = season + ":" + session.getGameMode().name();
        Map<Long, Integer> seasonCounts =
            gameIndexBySeasonModePlayer.computeIfAbsent(seasonModeKey, k -> new HashMap<>());
        double adminBonus =
            session.getParticipationBonus() != null ? session.getParticipationBonus() : 0.0;
        for (Object[] row : sessionScores) {
          if (row[0] != null) {
            Long playerId = (Long) row[0];
            int score = ((Number) row[1]).intValue();

            // Accumulate gamesPlayed and totalScores dynamically so they share the same
            // session set as wins/bonuses below (otherwise mode-or-date-only filters can
            // mix all-time totals with date-filtered wins).
            gamesPlayed.merge(playerId, 1, Integer::sum);
            totalScores.merge(playerId, score, Integer::sum);

            int gameIndex = seasonCounts.merge(playerId, 1, Integer::sum);
            double tieredBonus;
            if (gameIndex <= 10) {
              tieredBonus = 10.0;
            } else if (gameIndex <= 20) {
              tieredBonus = 5.0;
            } else {
              tieredBonus = 0.0;
            }
            tieredBonusPerPlayer.merge(playerId, tieredBonus, (a, b) -> a + b);
            adminBonusPerPlayer.merge(playerId, adminBonus, (a, b) -> a + b);
          }
        }
        List<Object[]> sorted = new ArrayList<>(sessionScores);
        sorted.sort((a, b) -> ((Number) b[1]).intValue() - ((Number) a[1]).intValue());

        Map<Long, Integer> scoreMap = new LinkedHashMap<>();
        for (Object[] row : sorted) {
          if (row[0] != null) {
            scoreMap.put((Long) row[0], ((Number) row[1]).intValue());
          }
        }

        List<RpCalculator.RankEntry> ranked =
            RpCalculator.rankPlayers(
                scoreMap,
                session.getGameMode().getRpFactor(),
                session.getGameMode().getUmaDist(session.getPlayerCount()));

        for (var entry : ranked) {
          totalRP.merge(entry.playerId(), entry.rp(), (a, b) -> a + b);
          totalRanks.merge(entry.playerId(), entry.rank(), Integer::sum);
          if (entry.rank() == 4) fourthPlaces.merge(entry.playerId(), 1, Integer::sum);
        }

        int topScore = ((Number) sorted.get(0)[1]).intValue();
        for (Object[] row : sorted) {
          if (((Number) row[1]).intValue() != topScore) break;
          if (row[0] != null) wins.merge((Long) row[0], 1, (a, b) -> a + b);
        }

        // Round-level metrics (和牌率/放铳率/自摸率/平均打点/平均铳点) collected for all modes.
        List<Object[]> rows = roundsBySessionId.getOrDefault(session.getId(), List.of());
        accumulateRoundStats(
            rows, roundsPlayed, handWins, tsumoWins, dealIns, winPointsSum, dealInPointsSum);
      }
    }

    return players.stream()
        .filter(Player::isHuman)
        .map(
            p -> {
              PlayerStatsResponse stat = new PlayerStatsResponse();
              stat.setPlayerId(p.getId());
              stat.setUserName(p.getUserName());
              stat.setDisplayName(p.getDisplayName());
              stat.setGamesPlayed(gamesPlayed.getOrDefault(p.getId(), 0));
              stat.setTotalScore(totalScores.getOrDefault(p.getId(), 0));
              stat.setWins(wins.getOrDefault(p.getId(), 0));
              stat.setFourthPlaces(fourthPlaces.getOrDefault(p.getId(), 0));
              double baseRP = totalRP.getOrDefault(p.getId(), 0.0);
              double tieredBonus = tieredBonusPerPlayer.getOrDefault(p.getId(), 0.0);
              double adminBonus = adminBonusPerPlayer.getOrDefault(p.getId(), 0.0);
              double fanBonus = fanBonusPerPlayer.getOrDefault(p.getId(), 0.0);
              double total = baseRP + tieredBonus + adminBonus + fanBonus;
              stat.setBaseRP(baseRP);
              stat.setTieredBonus(tieredBonus);
              stat.setAdminBonus(adminBonus);
              stat.setFanDiscoveryBonus(fanBonus);
              stat.setTotalRP(total);
              int games = gamesPlayed.getOrDefault(p.getId(), 0);
              stat.setAvgScore(games > 0 ? total / games : 0);
              stat.setAvgRank(
                  games > 0 ? (double) totalRanks.getOrDefault(p.getId(), 0) / games : 0);

              int rounds = roundsPlayed.getOrDefault(p.getId(), 0);
              int hw = handWins.getOrDefault(p.getId(), 0);
              int di = dealIns.getOrDefault(p.getId(), 0);
              stat.setRoundsPlayed(rounds);
              stat.setHandWins(hw);
              stat.setTsumoWins(tsumoWins.getOrDefault(p.getId(), 0));
              stat.setDealIns(di);
              stat.setAvgWinPoints(
                  hw > 0 ? (double) winPointsSum.getOrDefault(p.getId(), 0) / hw : 0);
              stat.setAvgDealInPoints(
                  di > 0 ? (double) dealInPointsSum.getOrDefault(p.getId(), 0) / di : 0);

              // Tier in the queried mode (only GUOBIAO/RIICHI track ratings; DONGBEI gets null).
              if (gameMode == GameMode.GUOBIAO || gameMode == GameMode.RIICHI) {
                if (historicalTiersFinal != null) {
                  TierService.MonthlyTierInfo info = historicalTiersFinal.get(p.getId());
                  if (info != null) {
                    stat.setTier(info.tier().name());
                    stat.setSkillRating(info.skillRating());
                    stat.setGamesNeeded(info.gamesNeeded());
                  } else {
                    stat.setTier(Tier.UNRANKED.name());
                    stat.setSkillRating(0);
                    stat.setGamesNeeded(TierService.RANKED_MIN_GAMES);
                  }
                } else {
                  Tier liveTier = tierService.computeTier(p, gameMode, liveThroneId);
                  int lifetimeGames =
                      gameMode == GameMode.GUOBIAO ? p.getGamesGuobiao() : p.getGamesRiichi();
                  stat.setTier(liveTier.name());
                  stat.setSkillRating(
                      gameMode == GameMode.GUOBIAO ? p.getSkillGuobiao() : p.getSkillRiichi());
                  stat.setGamesNeeded(
                      liveTier == Tier.UNRANKED
                          ? Math.max(0, TierService.RANKED_MIN_GAMES - lifetimeGames)
                          : 0);
                }
              } else {
                stat.setTier(null);
                stat.setSkillRating(0);
                stat.setGamesNeeded(0);
              }
              return stat;
            })
        .collect(Collectors.toList());
  }

  /**
   * Walks one Riichi session's per-(round × player) score rows and bumps the four metric maps.
   * roundsPlayed counts each round-participant pair once; handWins/avgWinPoints land on the
   * round.winnerId; dealIns/avgDealInPoints land on the round.dealInPlayerId (self-draws are
   * dealInPlayerId == null, so no deal-in is recorded for those rounds).
   */
  private void accumulateRoundStats(
      List<Object[]> rows,
      Map<Long, Integer> roundsPlayed,
      Map<Long, Integer> handWins,
      Map<Long, Integer> tsumoWins,
      Map<Long, Integer> dealIns,
      Map<Long, Integer> winPointsSum,
      Map<Long, Integer> dealInPointsSum) {
    Set<Long> seenRounds = new HashSet<>();
    for (Object[] row : rows) {
      Long roundId = (Long) row[0];
      Long winnerId = (Long) row[1];
      Long dealInPlayerId = (Long) row[2];
      Long playerId = (Long) row[3];
      int score = ((Number) row[4]).intValue();

      roundsPlayed.merge(playerId, 1, Integer::sum);

      if (seenRounds.add(roundId)) {
        if (winnerId != null) {
          handWins.merge(winnerId, 1, Integer::sum);
          // 自摸 (self-draw): win with no deal-in player. 荣和 = handWins - tsumoWins.
          if (dealInPlayerId == null) {
            tsumoWins.merge(winnerId, 1, Integer::sum);
          }
        }
        if (dealInPlayerId != null) {
          dealIns.merge(dealInPlayerId, 1, Integer::sum);
        }
      }

      if (playerId.equals(winnerId) && score > 0) {
        winPointsSum.merge(playerId, score, Integer::sum);
      }
      if (playerId.equals(dealInPlayerId) && score < 0) {
        dealInPointsSum.merge(playerId, -score, Integer::sum);
      }
    }
  }

  public PlayerDetailResponse getPlayerDetail(Long playerId) {
    Player player =
        playerRepo
            .findById(Objects.requireNonNull(playerId))
            .orElseThrow(() -> new NoSuchElementException("Player not found"));

    List<GameSession> sessions = sessionRepo.findByPlayersPlayerIdOrderByCreatedAtDesc(playerId);

    // Bulk-load this player's score per session — replaces N+1 calls to getTotalScoresBySession.
    Map<Long, Integer> scoreBySession = new HashMap<>();
    if (!sessions.isEmpty()) {
      List<Long> sessionIds = sessions.stream().map(GameSession::getId).toList();
      for (Object[] row : roundScoreRepo.getTotalScoresBySessions(sessionIds)) {
        if (row[1] != null && ((Long) row[1]).equals(playerId)) {
          scoreBySession.put((Long) row[0], ((Number) row[2]).intValue());
        }
      }
    }

    List<PlayerDetailResponse.GameEntry> games =
        sessions.stream()
            .map(
                session -> {
                  PlayerDetailResponse.GameEntry entry = new PlayerDetailResponse.GameEntry();
                  entry.setSessionId(session.getId());
                  entry.setSessionName(session.getName());
                  entry.setGameMode(session.getGameMode().name());
                  entry.setGameModeDisplayName(session.getGameMode().getDisplayName());
                  entry.setStatus(session.getStatus().name());
                  entry.setCreatedAt(session.getCreatedAt());
                  entry.setTotalScore(scoreBySession.getOrDefault(session.getId(), 0));
                  return entry;
                })
            .collect(Collectors.toList());

    PlayerDetailResponse resp = new PlayerDetailResponse();
    resp.setPlayerId(player.getId());
    resp.setUserName(player.getUserName());
    resp.setFirstName(player.getFirstName());
    resp.setLastName(player.getLastName());
    resp.setGames(games);
    resp.setStatsByMode(computeModeStats(playerId, sessions));
    return resp;
  }

  /**
   * Per-mode round-level metrics (和牌率/放铳率/平均打点/平均铳点) for a single player, scoped to that player's
   * own completed sessions. Cheaper than {@link #getPlayerStats} which aggregates the whole table.
   * Only modes in which the player actually has rounds are included.
   */
  private Map<String, PlayerDetailResponse.ModeStats> computeModeStats(
      Long playerId, List<GameSession> sessions) {
    List<GameSession> completed =
        sessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).toList();
    if (completed.isEmpty()) return Map.of();

    Map<Long, GameMode> modeBySession = new HashMap<>();
    for (GameSession s : completed) modeBySession.put(s.getId(), s.getGameMode());

    // Partition round-detail rows by mode, reshaping to the [roundId, winnerId, dealInPlayerId,
    // playerId, score] tuple that accumulateRoundStats expects (dropping the leading sessionId).
    Map<GameMode, List<Object[]>> rowsByMode = new EnumMap<>(GameMode.class);
    List<Long> ids = completed.stream().map(GameSession::getId).toList();
    for (Object[] row : roundScoreRepo.getRoundDetailsBySessions(ids)) {
      GameMode mode = modeBySession.get((Long) row[0]);
      if (mode == null) continue;
      rowsByMode
          .computeIfAbsent(mode, k -> new ArrayList<>())
          .add(new Object[] {row[1], row[2], row[3], row[4], row[5]});
    }

    Map<String, PlayerDetailResponse.ModeStats> statsByMode = new HashMap<>();
    for (var entry : rowsByMode.entrySet()) {
      Map<Long, Integer> roundsPlayed = new HashMap<>();
      Map<Long, Integer> handWins = new HashMap<>();
      Map<Long, Integer> tsumoWins = new HashMap<>();
      Map<Long, Integer> dealIns = new HashMap<>();
      Map<Long, Integer> winPointsSum = new HashMap<>();
      Map<Long, Integer> dealInPointsSum = new HashMap<>();
      accumulateRoundStats(
          entry.getValue(),
          roundsPlayed,
          handWins,
          tsumoWins,
          dealIns,
          winPointsSum,
          dealInPointsSum);

      int rounds = roundsPlayed.getOrDefault(playerId, 0);
      if (rounds == 0) continue;
      int hw = handWins.getOrDefault(playerId, 0);
      int di = dealIns.getOrDefault(playerId, 0);

      PlayerDetailResponse.ModeStats ms = new PlayerDetailResponse.ModeStats();
      ms.setRoundsPlayed(rounds);
      ms.setHandWins(hw);
      ms.setTsumoWins(tsumoWins.getOrDefault(playerId, 0));
      ms.setDealIns(di);
      ms.setAvgWinPoints(hw > 0 ? (double) winPointsSum.getOrDefault(playerId, 0) / hw : 0);
      ms.setAvgDealInPoints(di > 0 ? (double) dealInPointsSum.getOrDefault(playerId, 0) / di : 0);
      statsByMode.put(entry.getKey().name(), ms);
    }
    return statsByMode;
  }

  private GameModeHandler getHandler(GameMode mode) {
    GameModeHandler handler = handlers.get(mode);
    if (handler == null) {
      throw new IllegalArgumentException("Unsupported game mode: " + mode);
    }
    return handler;
  }

  private void saveRoundScores(
      GameSession session,
      int roundNumber,
      Map<Long, Integer> computedScores,
      Long winnerId,
      String winHand,
      String fanDetails,
      Integer fanCount,
      Long dealInId,
      Integer prevalentWind,
      List<Long> riichiPlayerIds,
      Boolean backfill) {
    Round round = new Round();
    round.setGameSession(session);
    round.setRoundNumber(roundNumber);
    round.setWinnerId(winnerId);
    round.setWinHand(winHand);
    round.setFanDetails(fanDetails);
    round.setFanCount(fanCount);
    round.setDealInPlayerId(dealInId);
    round.setPrevalentWind(prevalentWind);
    round.setBackfill(Boolean.TRUE.equals(backfill) ? true : null);
    if (riichiPlayerIds != null && !riichiPlayerIds.isEmpty()) {
      round.setRiichiPlayerIds(
          riichiPlayerIds.stream().map(String::valueOf).collect(Collectors.joining(",")));
    }

    round = roundRepo.save(round);

    for (Map.Entry<Long, Integer> entry : computedScores.entrySet()) {
      Player player =
          playerRepo
              .findById(Objects.requireNonNull(entry.getKey()))
              .orElseThrow(() -> new NoSuchElementException("Player not found: " + entry.getKey()));
      RoundScore rs = new RoundScore();
      rs.setRound(round);
      rs.setPlayer(player);
      rs.setScore(entry.getValue());
      roundScoreRepo.save(rs);
    }

    // Process Fan Discoveries (GUOBIAO only, skip BOT winners, skip chombo)
    if (winnerId != null
        && fanDetails != null
        && !fanDetails.isBlank()
        && session.getGameMode() == GameMode.GUOBIAO) {
      Integer winnerScoreChange = computedScores.get(winnerId);
      if (winnerScoreChange != null && winnerScoreChange > 0) {
        Player winner = loadActivePlayer(winnerId);
        if (winner != null) {
          String season = getSeasonStringFromUtc(session.getCreatedAt());
          processFanDiscoveries(fanDetails, season, winner, round, winHand, session.getCreatedAt());
        }
      }
    }
  }

  private int processFanDiscoveries(
      String fanDetails,
      String season,
      Player winner,
      Round round,
      String winHand,
      LocalDateTime discoveryTime) {
    int count = 0;
    String[] parts = fanDetails.split(",\\s*");
    for (String p : parts) {
      String trimmedPart = p.trim();
      if (trimmedPart.isEmpty()) continue;

      int bracketIdx = trimmedPart.indexOf('(');
      String fanName = bracketIdx != -1 ? trimmedPart.substring(0, bracketIdx).trim() : trimmedPart;

      if (fanDiscoveryRepo.findBySeasonAndFanNameAndPlayerBotFalse(season, fanName).isEmpty()) {
        try {
          int fanScore = 0;
          if (bracketIdx != -1) {
            int endBracket = trimmedPart.indexOf(')', bracketIdx);
            if (endBracket != -1) {
              String scorePart = trimmedPart.substring(bracketIdx + 1, endBracket);
              try {
                fanScore = Integer.parseInt(scorePart.split("x")[0]);
              } catch (NumberFormatException e) {
                // ignore
              }
            }
          }
          double bonusRp = fanScore >= 8 ? fanScore / 2.0 : 0.0;

          FanDiscovery fd =
              new FanDiscovery(fanName, season, winner, round, winHand, bonusRp, discoveryTime);
          fanDiscoveryRepo.save(fd);
          count++;
          log.info(
              "Fan Discovered: '{}' in season '{}' by player '{}' at {}",
              fanName,
              season,
              winner.getUserName(),
              discoveryTime);
        } catch (DataIntegrityViolationException e) {
          log.debug("Discovery already exists: '{}' in season '{}'", fanName, season);
        }
      }
    }
    return count;
  }

  /**
   * Retrieves fan discoveries for the specified season range derived from start and end.
   *
   * @param start the start date-time of the season range, expected in Pacific timezone (or UTC with
   *     Pacific conversion)
   * @param end the end date-time of the season range, expected in Pacific timezone (or UTC with
   *     Pacific conversion)
   * @return the list of fan discovery responses
   *     <p>Note: Callers must supply start/end in Pacific timezone. Under the hood,
   *     getSeasonStringFromUtc (which converts UTC to Pacific time and calls
   *     getSeasonStringFromPacific) is used to derive the season from the converted start
   *     date-time. If start/end are null, it falls back to retrieving all fan discoveries
   *     (findAll).
   */
  public List<FanDiscoveryResponse> getFanDiscoveries(LocalDateTime start, LocalDateTime end) {
    List<FanDiscovery> discoveries;
    if (start != null && end != null) {
      String season = getSeasonStringFromUtc(toUtcTime(start));
      discoveries = fanDiscoveryRepo.findBySeason(season);
    } else {
      discoveries = fanDiscoveryRepo.findAll();
    }

    return discoveries.stream()
        .filter(fd -> fd.getPlayer().isHuman())
        .map(
            fd ->
                new FanDiscoveryResponse(
                    fd.getFanName(),
                    fd.getPlayer().getId(),
                    fd.getPlayer().getUserName(),
                    fd.getExampleHand(),
                    fd.getDiscoveredAt(),
                    fd.getBonusRp(),
                    fd.getSeason()))
        .collect(Collectors.toList());
  }
}
