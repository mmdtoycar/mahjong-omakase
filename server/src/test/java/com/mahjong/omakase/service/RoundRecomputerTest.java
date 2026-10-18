package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.RoundScore;
import com.mahjong.omakase.service.RoundRecomputer.Result;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RoundRecomputerTest {

  private final RoundRecomputer recomputer = new RoundRecomputer();

  private static GameSession table(long id, long... playerIds) {
    GameSession s = new GameSession();
    s.setId(id);
    s.setGameMode(GameMode.RIICHI);
    s.setPlayerCount(playerIds.length);
    int seat = 1;
    for (long pid : playerIds) {
      Player p = new Player("p" + pid, "p" + pid, "p" + pid);
      p.setId(pid);
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(s);
      gsp.setPlayer(p);
      gsp.setSeat(seat++);
      s.getPlayers().add(gsp);
    }
    return s;
  }

  private static Round add(
      GameSession s,
      Long winner,
      Long dealIn,
      String riichi,
      String tenpai,
      Map<Long, Integer> scores) {
    Round r = new Round();
    r.setGameSession(s);
    r.setRoundNumber(s.getRounds().size() + 1);
    r.setWinnerId(winner);
    r.setDealInPlayerId(dealIn);
    r.setRiichiPlayerIds(riichi);
    r.setTenpaiPlayerIds(tenpai);
    for (GameSessionPlayer gsp : s.getPlayers()) {
      RoundScore rs = new RoundScore();
      rs.setRound(r);
      rs.setPlayer(gsp.getPlayer());
      rs.setScore(scores.getOrDefault(gsp.getPlayer().getId(), 0));
      r.getScores().add(rs);
    }
    s.getRounds().add(r);
    return r;
  }

  private static Map<Long, Integer> scoresOf(Round r) {
    Map<Long, Integer> out = new java.util.HashMap<>();
    for (RoundScore rs : r.getScores()) out.put(rs.getPlayer().getId(), rs.getScore());
    return out;
  }

  /** Session 368 on 2026-10-17, as stored. Seats: 1, 4, 2, 10. */
  private static GameSession sessionThreeSixtyEight() {
    GameSession s = table(368, 1, 4, 2, 10);
    add(s, 1L, 2L, null, null, Map.of(1L, 7700, 2L, -7700));
    add(s, null, null, null, "1,4", Map.of(1L, 1500, 4L, 1500, 2L, -1500, 10L, -1500));
    add(s, null, null, "1", "1", Map.of(1L, 2000, 4L, -1000, 2L, -1000, 10L, -1000));
    add(s, null, null, "10", "10,2", Map.of(1L, -1500, 4L, -1500, 2L, 1500, 10L, 500));
    add(s, 4L, null, "10", null, Map.of(1L, -2400, 4L, 10200, 2L, -2400, 10L, -3400));
    add(s, 2L, 4L, null, null, Map.of(4L, -5200, 2L, 5200));
    add(s, 4L, 1L, null, null, Map.of(1L, -9200, 4L, 9200));
    add(s, 4L, 1L, null, null, Map.of(1L, -2600, 4L, 2600));
    return s;
  }

  @Test
  void aHandRecordedOnAPageThatMissedRoundsIsScoredAgainstTheRealTable() {
    GameSession s = sessionThreeSixtyEight();

    Result result = recomputer.recompute(List.of(s));

    assertThat(result.unresolved()).isEmpty();
    assertThat(result.changed()).extracting(c -> c.roundNumber()).containsExactly(6, 7);
    // 东2(5): 3 番 40 符 5200 plus five 本场.
    assertThat(scoresOf(s.getRounds().get(5)))
        .containsEntry(2L, 6700)
        .containsEntry(4L, -6700)
        .containsEntry(1L, 0);
    // 东3: dietpepsi is no longer the dealer, so the same hand is 5200 and carries no 本场.
    assertThat(scoresOf(s.getRounds().get(6)))
        .containsEntry(4L, 5200)
        .containsEntry(1L, -5200)
        .containsEntry(2L, 0);
  }

  @Test
  void handsThatWereScoredCorrectlyAreLeftAlone() {
    GameSession s = sessionThreeSixtyEight();
    recomputer.recompute(List.of(s));
    Map<Long, Integer> tsumo = scoresOf(s.getRounds().get(4));

    Result again = recomputer.recompute(List.of(s));

    assertThat(again.changed()).isEmpty();
    assertThat(again.unresolved()).isEmpty();
    assertThat(scoresOf(s.getRounds().get(4))).isEqualTo(tsumo);
    assertThat(tsumo).containsEntry(4L, 10200);
  }

  @Test
  void aTsumoScoredWithTheWrongDealerIsPaidByTheRealOne() {
    GameSession s = table(1, 1, 2, 3, 4);
    add(s, null, null, null, "", Map.of());
    // 东2(1): player 2 deals. Player 3 tsumo 3 番 30 符 (2000/1000), recorded as if player 1 dealt.
    add(s, 3L, null, null, null, Map.of(3L, 4000, 1L, -2000, 2L, -1000, 4L, -1000));

    Result result = recomputer.recompute(List.of(s));

    assertThat(result.changed()).hasSize(1);
    assertThat(scoresOf(s.getRounds().get(1)))
        .containsEntry(3L, 4300)
        .containsEntry(2L, -2100)
        .containsEntry(1L, -1100)
        .containsEntry(4L, -1100);
  }

  @Test
  void aTotalNoHandIsWorthIsReportedNotGuessed() {
    GameSession s = table(1, 1, 2, 3, 4);
    add(s, 2L, 3L, null, null, Map.of(2L, 5000, 3L, -5000));

    Result result = recomputer.recompute(List.of(s));

    assertThat(result.changed()).isEmpty();
    assertThat(result.unresolved()).hasSize(1);
    assertThat(scoresOf(s.getRounds().get(0))).containsEntry(2L, 5000);
  }

  @Test
  void otherModesAreNotTouched() {
    GameSession s = sessionThreeSixtyEight();
    s.setGameMode(GameMode.DONGBEI);

    assertThat(recomputer.recompute(List.of(s)).changed()).isEmpty();
  }
}
