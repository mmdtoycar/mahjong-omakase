package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.GameStateDeriver.RoundFacts;
import com.mahjong.omakase.service.GameStateDeriver.Seat;
import com.mahjong.omakase.service.GameStateDeriver.State;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GameStateDeriverTest {

  private static final List<Seat> TABLE =
      List.of(new Seat(1, 1), new Seat(2, 2), new Seat(3, 3), new Seat(4, 4));

  private static State after(RoundFacts... rounds) {
    List<State> all = GameStateDeriver.deriveAll(GameMode.RIICHI, TABLE, List.of(rounds));
    return all.get(all.size() - 1);
  }

  private static RoundFacts draw(Long... tenpai) {
    List<Long> list = List.of(tenpai);
    Map<Long, Integer> scores = new java.util.HashMap<>();
    for (long id = 1; id <= 4; id++) {
      boolean noten = list.size() == 4 || list.isEmpty();
      scores.put(
          id, noten ? 0 : list.contains(id) ? 3000 / list.size() : -3000 / (4 - list.size()));
    }
    return new RoundFacts(null, list, null, scores);
  }

  private static RoundFacts win(long winner) {
    return new RoundFacts(winner, null, null, Map.of());
  }

  @Test
  void noTenpaiPassesTheDealerAndAddsAHonba() {
    State s = after(draw());
    assertThat(s.dealerPlayerId()).isEqualTo(2);
    assertThat(s.displayName()).isEqualTo("东2(1)");
  }

  @Test
  void everyoneTenpaiKeepsTheDealer() {
    State s = after(draw(1L, 2L, 3L, 4L));
    assertThat(s.dealerPlayerId()).isEqualTo(1);
    assertThat(s.displayName()).isEqualTo("东1(1)");
  }

  @Test
  void aTenpaiDealerKeepsTheSeatAndANotenOnePassesIt() {
    assertThat(after(draw(1L, 3L)).dealerPlayerId()).isEqualTo(1);
    assertThat(after(draw(2L, 3L)).dealerPlayerId()).isEqualTo(2);
  }

  @Test
  void honbaPilesUpAcrossDrawsAndTheDealerRotates() {
    State s = after(draw(), draw(), draw(1L, 2L, 3L, 4L));
    assertThat(s.dealerPlayerId()).isEqualTo(3);
    assertThat(s.displayName()).isEqualTo("东3(3)");
  }

  @Test
  void aDrawWithoutATenpaiListReadsThePointsOfTheDealer() {
    RoundFacts dealerNoten =
        new RoundFacts(null, null, null, Map.of(1L, -1500, 2L, 1500, 3L, 1500, 4L, -1500));
    assertThat(after(dealerNoten).displayName()).isEqualTo("东2(1)");
  }

  @Test
  void aNonDealerWinResetsHonbaAndPassesTheDealer() {
    State s = after(draw(), win(3));
    assertThat(s.dealerPlayerId()).isEqualTo(3);
    assertThat(s.displayName()).isEqualTo("东3");
  }

  @Test
  void aDealerWinKeepsTheDealerAndAddsAHonba() {
    State s = after(win(1));
    assertThat(s.dealerPlayerId()).isEqualTo(1);
    assertThat(s.displayName()).isEqualTo("东1(1)");
  }

  @Test
  void sticksStayOnTheTableThroughDrawsAndGoWithAWin() {
    RoundFacts drawWithRiichi = new RoundFacts(null, List.of(2L, 3L), List.of(2L, 3L), Map.of());
    assertThat(after(drawWithRiichi).kyoutaku()).isEqualTo(2000);
    assertThat(after(drawWithRiichi, win(2)).kyoutaku()).isZero();
  }

  /** Session 368 on 2026-10-17: the table the page should have shown for each hand. */
  @Test
  void sessionThreeSixtyEightLabelsEveryHand() {
    List<RoundFacts> rounds = new ArrayList<>();
    rounds.add(win(1)); // 东1: dealer wins
    rounds.add(new RoundFacts(null, List.of(1L, 4L), null, Map.of()));
    rounds.add(new RoundFacts(null, List.of(1L), List.of(1L), Map.of()));
    rounds.add(new RoundFacts(null, List.of(10L, 2L), List.of(10L), Map.of()));
    rounds.add(new RoundFacts(4L, null, List.of(10L), Map.of())); // 东2(4): dealer tsumo
    rounds.add(win(2)); // 东2(5): a non-dealer takes it
    rounds.add(win(4)); // 东3
    rounds.add(win(4)); // 东4

    List<State> states = GameStateDeriver.deriveAll(GameMode.RIICHI, TABLE_368, rounds);

    assertThat(states.stream().map(State::displayName))
        .containsExactly("东1", "东1(1)", "东1(2)", "东1(3)", "东2(4)", "东2(5)", "东3", "东4", "南1");
    assertThat(states.get(4).kyoutaku()).isEqualTo(2000);
    assertThat(states.get(5).honba()).isEqualTo(5);
    assertThat(states.get(5).kyoutaku()).isZero();
    assertThat(states.get(6).dealerPlayerId()).isEqualTo(2);
  }

  // Session 368 seated players 1, 4, 2 and 10 in that order.
  private static final List<Seat> TABLE_368 =
      List.of(new Seat(1, 1), new Seat(4, 2), new Seat(2, 3), new Seat(10, 4));

  @Test
  void guobiaoRotatesTheDealerEveryRound() {
    List<State> states =
        GameStateDeriver.deriveAll(GameMode.GUOBIAO, TABLE, List.of(win(2), win(2)));
    assertThat(states.get(2).dealerPlayerId()).isEqualTo(3);
    assertThat(states.get(2).displayName()).isEqualTo("第3/4局");
    assertThat(states.get(2).honba()).isZero();
  }

  @Test
  void dongbeiKeepsTheDealerWhenNobodyWins() {
    RoundFacts nobody = new RoundFacts(null, null, null, Map.of());
    List<State> states = GameStateDeriver.deriveAll(GameMode.DONGBEI, TABLE, List.of(nobody));
    assertThat(states.get(1).dealerPlayerId()).isEqualTo(1);
  }

  @Test
  void aThreePlayerTableTurnsTheWindAfterThreeHands() {
    List<Seat> three = List.of(new Seat(1, 1), new Seat(2, 2), new Seat(3, 3));
    State s =
        GameStateDeriver.deriveAll(GameMode.RIICHI, three, List.of(win(2), win(3), win(1))).get(3);
    assertThat(s.displayName()).isEqualTo("南1");
    assertThat(s.dealerPlayerId()).isEqualTo(1);
  }
}
