package com.mahjong.omakase.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.PlayerMonthlySkill;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class TierServiceTest {

  private PlayerMonthlySkillRepository monthlyRepo;
  private TierService tierService;

  @BeforeEach
  public void setUp() {
    monthlyRepo = mock(PlayerMonthlySkillRepository.class);
    tierService =
        new TierService(
            mock(PlayerRepository.class), mock(GameSessionRepository.class), monthlyRepo);
  }

  private Player player(long id) {
    Player p = new Player("p" + id, "p" + id, "p" + id);
    p.setId(id);
    return p;
  }

  private GameSession session(GameMode mode, Map<Long, Integer> scores, Long botId) {
    GameSession s = new GameSession();
    s.setId(1L);
    s.setGameMode(mode);
    s.setStatus(SessionStatus.COMPLETED);
    s.setPlayerCount(scores.size());
    int seat = 1;
    for (Long pid : scores.keySet()) {
      GameSessionPlayer gsp = new GameSessionPlayer();
      gsp.setGameSession(s);
      Player p = player(pid);
      p.setBot(pid.equals(botId));
      gsp.setPlayer(p);
      gsp.setSeat(seat++);
      s.getPlayers().add(gsp);
    }
    return s;
  }

  private static Map<Long, Integer> scores(int... values) {
    Map<Long, Integer> m = new LinkedHashMap<>();
    for (int i = 0; i < values.length; i++) m.put((long) i + 1, values[i]);
    return m;
  }

  private static GameSessionPlayer seat(GameSession s, long playerId) {
    return s.getPlayers().stream()
        .filter(g -> g.getPlayer().getId() == playerId)
        .findFirst()
        .orElseThrow();
  }

  /** 国标's 素点 term: half a point per (14550 / 62) / 1000 of score — see Ladder. */
  private static double guobiaoSoten(int score) {
    return 0.5 * score * 14550 / 62 / 1000.0;
  }

  @Test
  public void recordsLadderPointsOnEachSessionPlayer() {
    Map<Long, Integer> totals = scores(100, 20, -40, -80);
    GameSession s = session(GameMode.GUOBIAO, totals, null);

    tierService.onSessionCompleted(s, totals);

    double[] placement = {30, 10, 0, -30};
    for (int i = 0; i < 4; i++) {
      GameSessionPlayer gsp = seat(s, i + 1);
      double expected = placement[i] + guobiaoSoten(totals.get((long) i + 1));
      assertEquals(expected, gsp.getLadderDelta(), 1e-9, "points for place " + (i + 1));
      assertEquals(Ladder.START_LEVEL, gsp.getLadderLevelAfter(), "still 美猴王 1 star");
      assertEquals(75 + expected, gsp.getLadderPointsAfter(), 1e-9);
      assertEquals(75 + expected, gsp.getPlayer().getLadderPointsGuobiao(), 1e-9);
      assertEquals(1, gsp.getPlayer().getGamesGuobiao());
      // The old rating is no longer touched.
      assertNull(gsp.getRatingDelta());
      assertEquals(1500.0, gsp.getPlayer().getSkillGuobiao(), 1e-9);
    }
  }

  @Test
  public void otherModesAreUntouched() {
    Map<Long, Integer> totals = scores(100, 20, -40, -80);
    GameSession s = session(GameMode.DONGBEI, totals, null);

    tierService.onSessionCompleted(s, totals);

    for (GameSessionPlayer gsp : s.getPlayers()) {
      Player p = gsp.getPlayer();
      assertEquals(1, p.getGamesDongbei());
      assertNotEquals(Ladder.State.start(), TierService.getLadder(p, GameMode.DONGBEI));
      assertEquals(0, p.getGamesGuobiao());
      assertEquals(Ladder.State.start(), TierService.getLadder(p, GameMode.GUOBIAO));
    }
  }

  @Test
  public void tiedPlayersSplitTheirPlaces() {
    Map<Long, Integer> totals = scores(50, 50, -40, -60);
    GameSession s = session(GameMode.GUOBIAO, totals, null);

    tierService.onSessionCompleted(s, totals);

    double shared = (30 + 10) / 2.0 + guobiaoSoten(50);
    assertEquals(shared, seat(s, 1).getLadderDelta(), 1e-9);
    assertEquals(shared, seat(s, 2).getLadderDelta(), 1e-9);
  }

  @Test
  public void aBotKeepsItsPlaceButIsNotRated() {
    Map<Long, Integer> totals = scores(100, 20, -40, -80);
    GameSession s = session(GameMode.GUOBIAO, totals, 1L);

    tierService.onSessionCompleted(s, totals);

    assertNull(seat(s, 1).getLadderDelta(), "the bot");
    assertEquals(10 + guobiaoSoten(20), seat(s, 2).getLadderDelta(), 1e-9, "second behind the bot");
  }

  @Test
  public void aTableOfTwoIsNotRated() {
    Map<Long, Integer> totals = scores(10, -10);
    GameSession s = session(GameMode.GUOBIAO, totals, null);

    tierService.onSessionCompleted(s, totals);

    assertNull(seat(s, 1).getLadderDelta());
    assertEquals(0, seat(s, 1).getPlayer().getGamesGuobiao());
  }

  @Test
  public void 齐天大圣StarsGetHarder() {
    assertEquals(300, Ladder.starCap(6));
    assertEquals(400, Ladder.starCap(7));
    assertEquals(500, Ladder.starCap(8));
    assertEquals(new Ladder.State(7, 200), Ladder.apply(new Ladder.State(6, 290), 15, false));
    assertEquals(new Ladder.State(8, 250), Ladder.apply(new Ladder.State(7, 390), 15, false));
  }

  @Test
  public void starsFillAndEmpty() {
    // Filling a star moves to the next, half full.
    assertEquals(new Ladder.State(4, 75), Ladder.apply(new Ladder.State(3, 140), 15, false));
    // Crossing into the next tier starts half of that tier's larger star.
    assertEquals(new Ladder.State(6, 150), Ladder.apply(new Ladder.State(5, 145), 10, false));
    // Dropping below zero moves back a star, half full.
    assertEquals(new Ladder.State(2, 50), Ladder.apply(new Ladder.State(3, 10), -20, false));
    // The bottom star never drops and never goes negative.
    assertEquals(new Ladder.State(0, 0), Ladder.apply(new Ladder.State(0, 5), -20, false));
  }

  @Test
  public void newcomersCannotFallOutOf美猴王() {
    assertEquals(new Ladder.State(3, 0), Ladder.apply(new Ladder.State(3, 10), -40, true));
    assertEquals(new Ladder.State(2, 50), Ladder.apply(new Ladder.State(3, 10), -40, false));
  }

  @Test
  public void lastPlaceCostsMoreTheHigherTheTier() {
    int[] last = {3};
    assertEquals(0, Ladder.gain(last, 4, 0, GameMode.RIICHI, 0, false), 1e-9);
    assertEquals(-30, Ladder.gain(last, 4, 0, GameMode.RIICHI, 3, false), 1e-9);
    assertEquals(-50, Ladder.gain(last, 4, 0, GameMode.RIICHI, 6, false), 1e-9);
    // 1000 立直 points of 素点 is half a point.
    assertEquals(30.5, Ladder.gain(new int[] {0}, 4, 1000, GameMode.RIICHI, 3, false), 1e-9);
    // Three at the table: 1st and 2nd, then a tier-dependent last.
    assertEquals(-25, Ladder.gain(new int[] {2}, 3, 0, GameMode.RIICHI, 3, false), 1e-9);
  }

  @Test
  public void filling齐天大圣ThreeStarsReaches斗战圣佛() {
    Ladder.State dou = Ladder.apply(new Ladder.State(8, 490), 15, false);
    assertEquals(new Ladder.State(Ladder.DOU_LEVEL, Ladder.DOU_START), dou);
    assertEquals(1, Ladder.douLevel(dou.level()));
    assertEquals(0, Ladder.stars(dou.level()));
    assertEquals(Tier.LV4_THRONE, Ladder.tierOf(dou.level()));
  }

  @Test
  public void 斗战圣佛Counts豆ByPlacementAlone() {
    // 素点 does not count, however big.
    assertEquals(3, Ladder.gain(new int[] {0}, 4, 90000, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(1, Ladder.gain(new int[] {1}, 4, 0, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-1, Ladder.gain(new int[] {2}, 4, 0, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-3, Ladder.gain(new int[] {3}, 4, -90000, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-3, Ladder.gain(new int[] {2}, 3, 0, GameMode.RIICHI, 9, false), 1e-9);
    // A table of nothing but 斗战圣佛 doubles it.
    assertEquals(-6, Ladder.gain(new int[] {3}, 4, 0, GameMode.RIICHI, 9, true), 1e-9);
  }

  @Test
  public void 斗战圣佛LevelsMoveAt20AndBelowZero() {
    assertEquals(new Ladder.State(10, 10), Ladder.apply(new Ladder.State(9, 18), 3, false));
    assertEquals(new Ladder.State(9, 10), Ladder.apply(new Ladder.State(10, 1), -3, false));
    // Zero itself holds; only less than zero drops.
    assertEquals(new Ladder.State(9, 0), Ladder.apply(new Ladder.State(9, 1), -1, false));
    // Lv.1 drops back to 齐天大圣 3 stars, half full.
    assertEquals(new Ladder.State(8, 250), Ladder.apply(new Ladder.State(9, 1), -3, false));
  }

  private void seatAt(GameSession s, long playerId, int level) {
    Player p = seat(s, playerId).getPlayer();
    p.setLadderLevelRiichi(level);
    p.setLadderPointsRiichi(10);
    p.setGamesRiichi(50);
  }

  @Test
  public void anAll斗战圣佛TableDoubles() {
    Map<Long, Integer> totals = scores(30000, 10000, -10000, -30000);
    GameSession s = session(GameMode.RIICHI, totals, null);
    for (long id = 1; id <= 4; id++) seatAt(s, id, 9);

    tierService.onSessionCompleted(s, totals);

    assertEquals(6, seat(s, 1).getLadderDelta(), 1e-9);
    assertEquals(-6, seat(s, 4).getLadderDelta(), 1e-9);
  }

  @Test
  public void oneSeatBelow斗战圣佛MeansNoDoubling() {
    Map<Long, Integer> totals = scores(30000, 10000, -10000, -30000);
    GameSession s = session(GameMode.RIICHI, totals, null);
    for (long id = 1; id <= 3; id++) seatAt(s, id, 9);
    seatAt(s, 4, 8);

    tierService.onSessionCompleted(s, totals);

    assertEquals(3, seat(s, 1).getLadderDelta(), 1e-9);
    assertEquals(-50 - 15, seat(s, 4).getLadderDelta(), 1e-9, "齐天大圣 last place, with 素点");
  }

  @Test
  public void tierFollowsTheLevelOnceRanked() {
    Player p = player(1L);
    p.setLadderLevelDongbei(7);

    p.setGamesDongbei(TierService.RANKED_MIN_GAMES - 1);
    assertEquals(Tier.UNRANKED, tierService.computeTier(p, GameMode.DONGBEI));

    p.setGamesDongbei(TierService.RANKED_MIN_GAMES);
    assertEquals(Tier.LV3, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(9);
    assertEquals(Tier.LV4_THRONE, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(4);
    assertEquals(Tier.LV2, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(1);
    assertEquals(Tier.LV1, tierService.computeTier(p, GameMode.DONGBEI));
    // 国标 has no games, so it stays unranked even though 东北 is ranked.
    assertEquals(Tier.UNRANKED, tierService.computeTier(p, GameMode.GUOBIAO));
  }

  private PlayerMonthlySkill snapshot(long playerId, double rating, Integer level, Double points) {
    PlayerMonthlySkill s = new PlayerMonthlySkill();
    s.setPlayer(player(playerId));
    s.setMode(GameMode.RIICHI);
    s.setSkillRating(rating);
    s.setGames(20);
    s.setMonthlyGames(6);
    s.setPeakRating(rating);
    s.setLadderLevel(level);
    s.setLadderPoints(points);
    return s;
  }

  @Test
  public void monthsBefore段位战StillReadTheOldRating() {
    when(monthlyRepo.findByModeAndYearAndMonth(GameMode.RIICHI, 2026, 9))
        .thenReturn(List.of(snapshot(1L, 1620, null, null), snapshot(2L, 1450, null, null)));

    Map<Long, TierService.MonthlyTierInfo> tiers =
        tierService.computeMonthlySnapshotTiers(GameMode.RIICHI, 2026, 9);

    assertEquals(Tier.LV4_THRONE, tiers.get(1L).tier(), "that month's single 斗战圣佛");
    assertEquals(Tier.LV2, tiers.get(2L).tier());
    assertNull(tiers.get(1L).stars());
    assertEquals(1620, tiers.get(1L).sortScore(), 1e-9);
  }

  @Test
  public void monthsUnder段位战ReadTheLadder() {
    // A high old rating no longer matters once the month carries ladder state.
    when(monthlyRepo.findByModeAndYearAndMonth(GameMode.RIICHI, 2026, 10))
        .thenReturn(
            List.of(
                snapshot(1L, 1700, 4, 20.0),
                snapshot(2L, 1300, 7, 80.0),
                snapshot(3L, 1500, 9, 12.0),
                snapshot(4L, 1500, 10, 4.0)));

    Map<Long, TierService.MonthlyTierInfo> tiers =
        tierService.computeMonthlySnapshotTiers(GameMode.RIICHI, 2026, 10);

    assertEquals(Tier.LV2, tiers.get(1L).tier());
    assertEquals(Tier.LV3, tiers.get(2L).tier(), "the furthest-along 齐天大圣 is not singled out");
    assertEquals(2, tiers.get(2L).stars());
    assertEquals(400, tiers.get(2L).starCap());
    // 斗战圣佛 is a level, and more than one player can hold it.
    assertEquals(Tier.LV4_THRONE, tiers.get(3L).tier());
    assertEquals(Tier.LV4_THRONE, tiers.get(4L).tier());
    assertEquals(1, tiers.get(3L).douLevel());
    assertEquals(2, tiers.get(4L).douLevel());
    assertEquals(20, tiers.get(4L).starCap());
  }
}
