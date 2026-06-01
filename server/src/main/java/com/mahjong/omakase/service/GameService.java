package com.mahjong.omakase.service;

import com.mahjong.omakase.dto.*;
import com.mahjong.omakase.model.*;
import com.mahjong.omakase.repository.*;
import com.mahjong.omakase.service.handler.GameModeHandler;
import com.mahjong.omakase.service.scoring.RpCalculator;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
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

  private static final java.time.ZoneId ZONE_UTC = java.time.ZoneId.of("UTC");
  private static final java.time.ZoneId ZONE_PACIFIC = java.time.ZoneId.of("America/Los_Angeles");

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;
  private final RoundRepository roundRepo;
  private final RoundScoreRepository roundScoreRepo;
  private final GameSessionPlayerRepository gameSessionPlayerRepo;
  private final AppSettingRepository appSettingRepo;
  private final FanDiscoveryRepository fanDiscoveryRepo;
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
      List<GameModeHandler> handlerList) {
    this.playerRepo = playerRepo;
    this.sessionRepo = sessionRepo;
    this.roundRepo = roundRepo;
    this.roundScoreRepo = roundScoreRepo;
    this.gameSessionPlayerRepo = gameSessionPlayerRepo;
    this.appSettingRepo = appSettingRepo;
    this.fanDiscoveryRepo = fanDiscoveryRepo;
    this.handlers =
        handlerList.stream()
            .collect(Collectors.toMap(GameModeHandler::getGameMode, Function.identity()));
    this.participationBonus = loadParticipationBonus();
  }

  @EventListener(ApplicationReadyEvent.class)
  public void init() {
    initializeDiscoveries();
  }

  public void initializeDiscoveries() {
    log.info("Checking for new fan discoveries from historical rounds...");

    int page = 0;
    int size = 100;
    int newDiscoveries = 0;
    boolean hasMore = true;

    while (hasMore) {
      Pageable pageable = PageRequest.of(page, size);
      Page<Round> roundPage = roundRepo.findAllOrderByTime(false, pageable);
      List<Round> rounds = roundPage.getContent();

      if (rounds.isEmpty()) {
        hasMore = false;
        break;
      }

      for (Round round : rounds) {
        if (round.getWinnerId() == null || round.getFanDetails() == null) continue;
        if (round.getGameSession().getGameMode() != GameMode.GUOBIAO) continue;
        if (Boolean.TRUE.equals(round.getGameSession().getIsOnline())) continue;
        Player winner =
            playerRepo.findById(Objects.requireNonNull(round.getWinnerId())).orElse(null);
        if (winner == null || winner.isBot()) continue;

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

  public void reloadSettings() {
    this.participationBonus = loadParticipationBonus();
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
    } catch (org.springframework.dao.DataIntegrityViolationException e) {
      throw new IllegalArgumentException(
          "Username '" + request.getUserName() + "' is already taken");
    }
  }

  public boolean isUserNameTaken(String userName) {
    return playerRepo.existsByUserName(userName);
  }

  public Player updatePlayer(Long id, String firstName, String lastName) {
    Player player =
        playerRepo
            .findById(Objects.requireNonNull(id))
            .orElseThrow(() -> new IllegalArgumentException("Player not found"));
    if (firstName != null && !firstName.isBlank()) {
      player.setFirstName(firstName.trim());
    }
    if (lastName != null && !lastName.isBlank()) {
      player.setLastName(lastName.trim());
    }
    log.info("Updated player id={}, name='{} {}'", id, player.getFirstName(), player.getLastName());
    return playerRepo.save(player);
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
    playerRepo.deleteById(Objects.requireNonNull(id));
  }

  @org.springframework.transaction.annotation.Transactional(readOnly = true)
  public List<SessionSummaryResponse> getAllSessionSummaries() {
    return sessionRepo.findAllByOrderByCreatedAtDesc().stream()
        .map(SessionSummaryResponse::from)
        .toList();
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
    session.setIsOnline(request.getIsOnline() != null ? request.getIsOnline() : false);
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
    resp.setIsOnline(session.getIsOnline());

    resp.setPlayers(
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(
                gsp ->
                    new SessionDetailResponse.PlayerInfo(
                        gsp.getPlayer().getId(),
                        gsp.getPlayer().getUserName(),
                        gsp.getPlayer().getFirstName(),
                        gsp.getPlayer().getLastName(),
                        gsp.getSeat()))
            .collect(Collectors.toList()));

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
    if (Boolean.TRUE.equals(session.getIsOnline())) {
      return bonuses;
    }

    List<Object[]> currentSessionScores = roundScoreRepo.getTotalScoresBySession(session.getId());
    if (currentSessionScores.isEmpty()) {
      return bonuses;
    }

    String season = getSeasonStringFromUtc(session.getCreatedAt());

    List<GameSession> seasonSessions =
        sessionRepo.findAll().stream()
            .filter(s -> s.getStatus() == SessionStatus.COMPLETED)
            .filter(s -> s.getGameMode() == session.getGameMode())
            .filter(s -> !Boolean.TRUE.equals(s.getIsOnline()))
            .filter(s -> getSeasonStringFromUtc(s.getCreatedAt()).equals(season))
            .filter(s -> !s.getCreatedAt().isAfter(session.getCreatedAt()))
            .sorted(Comparator.comparing(GameSession::getCreatedAt))
            .toList();

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
  }

  public void completeSession(Long sessionId) {
    GameSession session =
        sessionRepo
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));
    session.setStatus(SessionStatus.COMPLETED);
    sessionRepo.save(session);
    log.info("Completed session id={}", sessionId);
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
        roundRepo.findByGameModeAndSessionDateRangeOrderByTime(mode, startUtc, endUtc, false)) {
      if (round.getWinnerId() == null || round.getFanDetails() == null) continue;
      if (Boolean.TRUE.equals(round.getGameSession().getIsOnline())) continue;
      Player winner = playerRepo.findById(Objects.requireNonNull(round.getWinnerId())).orElse(null);
      if (winner == null || winner.isBot()) continue;
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

    Integer maxFan;
    if (hasMode && hasDate) {
      maxFan = roundRepo.findMaxFanCountByModeAndDateRange(gameMode, startUtc, endUtc, false);
    } else if (hasMode) {
      maxFan = roundRepo.findMaxFanCountByMode(gameMode, false);
    } else if (hasDate) {
      maxFan = roundRepo.findMaxFanCountByDateRange(startUtc, endUtc, false);
    } else {
      maxFan = roundRepo.findMaxFanCount(false);
    }

    if (maxFan == null || maxFan == 0) return Collections.emptyList();

    List<Round> bestRounds;
    if (hasMode && hasDate) {
      bestRounds =
          roundRepo.findByFanCountAndModeAndDateRange(maxFan, gameMode, startUtc, endUtc, false);
    } else if (hasMode) {
      bestRounds = roundRepo.findByFanCountAndMode(maxFan, gameMode, false);
    } else if (hasDate) {
      bestRounds = roundRepo.findByFanCountAndDateRange(maxFan, startUtc, endUtc, false);
    } else {
      bestRounds = roundRepo.findByFanCount(maxFan, false);
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
                      ? playerRepo
                          .findById(Objects.requireNonNull(round.getWinnerId()))
                          .map(Player::getUserName)
                          .orElse("?")
                      : null;

              // Find deal-in player
              Long dealInId = round.getDealInPlayerId();

              String dealInName =
                  dealInId != null
                      ? playerRepo.findById(dealInId).map(Player::getUserName).orElse("?")
                      : null;

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
  public List<PlayerStatsResponse> getPlayerStats(
      GameMode gameMode, LocalDateTime start, LocalDateTime end, Boolean isOnline) {
    List<Player> players = playerRepo.findAll();
    boolean hasDateRange = start != null && end != null;
    LocalDateTime startUtc = toUtcTime(start);
    LocalDateTime endUtc = toUtcTime(end);

    Map<Long, Integer> totalScores = new HashMap<>();
    Map<Long, Integer> gamesPlayed = new HashMap<>();
    Map<Long, Integer> wins = new HashMap<>();
    Map<Long, Double> totalRP = new HashMap<>();
    Map<Long, Double> tieredBonusPerPlayer = new HashMap<>();
    Map<Long, Double> adminBonusPerPlayer = new HashMap<>();
    Map<Long, Double> fanBonusPerPlayer = new HashMap<>();

    boolean targetOnline = Boolean.TRUE.equals(isOnline);

    List<GameSession> completedSessions =
        sessionRepo.findAll().stream()
            .filter(s -> s.getStatus() == SessionStatus.COMPLETED)
            .filter(s -> gameMode == null || s.getGameMode() == gameMode)
            .filter(s -> targetOnline == Boolean.TRUE.equals(s.getIsOnline()))
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

    // Add Fan Discovery Bonuses (GUOBIAO only, offline only)
    if (!targetOnline && (gameMode == null || gameMode == GameMode.GUOBIAO)) {
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

    for (GameSession session : completedSessions) {
      List<Object[]> sessionScores = roundScoreRepo.getTotalScoresBySession(session.getId());
      if (!sessionScores.isEmpty()) {
        String season = getSeasonStringFromUtc(session.getCreatedAt());
        String seasonModeKey = season + ":" + session.getGameMode().name();
        Map<Long, Integer> seasonCounts =
            gameIndexBySeasonModePlayer.computeIfAbsent(seasonModeKey, k -> new HashMap<>());

        boolean isSessionOnline = Boolean.TRUE.equals(session.getIsOnline());
        double adminBonus =
            (!isSessionOnline && session.getParticipationBonus() != null)
                ? session.getParticipationBonus()
                : 0.0;

        for (Object[] row : sessionScores) {
          if (row[0] != null) {
            Long playerId = (Long) row[0];
            int score = ((Number) row[1]).intValue();

            // Accumulate gamesPlayed and totalScores dynamically for accurate filter
            gamesPlayed.merge(playerId, 1, Integer::sum);
            totalScores.merge(playerId, score, Integer::sum);

            int gameIndex = seasonCounts.merge(playerId, 1, Integer::sum);
            double tieredBonus = 0.0;
            if (!isSessionOnline) {
              if (gameIndex <= 10) {
                tieredBonus = 10.0;
              } else if (gameIndex <= 20) {
                tieredBonus = 5.0;
              }
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
        }

        int topScore = ((Number) sorted.get(0)[1]).intValue();
        for (Object[] row : sorted) {
          if (((Number) row[1]).intValue() != topScore) break;
          if (row[0] != null) wins.merge((Long) row[0], 1, (a, b) -> a + b);
        }
      }
    }

    return players.stream()
        .filter(p -> !p.isBot())
        .map(
            p -> {
              PlayerStatsResponse stat = new PlayerStatsResponse();
              stat.setPlayerId(p.getId());
              stat.setUserName(p.getUserName());
              stat.setDisplayName(p.getDisplayName());
              stat.setGamesPlayed(gamesPlayed.getOrDefault(p.getId(), 0));
              stat.setTotalScore(totalScores.getOrDefault(p.getId(), 0));
              stat.setWins(wins.getOrDefault(p.getId(), 0));
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
              return stat;
            })
        .collect(Collectors.toList());
  }

  public PlayerDetailResponse getPlayerDetail(Long playerId) {
    Player player =
        playerRepo
            .findById(Objects.requireNonNull(playerId))
            .orElseThrow(() -> new NoSuchElementException("Player not found"));

    List<GameSession> sessions = sessionRepo.findByPlayersPlayerIdOrderByCreatedAtDesc(playerId);

    List<PlayerDetailResponse.GameEntry> games =
        sessions.stream()
            .map(
                session -> {
                  List<Object[]> scores = roundScoreRepo.getTotalScoresBySession(session.getId());
                  int totalScore =
                      scores.stream()
                          .filter(r -> r[0] != null && ((Long) r[0]).equals(playerId))
                          .map(r -> ((Number) r[1]).intValue())
                          .findFirst()
                          .orElse(0);

                  PlayerDetailResponse.GameEntry entry = new PlayerDetailResponse.GameEntry();
                  entry.setSessionId(session.getId());
                  entry.setSessionName(session.getName());
                  entry.setGameMode(session.getGameMode().name());
                  entry.setGameModeDisplayName(session.getGameMode().getDisplayName());
                  entry.setStatus(session.getStatus().name());
                  entry.setCreatedAt(session.getCreatedAt());
                  entry.setTotalScore(totalScore);
                  return entry;
                })
            .collect(Collectors.toList());

    PlayerDetailResponse resp = new PlayerDetailResponse();
    resp.setPlayerId(player.getId());
    resp.setUserName(player.getUserName());
    resp.setFirstName(player.getFirstName());
    resp.setLastName(player.getLastName());
    resp.setGames(games);
    return resp;
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

    // Process Fan Discoveries (GUOBIAO only, skip BOT winners, skip chombo, skip online sessions)
    if (winnerId != null
        && fanDetails != null
        && !fanDetails.isBlank()
        && session.getGameMode() == GameMode.GUOBIAO
        && !Boolean.TRUE.equals(session.getIsOnline())) {
      Integer winnerScoreChange = computedScores.get(winnerId);
      if (winnerScoreChange != null && winnerScoreChange > 0) {
        Player winner = playerRepo.findById(winnerId).orElse(null);
        if (winner != null && !winner.isBot()) {
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
        .filter(fd -> !fd.getPlayer().isBot())
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
