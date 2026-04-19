package com.mahjong.omakase.service;

import com.mahjong.omakase.dto.*;
import com.mahjong.omakase.model.*;
import com.mahjong.omakase.repository.*;
import com.mahjong.omakase.service.handler.GameModeHandler;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@Transactional
public class GameService {

  private final PlayerRepository playerRepo;
  private final GameSessionRepository sessionRepo;
  private final RoundRepository roundRepo;
  private final RoundScoreRepository roundScoreRepo;
  private final GameSessionPlayerRepository gameSessionPlayerRepo;
  private final Map<GameMode, GameModeHandler> handlers;

  public GameService(
      PlayerRepository playerRepo,
      GameSessionRepository sessionRepo,
      RoundRepository roundRepo,
      RoundScoreRepository roundScoreRepo,
      GameSessionPlayerRepository gameSessionPlayerRepo,
      List<GameModeHandler> handlerList) {
    this.playerRepo = playerRepo;
    this.sessionRepo = sessionRepo;
    this.roundRepo = roundRepo;
    this.roundScoreRepo = roundScoreRepo;
    this.gameSessionPlayerRepo = gameSessionPlayerRepo;
    this.handlers =
        handlerList.stream()
            .collect(Collectors.toMap(GameModeHandler::getGameMode, Function.identity()));
  }

  public List<Player> getAllPlayers() {
    return playerRepo.findAll();
  }

  public Player createPlayer(CreatePlayerRequest request) {
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
    return playerRepo.save(
        new Player(request.getUserName(), request.getFirstName(), request.getLastName()));
  }

  public boolean isUserNameTaken(String userName) {
    return playerRepo.existsByUserName(userName);
  }

  public Player updatePlayer(Long id, String firstName, String lastName) {
    Player player =
        playerRepo
            .findById(id)
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
    playerRepo.deleteById(id);
  }

  public List<GameSession> getAllSessions() {
    return sessionRepo.findAllByOrderByCreatedAtDesc();
  }

  public GameSession createSession(CreateSessionRequest request) {
    List<Player> players = playerRepo.findAllById(request.getPlayerIds());
    if (players.size() != request.getPlayerIds().size()) {
      log.warn(
          "Failed to create session: some player IDs are invalid, requested={}, found={}",
          request.getPlayerIds(),
          players.size());
      throw new IllegalArgumentException("Some player IDs are invalid");
    }

    GameSession session = new GameSession();
    session.setName(request.getName());
    session.setGameMode(GameMode.valueOf(request.getGameMode()));
    session.setPlayerCount(players.size());
    session = sessionRepo.save(session);

    for (Player player : players) {
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(session);
      gsp.setPlayer(player);
      session.getPlayers().add(gsp);
    }
    session = sessionRepo.save(session);
    log.info(
        "Created session id={} '{}' with {} players",
        session.getId(),
        session.getName(),
        players.size());
    return session;
  }

  public SessionDetailResponse getSessionDetail(Long sessionId) {
    GameSession session =
        sessionRepo
            .findById(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));

    SessionDetailResponse resp = new SessionDetailResponse();
    resp.setId(session.getId());
    resp.setName(session.getName());
    resp.setGameMode(session.getGameMode().name());
    resp.setGameModeDisplayName(session.getGameMode().getDisplayName());
    resp.setPlayerCount(session.getPlayerCount());
    resp.setStatus(session.getStatus().name());
    resp.setCreatedAt(session.getCreatedAt());

    resp.setPlayers(
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(
                gsp ->
                    new SessionDetailResponse.PlayerInfo(
                        gsp.getPlayer().getId(),
                        gsp.getPlayer().getUserName(),
                        gsp.getPlayer().getFirstName(),
                        gsp.getPlayer().getLastName()))
            .collect(Collectors.toList()));

    resp.setRounds(
        session.getRounds().stream()
            .map(
                round -> {
                  Map<Long, Integer> scores =
                      round.getScores().stream()
                          .filter(rs -> rs.getPlayer() != null)
                          .collect(
                              Collectors.toMap(rs -> rs.getPlayer().getId(), RoundScore::getScore));
                  return new SessionDetailResponse.RoundInfo(round.getRoundNumber(), scores);
                })
            .collect(Collectors.toList()));

    Map<Long, Integer> totals = new HashMap<>();
    for (var round : session.getRounds()) {
      for (var rs : round.getScores()) {
        if (rs.getPlayer() != null) {
          totals.merge(rs.getPlayer().getId(), rs.getScore(), Integer::sum);
        }
      }
    }
    resp.setTotalScores(totals);

    return resp;
  }

  public void addRound(Long sessionId, AddRoundRequest request) {
    GameSession session =
        sessionRepo
            .findById(sessionId)
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

    saveRoundScores(session, nextRoundNumber, computedScores);
  }

  public void deleteRound(Long sessionId, int roundNumber) {
    log.info("Deleting round {} from session id={}", roundNumber, sessionId);
    GameSession session =
        sessionRepo
            .findById(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));

    Round round =
        session.getRounds().stream()
            .filter(r -> r.getRoundNumber() == roundNumber)
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Round not found"));

    session.getRounds().remove(round);
    roundRepo.delete(round);

    int num = 1;
    for (Round r : session.getRounds()) {
      r.setRoundNumber(num++);
    }
    sessionRepo.save(session);
  }

  public void completeSession(Long sessionId) {
    GameSession session =
        sessionRepo
            .findById(sessionId)
            .orElseThrow(() -> new NoSuchElementException("Session not found"));
    session.setStatus(SessionStatus.COMPLETED);
    sessionRepo.save(session);
    log.info("Completed session id={}", sessionId);
  }

  public List<PlayerStatsResponse> getPlayerStats(
      GameMode gameMode, LocalDateTime start, LocalDateTime end) {
    List<Player> players = playerRepo.findAll();
    boolean hasDateRange = start != null && end != null;

    Map<Long, Integer> totalScores = new HashMap<>();
    List<Object[]> scoreRows;
    if (gameMode != null && hasDateRange) {
      scoreRows = roundScoreRepo.getTotalScoresByGameModeAndDateRange(gameMode, start, end);
    } else if (gameMode != null) {
      scoreRows = roundScoreRepo.getTotalScoresByGameMode(gameMode);
    } else {
      scoreRows = roundScoreRepo.getTotalScoresAllTime();
    }
    for (Object[] row : scoreRows) {
      if (row[0] != null) totalScores.put((Long) row[0], ((Number) row[1]).intValue());
    }

    Map<Long, Integer> gamesPlayed = new HashMap<>();
    List<Object[]> gamesRows;
    if (gameMode != null && hasDateRange) {
      gamesRows =
          roundScoreRepo.getGamesPlayedPerPlayerByGameModeAndDateRange(gameMode, start, end);
    } else if (gameMode != null) {
      gamesRows = roundScoreRepo.getGamesPlayedPerPlayerByGameMode(gameMode);
    } else {
      gamesRows = roundScoreRepo.getGamesPlayedPerPlayer();
    }
    for (Object[] row : gamesRows) {
      if (row[0] != null) gamesPlayed.put((Long) row[0], ((Number) row[1]).intValue());
    }

    Map<Long, Integer> roundsPlayed = new HashMap<>();
    List<Object[]> roundsRows;
    if (gameMode != null && hasDateRange) {
      roundsRows =
          roundScoreRepo.getRoundsPlayedPerPlayerByGameModeAndDateRange(gameMode, start, end);
    } else if (gameMode != null) {
      roundsRows = roundScoreRepo.getRoundsPlayedPerPlayerByGameMode(gameMode);
    } else {
      roundsRows = roundScoreRepo.getRoundsPlayedPerPlayer();
    }
    for (Object[] row : roundsRows) {
      if (row[0] != null) roundsPlayed.put((Long) row[0], ((Number) row[1]).intValue());
    }

    Map<Long, Integer> wins = new HashMap<>();
    List<GameSession> completedSessions =
        sessionRepo.findAll().stream()
            .filter(s -> s.getStatus() == SessionStatus.COMPLETED)
            .filter(s -> gameMode == null || s.getGameMode() == gameMode)
            .filter(
                s ->
                    !hasDateRange
                        || (!s.getCreatedAt().isBefore(start) && s.getCreatedAt().isBefore(end)))
            .toList();
    for (GameSession session : completedSessions) {
      List<Object[]> sessionScores = roundScoreRepo.getTotalScoresBySession(session.getId());
      if (!sessionScores.isEmpty()) {
        long winnerId =
            sessionScores.stream()
                .filter(r -> r[0] != null)
                .max(Comparator.comparingInt(r -> ((Number) r[1]).intValue()))
                .map(r -> (Long) r[0])
                .orElse(-1L);
        if (winnerId != -1L) wins.merge(winnerId, 1, Integer::sum);
      }
    }

    return players.stream()
        .map(
            p -> {
              PlayerStatsResponse stat = new PlayerStatsResponse();
              stat.setPlayerId(p.getId());
              stat.setUserName(p.getUserName());
              stat.setDisplayName(p.getDisplayName());
              stat.setGamesPlayed(gamesPlayed.getOrDefault(p.getId(), 0));
              stat.setTotalScore(totalScores.getOrDefault(p.getId(), 0));
              int rounds = roundsPlayed.getOrDefault(p.getId(), 0);
              stat.setAvgScore(
                  rounds > 0 ? (double) totalScores.getOrDefault(p.getId(), 0) / rounds : 0);
              stat.setWins(wins.getOrDefault(p.getId(), 0));
              return stat;
            })
        .collect(Collectors.toList());
  }

  public PlayerDetailResponse getPlayerDetail(Long playerId) {
    Player player =
        playerRepo
            .findById(playerId)
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
      GameSession session, int roundNumber, Map<Long, Integer> computedScores) {
    Round round = new Round();
    round.setGameSession(session);
    round.setRoundNumber(roundNumber);
    round = roundRepo.save(round);

    for (Map.Entry<Long, Integer> entry : computedScores.entrySet()) {
      Player player =
          playerRepo
              .findById(entry.getKey())
              .orElseThrow(() -> new NoSuchElementException("Player not found: " + entry.getKey()));
      RoundScore rs = new RoundScore();
      rs.setRound(round);
      rs.setPlayer(player);
      rs.setScore(entry.getValue());
      roundScoreRepo.save(rs);
    }
  }
}
