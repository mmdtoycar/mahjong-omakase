package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.dto.PlayerDetailResponse;
import com.mahjong.omakase.dto.PlayerDetailResponse.ModeStats;
import com.mahjong.omakase.dto.PlayerStatsResponse;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.repository.FanDiscoveryRepository;
import com.mahjong.omakase.repository.GameSessionPlayerRepository;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import com.mahjong.omakase.repository.RoundRepository;
import com.mahjong.omakase.repository.RoundScoreRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

/**
 * The round-level numbers on the player page: 和牌 / 自摸 / 放铳 counts and the average points behind
 * each. Every one of them is read by a person who believes it, and nothing else in the test suite
 * touches this aggregation — a mistake here surfaces as a plausible-looking wrong number.
 *
 * <p>The shape being fed in is what {@code getRoundDetailsBySessions} returns: <em>one row per
 * player per round</em>, with the round-level columns (winner, deal-in) repeated on all four. That
 * repetition is the trap the aggregation exists to avoid, and the first test below is the guard on
 * it.
 */
class GameServiceStatsTest {

  private static final long ME = 1L;
  private static final long OPPONENT = 2L;
  private static final long GUOBIAO_SESSION = 10L;
  private static final long RIICHI_SESSION = 11L;

  private final PlayerRepository playerRepo = mock(PlayerRepository.class);
  private final GameSessionRepository sessionRepo = mock(GameSessionRepository.class);
  private final RoundScoreRepository roundScoreRepo = mock(RoundScoreRepository.class);

  private final GameService service =
      new GameService(
          playerRepo,
          sessionRepo,
          mock(RoundRepository.class),
          roundScoreRepo,
          mock(GameSessionPlayerRepository.class),
          mock(FanDiscoveryRepository.class),
          mock(TierService.class),
          mock(TableStrengthService.class),
          mock(PlayerMonthlySkillRepository.class),
          mock(CacheManager.class),
          mock(RecognitionSampleStore.class),
          List.of());

  private static GameSession session(long id, GameMode mode, SessionStatus status) {
    GameSession s = new GameSession();
    s.setId(id);
    s.setName("G" + id);
    s.setGameMode(mode);
    s.setStatus(status);
    return s;
  }

  /**
   * One row of {@code getRoundDetailsBySessions}: session, round, winner, deal-in, player, score.
   */
  private static Object[] row(
      long sessionId, long roundId, Long winnerId, Long dealInId, long playerId, int score) {
    return new Object[] {sessionId, roundId, winnerId, dealInId, playerId, score};
  }

  /**
   * All four players' rows for one round, so the round-level columns repeat the way the query
   * returns them: the winner gains the points, the deal-in player loses them, the other two are 0.
   */
  private static List<Object[]> round(
      long sessionId, long roundId, Long winnerId, Long dealInId, int winScore) {
    List<Object[]> rows = new ArrayList<>();
    for (long playerId : new long[] {ME, OPPONENT, 3L, 4L}) {
      int score = 0;
      if (winnerId != null && winnerId == playerId) {
        score = winScore;
      } else if (dealInId != null && dealInId == playerId) {
        score = -winScore;
      }
      rows.add(row(sessionId, roundId, winnerId, dealInId, playerId, score));
    }
    return rows;
  }

  private static List<Object[]> concat(List<List<Object[]>> parts) {
    return parts.stream().flatMap(List::stream).toList();
  }

  private Map<String, ModeStats> statsFor(List<GameSession> sessions, List<Object[]> rows) {
    Player player = new Player();
    player.setId(ME);
    player.setUserName("me");
    when(playerRepo.findById(ME)).thenReturn(Optional.of(player));
    when(sessionRepo.findByPlayersPlayerIdOrderByCreatedAtDesc(ME)).thenReturn(sessions);
    when(roundScoreRepo.getRoundDetailsBySessions(anyList())).thenReturn(rows);
    return service.getPlayerDetail(ME).getStatsByMode();
  }

  private ModeStats guobiao(List<Object[]> rows) {
    return statsFor(
            List.of(session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED)), rows)
        .get("GUOBIAO");
  }

  /**
   * The guard that matters most. The query repeats winner and deal-in on all four of a round's
   * rows, so counting them per row rather than per round multiplies every win and every deal-in by
   * the number of players at the table.
   */
  @Test
  void countsAWinOncePerRoundNotOncePerPlayerRow() {
    ModeStats stats =
        guobiao(
            List.of(
                row(GUOBIAO_SESSION, 100L, ME, OPPONENT, ME, 8000),
                row(GUOBIAO_SESSION, 100L, ME, OPPONENT, OPPONENT, -8000),
                row(GUOBIAO_SESSION, 100L, ME, OPPONENT, 3L, 0),
                row(GUOBIAO_SESSION, 100L, ME, OPPONENT, 4L, 0)));

    assertThat(stats.getHandWins()).isEqualTo(1);
    assertThat(stats.getRoundsPlayed()).isEqualTo(1);
  }

  /** 自摸 is a win with nobody dealing in; 荣和 is the same win with a deal-in player. */
  @Test
  void separatesSelfDrawFromARonWin() {
    ModeStats stats =
        guobiao(
            concat(
                List.of(
                    round(GUOBIAO_SESSION, 100L, ME, null, 8000),
                    round(GUOBIAO_SESSION, 101L, ME, OPPONENT, 4000))));

    assertThat(stats.getHandWins()).isEqualTo(2);
    assertThat(stats.getTsumoWins()).isEqualTo(1);
  }

  /** A drawn round: nobody wins, nobody deals in, but everyone played it. */
  @Test
  void countsADrawnRoundAsPlayedByNobodyWinning() {
    ModeStats stats = guobiao(round(GUOBIAO_SESSION, 100L, null, null, 0));

    assertThat(stats.getRoundsPlayed()).isEqualTo(1);
    assertThat(stats.getHandWins()).isZero();
    assertThat(stats.getTsumoWins()).isZero();
    assertThat(stats.getDealIns()).isZero();
  }

  /** 平均打点: the winner's own positive score, over the wins — not over the rounds played. */
  @Test
  void averagesWinPointsOverWinsOnly() {
    ModeStats stats =
        guobiao(
            concat(
                List.of(
                    round(GUOBIAO_SESSION, 100L, ME, OPPONENT, 8000),
                    round(GUOBIAO_SESSION, 101L, ME, OPPONENT, 4000),
                    round(GUOBIAO_SESSION, 102L, OPPONENT, null, 0))));

    assertThat(stats.getRoundsPlayed()).isEqualTo(3);
    assertThat(stats.getHandWins()).isEqualTo(2);
    assertThat(stats.getAvgWinPoints()).isEqualTo(6000.0);
  }

  /** 放铳 and 平均铳点: counted for the deal-in player, and reported as a positive magnitude. */
  @Test
  void recordsDealInsAsAPositiveAverage() {
    ModeStats stats =
        guobiao(
            List.of(
                row(GUOBIAO_SESSION, 100L, OPPONENT, ME, ME, -8000),
                row(GUOBIAO_SESSION, 100L, OPPONENT, ME, OPPONENT, 8000),
                row(GUOBIAO_SESSION, 101L, OPPONENT, ME, ME, -4000),
                row(GUOBIAO_SESSION, 101L, OPPONENT, ME, OPPONENT, 4000)));

    assertThat(stats.getDealIns()).isEqualTo(2);
    assertThat(stats.getAvgDealInPoints()).isEqualTo(6000.0);
    assertThat(stats.getHandWins()).isZero();
  }

  /** Nothing to divide by, and no division by zero either. */
  @Test
  void reportsZeroAveragesWithoutWinsOrDealIns() {
    ModeStats stats = guobiao(round(GUOBIAO_SESSION, 100L, OPPONENT, 3L, 0));

    assertThat(stats.getAvgWinPoints()).isZero();
    assertThat(stats.getAvgDealInPoints()).isZero();
  }

  /** Two rule sets are two different games; their numbers must not pool. */
  @Test
  void keepsTheModesApart() {
    Map<String, ModeStats> byMode =
        statsFor(
            List.of(
                session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED),
                session(RIICHI_SESSION, GameMode.RIICHI, SessionStatus.COMPLETED)),
            concat(
                List.of(
                    round(GUOBIAO_SESSION, 100L, ME, OPPONENT, 8000),
                    round(RIICHI_SESSION, 200L, ME, OPPONENT, 12000),
                    round(RIICHI_SESSION, 201L, OPPONENT, null, 0))));

    assertThat(byMode).containsOnlyKeys("GUOBIAO", "RIICHI");
    assertThat(byMode.get("GUOBIAO").getRoundsPlayed()).isEqualTo(1);
    assertThat(byMode.get("GUOBIAO").getAvgWinPoints()).isEqualTo(8000.0);
    assertThat(byMode.get("RIICHI").getRoundsPlayed()).isEqualTo(2);
    assertThat(byMode.get("RIICHI").getAvgWinPoints()).isEqualTo(12000.0);
  }

  /**
   * A session still in progress is not a result yet. Its rows are dropped rather than folded into
   * the mode, which is also what keeps a half-finished evening out of the averages.
   */
  @Test
  void ignoresSessionsThatAreNotFinished() {
    Map<String, ModeStats> byMode =
        statsFor(
            List.of(
                session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED),
                session(RIICHI_SESSION, GameMode.RIICHI, SessionStatus.IN_PROGRESS)),
            concat(
                List.of(
                    round(GUOBIAO_SESSION, 100L, ME, OPPONENT, 8000),
                    round(RIICHI_SESSION, 200L, ME, OPPONENT, 12000))));

    assertThat(byMode).containsOnlyKeys("GUOBIAO");
  }

  /** A mode the player has no rounds in is absent, not present with zeros. */
  @Test
  void omitsAModeThePlayerHasNotPlayed() {
    Map<String, ModeStats> byMode =
        statsFor(
            List.of(session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED)),
            List.of(
                row(GUOBIAO_SESSION, 100L, OPPONENT, 3L, OPPONENT, 8000),
                row(GUOBIAO_SESSION, 100L, OPPONENT, 3L, 3L, -8000)));

    assertThat(byMode).isEmpty();
  }

  /**
   * The same tallies are also mapped onto the leaderboard response, by a second call site that
   * reads them per player rather than for one. Both must agree — the whole point of the shared
   * accumulator is that 和牌率 on the stats page and on the player page cannot drift apart.
   */
  @Test
  void mapsTheSameTalliesOntoTheLeaderboard() {
    Player me = new Player();
    me.setId(ME);
    me.setUserName("me");
    Player opponent = new Player();
    opponent.setId(OPPONENT);
    opponent.setUserName("opponent");
    when(playerRepo.findAll()).thenReturn(List.of(me, opponent));

    GameSession completed = session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED);
    when(sessionRepo.findAll()).thenReturn(List.of(completed));
    // [sessionId, playerId, total] — what drives gamesPlayed and the per-session ranking.
    when(roundScoreRepo.getTotalScoresBySessions(anyList()))
        .thenReturn(
            List.of(
                new Object[] {GUOBIAO_SESSION, ME, 12000},
                new Object[] {GUOBIAO_SESSION, OPPONENT, -12000}));
    when(roundScoreRepo.getRoundDetailsBySessions(anyList()))
        .thenReturn(
            concat(
                List.of(
                    round(GUOBIAO_SESSION, 100L, ME, OPPONENT, 8000),
                    round(GUOBIAO_SESSION, 101L, ME, OPPONENT, 4000),
                    round(GUOBIAO_SESSION, 102L, OPPONENT, ME, 6000))));

    PlayerStatsResponse mine =
        service.getPlayerStats(null, null, null).stream()
            .filter(s -> ME == s.getPlayerId())
            .findFirst()
            .orElseThrow();

    assertThat(mine.getRoundsPlayed()).isEqualTo(3);
    assertThat(mine.getHandWins()).isEqualTo(2);
    assertThat(mine.getTsumoWins()).isZero();
    assertThat(mine.getDealIns()).isEqualTo(1);
    assertThat(mine.getAvgWinPoints()).isEqualTo(6000.0);
    assertThat(mine.getAvgDealInPoints()).isEqualTo(6000.0);
    assertThat(mine.getGamesPlayed()).isEqualTo(1);
    assertThat(mine.getTotalScore()).isEqualTo(12000);
  }

  @Test
  void hasNoModeStatsWithoutSessions() {
    assertThat(statsFor(List.of(), List.of())).isEmpty();
  }

  /**
   * The per-game score column on the player page. The bulk query returns every player's total for
   * every session, so picking the wrong row shows someone else's score under this player's name.
   */
  @Test
  void takesThisPlayersOwnScoreForEachGame() {
    Player player = new Player();
    player.setId(ME);
    when(playerRepo.findById(ME)).thenReturn(Optional.of(player));
    when(sessionRepo.findByPlayersPlayerIdOrderByCreatedAtDesc(ME))
        .thenReturn(List.of(session(GUOBIAO_SESSION, GameMode.GUOBIAO, SessionStatus.COMPLETED)));
    when(roundScoreRepo.getTotalScoresBySessions(anyList()))
        .thenReturn(
            List.of(
                new Object[] {GUOBIAO_SESSION, OPPONENT, -12000},
                new Object[] {GUOBIAO_SESSION, ME, 12000}));

    PlayerDetailResponse resp = service.getPlayerDetail(ME);

    assertThat(resp.getGames()).hasSize(1);
    assertThat(resp.getGames().get(0).getTotalScore()).isEqualTo(12000);
  }
}
