package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.RoundScore;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Runs against a real database, because "a dry run keeps nothing" is a claim about commits. */
@DataJpaTest
@Import({RecomputeService.class, TierService.class, RoundRecomputer.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RecomputeServiceTest {

  @Autowired private RecomputeService service;
  @Autowired private GameSessionRepository sessionRepo;
  @Autowired private PlayerRepository playerRepo;
  @Autowired private PlatformTransactionManager txManager;

  private long sessionId;

  /** Session 368 from 2026-10-17: hands 6 and 7 were scored against a stale table. */
  private void saveSessionThreeSixtyEight() {
    new TransactionTemplate(txManager)
        .executeWithoutResult(
            status -> {
              GameSession s = new GameSession();
              s.setName("368");
              s.setGameMode(GameMode.RIICHI);
              s.setStatus(SessionStatus.COMPLETED);
              s.setPlayerCount(4);
              Player[] players = new Player[4];
              for (int i = 0; i < 4; i++) {
                Player p = new Player("p" + i, "p" + i, "p" + i);
                p.setEmail("p" + i + "@test");
                players[i] = playerRepo.save(p);
                GameSessionPlayer gsp = new GameSessionPlayer();
                gsp.setGameSession(s);
                gsp.setPlayer(players[i]);
                gsp.setSeat(i + 1);
                s.getPlayers().add(gsp);
              }
              // Seats: 0 = dealer of 东1, 1 = dealer of 东2, 2 = dealer of 东3.
              round(s, players, 0, 1, null, null, Map.of(0, 7700, 1, -7700));
              round(s, players, -1, -1, null, "0,1", Map.of(0, 1500, 1, 1500, 2, -1500, 3, -1500));
              round(s, players, -1, -1, "0", "0", Map.of(0, 2000, 1, -1000, 2, -1000, 3, -1000));
              round(s, players, -1, -1, "3", "3,2", Map.of(0, -1500, 1, -1500, 2, 1500, 3, 500));
              round(s, players, 1, -1, "3", null, Map.of(0, -2400, 1, 10200, 2, -2400, 3, -3400));
              round(s, players, 2, 1, null, null, Map.of(1, -5200, 2, 5200));
              round(s, players, 1, 0, null, null, Map.of(0, -9200, 1, 9200));
              sessionId = sessionRepo.save(s).getId();
            });
  }

  private void round(
      GameSession s,
      Player[] players,
      int winner,
      int dealIn,
      String riichiSeats,
      String tenpaiSeats,
      Map<Integer, Integer> deltas) {
    Round r = new Round();
    r.setGameSession(s);
    r.setRoundNumber(s.getRounds().size() + 1);
    if (winner >= 0) r.setWinnerId(players[winner].getId());
    if (dealIn >= 0) r.setDealInPlayerId(players[dealIn].getId());
    r.setRiichiPlayerIds(ids(riichiSeats, players));
    r.setTenpaiPlayerIds(ids(tenpaiSeats, players));
    for (int i = 0; i < 4; i++) {
      RoundScore rs = new RoundScore();
      rs.setRound(r);
      rs.setPlayer(players[i]);
      rs.setScore(deltas.getOrDefault(i, 0));
      r.getScores().add(rs);
    }
    s.getRounds().add(r);
  }

  private static String ids(String seats, Player[] players) {
    if (seats == null) return null;
    return java.util.Arrays.stream(seats.split(","))
        .map(x -> String.valueOf(players[Integer.parseInt(x)].getId()))
        .collect(java.util.stream.Collectors.joining(","));
  }

  private List<Integer> handSix() {
    return new TransactionTemplate(txManager)
        .execute(
            status ->
                sessionRepo
                    .findById(sessionId)
                    .orElseThrow()
                    .getRounds()
                    .get(5)
                    .getScores()
                    .stream()
                    .map(RoundScore::getScore)
                    .sorted()
                    .toList());
  }

  @AfterEach
  void clean() {
    sessionRepo.deleteAll();
    playerRepo.deleteAll();
  }

  @Test
  void aDryRunReportsTheFixAndKeepsNothing() {
    saveSessionThreeSixtyEight();
    assertThat(handSix()).containsExactly(-5200, 0, 0, 5200);

    RecomputeService.Report report = service.run(true, true, null);

    assertThat(report.dryRun()).isTrue();
    assertThat(report.rounds()).extracting(c -> c.roundNumber()).containsExactly(6, 7);
    assertThat(handSix()).containsExactly(-5200, 0, 0, 5200);
  }

  @Test
  void anAppliedRunKeepsTheFixAndASecondRunHasNothingLeftToDo() {
    saveSessionThreeSixtyEight();

    RecomputeService.Report applied = service.run(true, false, null);

    assertThat(applied.rounds()).hasSize(2);
    assertThat(handSix()).containsExactly(-6700, 0, 0, 6700);
    assertThat(service.run(true, true, null).rounds()).isEmpty();
  }

  @Test
  void sessionIdsLimitWhichSessionsAreRescored() {
    saveSessionThreeSixtyEight();

    RecomputeService.Report other = service.run(true, false, List.of(sessionId + 1000));

    assertThat(other.rounds()).isEmpty();
    assertThat(handSix()).containsExactly(-5200, 0, 0, 5200);
  }

  @Test
  void theReplayResyncsGameCountsAndIsReported() {
    saveSessionThreeSixtyEight();
    new TransactionTemplate(txManager)
        .executeWithoutResult(status -> playerRepo.findAll().forEach(p -> p.setGamesRiichi(9)));

    RecomputeService.Report report = service.run(false, false, null);

    assertThat(report.players()).hasSize(4);
    assertThat(report.players()).allSatisfy(p -> assertThat(p.gamesAfter()).isEqualTo(1));
    assertThat(playerRepo.findAll()).allSatisfy(p -> assertThat(p.getGamesRiichi()).isEqualTo(1));
  }
}
