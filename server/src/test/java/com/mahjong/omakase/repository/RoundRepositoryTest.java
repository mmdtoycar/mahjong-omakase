package com.mahjong.omakase.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.Round;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class RoundRepositoryTest {

  @Autowired private EntityManager em;
  @Autowired private RoundRepository rounds;

  private void save(int number, int fanCount, String fanDetails) {
    GameSession session = new GameSession();
    session.setPlayerCount(4);
    session.setGameMode(GameMode.RIICHI);
    em.persist(session);
    Round round = new Round();
    round.setGameSession(session);
    round.setRoundNumber(number);
    round.setFanCount(fanCount);
    round.setFanDetails(fanDetails);
    em.persist(round);
  }

  @Test
  void aYakumanOutranksAnyHanCount() {
    save(1, 15, "清一色(6), 平和(1), 宝牌(8)");
    save(2, 13, "小四喜(13)");
    em.flush();

    Integer top = rounds.findMaxFanCountByMode(GameMode.RIICHI);

    assertThat(rounds.findByFanCountAndMode(top, GameMode.RIICHI))
        .extracting(Round::getFanDetails)
        .containsExactly("小四喜(13)");
  }

  @Test
  void withoutAYakumanTheHighestHanWins() {
    save(1, 15, "清一色(6), 平和(1), 宝牌(8)");
    save(2, 8, "清一色(6), 宝牌(2)");
    em.flush();

    Integer top = rounds.findMaxFanCountByMode(GameMode.RIICHI);

    assertThat(rounds.findByFanCountAndMode(top, GameMode.RIICHI))
        .extracting(Round::getFanCount)
        .containsExactly(15);
  }
}
