package com.mahjong.omakase.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class TierServiceTest {

  private TierService tierService;

  @BeforeEach
  public void setUp() {
    tierService =
        new TierService(
            mock(PlayerRepository.class),
            mock(GameSessionRepository.class),
            mock(PlayerMonthlySkillRepository.class));
  }

  private Player player(long id, String name) {
    Player p = new Player(name, name, name);
    p.setId(id);
    return p;
  }

  /** 4-player session, scores descending by seat order. */
  private GameSession session(GameMode mode, Map<Long, Integer> scoresByPlayerId) {
    GameSession s = new GameSession();
    s.setId(1L);
    s.setGameMode(mode);
    s.setStatus(SessionStatus.COMPLETED);
    s.setPlayerCount(scoresByPlayerId.size());
    int seat = 1;
    for (Long pid : scoresByPlayerId.keySet()) {
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(s);
      gsp.setPlayer(player(pid, "p" + pid));
      gsp.setSeat(seat++);
      s.getPlayers().add(gsp);
    }
    return s;
  }

  private Map<Long, Integer> scores() {
    Map<Long, Integer> m = new LinkedHashMap<>();
    m.put(1L, 100);
    m.put(2L, 20);
    m.put(3L, -40);
    m.put(4L, -80);
    return m;
  }

  @Test
  public void recordsRatingDeltaAndRatingAfterOnEachSessionPlayer() {
    Map<Long, Integer> totals = scores();
    GameSession s = session(GameMode.GUOBIAO, totals);

    tierService.onSessionCompleted(s, totals);

    for (GameSessionPlayer gsp : s.getPlayers()) {
      Long pid = gsp.getPlayer().getId();
      assertNotNull(gsp.getRatingDelta(), "ratingDelta for player " + pid);
      assertNotNull(gsp.getRatingAfter(), "ratingAfter for player " + pid);
      // ratingAfter must equal (starting rating + delta).
      assertEquals(
          TierService.INITIAL_RATING + gsp.getRatingDelta(), gsp.getRatingAfter(), 1e-9, "p" + pid);
      assertEquals(gsp.getRatingAfter(), gsp.getPlayer().getSkillGuobiao(), 1e-9, "p" + pid);
    }

    // 1st gains, last loses.
    Map<Long, Double> deltas = new HashMap<>();
    s.getPlayers().forEach(gsp -> deltas.put(gsp.getPlayer().getId(), gsp.getRatingDelta()));
    assertTrue(deltas.get(1L) > 0, "winner should gain rating");
    assertTrue(deltas.get(4L) < 0, "last place should lose rating");
    assertTrue(deltas.get(1L) > deltas.get(2L), "1st should gain more than 2nd");
    assertTrue(deltas.get(3L) > deltas.get(4L), "3rd should lose less than 4th");
  }

  @Test
  public void dongbeiSessionsUpdateRatingsAndGames() {
    Map<Long, Integer> totals = scores();
    GameSession s = session(GameMode.DONGBEI, totals);

    tierService.onSessionCompleted(s, totals);

    for (GameSessionPlayer gsp : s.getPlayers()) {
      Player p = gsp.getPlayer();
      assertEquals(1, p.getGamesDongbei(), "东北 game count");
      assertNotEquals(TierService.INITIAL_RATING, p.getSkillDongbei(), "东北 rating must move");
      assertNotNull(gsp.getRatingDelta());
      // Other modes stay untouched.
      assertEquals(TierService.INITIAL_RATING, p.getSkillGuobiao(), 1e-9);
      assertEquals(0, p.getGamesGuobiao());
    }
  }

  @Test
  public void tierIsUnrankedUntilMinGamesInThatMode() {
    Player p = player(1L, "p1");
    p.setSkillDongbei(1600);

    p.setGamesDongbei(TierService.RANKED_MIN_GAMES - 1);
    assertEquals(
        com.mahjong.omakase.model.Tier.UNRANKED,
        tierService.computeTier(p, GameMode.DONGBEI, null));

    p.setGamesDongbei(TierService.RANKED_MIN_GAMES);
    assertEquals(
        com.mahjong.omakase.model.Tier.LV3, tierService.computeTier(p, GameMode.DONGBEI, null));
    // 国标 has no games, so it stays unranked even though 东北 is ranked.
    assertEquals(
        com.mahjong.omakase.model.Tier.UNRANKED,
        tierService.computeTier(p, GameMode.GUOBIAO, null));
  }
}
