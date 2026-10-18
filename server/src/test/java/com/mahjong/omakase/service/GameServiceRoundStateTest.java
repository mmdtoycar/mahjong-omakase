package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.repository.FanDiscoveryRepository;
import com.mahjong.omakase.repository.GameSessionPlayerRepository;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import com.mahjong.omakase.repository.RoundRepository;
import com.mahjong.omakase.repository.RoundScoreRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

/** The dealer, 本场 and 供托 of a new round come from the table, not from the page. */
class GameServiceRoundStateTest {

  private final GameService service =
      new GameService(
          mock(PlayerRepository.class),
          mock(GameSessionRepository.class),
          mock(RoundRepository.class),
          mock(RoundScoreRepository.class),
          mock(GameSessionPlayerRepository.class),
          mock(FanDiscoveryRepository.class),
          mock(TierService.class),
          mock(PlayerMonthlySkillRepository.class),
          mock(CacheManager.class),
          mock(RecognitionSampleStore.class),
          mock(SessionEvents.class),
          List.of());

  /** Riichi, seats 1..4 are players 1..4, and a 流局 with no tenpai has been played: 东2(1). */
  private static GameSession afterOneDraw(GameMode mode) {
    GameSession s = new GameSession();
    s.setId(1L);
    s.setGameMode(mode);
    int seat = 1;
    for (long id = 1; id <= 4; id++) {
      Player p = new Player("p" + id, "p" + id, "p" + id);
      p.setId(id);
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(s);
      gsp.setPlayer(p);
      gsp.setSeat(seat++);
      s.getPlayers().add(gsp);
    }
    Round draw = new Round();
    draw.setGameSession(s);
    draw.setRoundNumber(1);
    draw.setTenpaiPlayerIds("");
    s.getRounds().add(draw);
    return s;
  }

  private static AddRoundRequest request(Long dealer, Integer honba, Integer kyoutaku) {
    AddRoundRequest r = new AddRoundRequest();
    r.setWinnerId(3L);
    r.setDealerId(dealer);
    r.setHonba(honba);
    r.setKyoutaku(kyoutaku);
    return r;
  }

  @Test
  void whatThePageShowedIsKeptWhenItMatchesTheTable() {
    AddRoundRequest r = request(2L, 1, 0);

    service.applyServerState(afterOneDraw(GameMode.RIICHI), r);

    assertThat(r.getDealerId()).isEqualTo(2L);
    assertThat(r.getHonba()).isEqualTo(1);
    assertThat(r.getKyoutaku()).isZero();
  }

  @Test
  void aPageThatSentNothingGetsTheTablesValues() {
    AddRoundRequest r = request(null, null, null);

    service.applyServerState(afterOneDraw(GameMode.RIICHI), r);

    assertThat(r.getDealerId()).isEqualTo(2L);
    assertThat(r.getHonba()).isEqualTo(1);
    assertThat(r.getKyoutaku()).isZero();
  }

  @Test
  void aPageShowingAnOlderTableIsStillServedAndScoredByTheRealOne() {
    AddRoundRequest r = request(1L, 0, 1000);

    service.applyServerState(afterOneDraw(GameMode.RIICHI), r);

    assertThat(r.getDealerId()).isEqualTo(2L);
    assertThat(r.getHonba()).isEqualTo(1);
    assertThat(r.getKyoutaku()).isZero();
  }

  @Test
  void dongbeiTakesTheDealerFromTheTable() {
    AddRoundRequest r = request(4L, null, null);

    service.applyServerState(afterOneDraw(GameMode.DONGBEI), r);

    assertThat(r.getDealerId()).isEqualTo(1L);
    assertThat(r.getHonba()).isNull();
  }

  @Test
  void guobiaoHasNoDealerToCheck() {
    AddRoundRequest r = request(null, null, null);

    service.applyServerState(afterOneDraw(GameMode.GUOBIAO), r);

    assertThat(r.getDealerId()).isNull();
  }
}
