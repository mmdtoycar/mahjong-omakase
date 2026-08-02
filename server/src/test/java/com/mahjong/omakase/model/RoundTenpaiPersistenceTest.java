package com.mahjong.omakase.model;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

/** 流局的听牌名单用 "" 表示「全员未听」, null 表示「历史对局无该数据」, 前端靠这个区别判断庄家连庄/流庄。 */
@DataJpaTest
class RoundTenpaiPersistenceTest {

  @Autowired private EntityManager em;

  private Round saveRound(String tenpaiPlayerIds) {
    GameSession session = new GameSession();
    session.setPlayerCount(4);
    session.setGameMode(GameMode.RIICHI);
    em.persist(session);

    Round round = new Round();
    round.setGameSession(session);
    round.setRoundNumber(1);
    round.setTenpaiPlayerIds(tenpaiPlayerIds);
    em.persist(round);

    em.flush();
    em.clear();
    return em.find(Round.class, round.getId());
  }

  @Test
  void emptyTenpaiListRoundTripsAsEmptyString() {
    assertThat(saveRound("").getTenpaiPlayerIds()).isEmpty();
  }

  @Test
  void missingTenpaiListRoundTripsAsNull() {
    assertThat(saveRound(null).getTenpaiPlayerIds()).isNull();
  }
}
