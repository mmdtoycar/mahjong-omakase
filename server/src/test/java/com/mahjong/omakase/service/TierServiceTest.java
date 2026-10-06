package com.mahjong.omakase.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.PlayerMonthlySkill;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.RoundScore;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.model.Tier;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class TierServiceTest {

  private PlayerRepository playerRepo;
  private GameSessionRepository sessionRepo;
  private PlayerMonthlySkillRepository monthlyRepo;
  private TierService tierService;

  @BeforeEach
  public void setUp() {
    playerRepo = mock(PlayerRepository.class);
    sessionRepo = mock(GameSessionRepository.class);
    monthlyRepo = mock(PlayerMonthlySkillRepository.class);
    tierService = new TierService(playerRepo, sessionRepo, monthlyRepo);
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

  /** 国标's 素点 term: half a point per 8 of score — see Ladder. */
  private static double guobiaoSoten(int score) {
    return 0.5 * score / 8;
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
      assertEquals(Ladder.START_LEVEL, gsp.getLadderLevelBefore());
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
    // One share of 素点 is half a point: 1000 立直 points, 8 国标 or 2 东北.
    assertEquals(30.5, Ladder.gain(new int[] {0}, 4, 1000, GameMode.RIICHI, 3, false), 1e-9);
    assertEquals(30.5, Ladder.gain(new int[] {0}, 4, 8, GameMode.GUOBIAO, 3, false), 1e-9);
    assertEquals(30.5, Ladder.gain(new int[] {0}, 4, 2, GameMode.DONGBEI, 3, false), 1e-9);
    // Three at the table: 1st and 2nd, then a tier-dependent last.
    assertEquals(-25, Ladder.gain(new int[] {2}, 3, 0, GameMode.RIICHI, 3, false), 1e-9);
  }

  @Test
  public void filling齐天大圣ThreeStarsReaches斗战圣佛() {
    Ladder.State dou = Ladder.apply(new Ladder.State(8, 490), 15, false);
    assertEquals(new Ladder.State(Ladder.DOU_LEVEL, Ladder.DOU_START), dou);
    assertEquals(0, Ladder.stars(dou.level()));
    assertEquals(Tier.LV4_THRONE, Ladder.tierOf(dou.level()));
  }

  @Test
  public void 斗战圣佛Counts魂珠ByPlacementAlone() {
    // 素点 does not count, however big.
    assertEquals(3, Ladder.gain(new int[] {0}, 4, 90000, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(1, Ladder.gain(new int[] {1}, 4, 0, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-1, Ladder.gain(new int[] {2}, 4, 0, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-3, Ladder.gain(new int[] {3}, 4, -90000, GameMode.RIICHI, 9, false), 1e-9);
    assertEquals(-3, Ladder.gain(new int[] {2}, 3, 0, GameMode.RIICHI, 9, false), 1e-9);
    // A second 斗战圣佛 at the table doubles it.
    assertEquals(-6, Ladder.gain(new int[] {3}, 4, 0, GameMode.RIICHI, 9, true), 1e-9);
  }

  @Test
  public void 斗战圣佛魂珠HaveNoCapAndGoingNegativeDrops() {
    assertEquals(new Ladder.State(9, 21), Ladder.apply(new Ladder.State(9, 18), 3, false));
    assertEquals(new Ladder.State(9, 63), Ladder.apply(new Ladder.State(9, 60), 3, false));
    // Zero holds; below zero drops back to 齐天大圣 3 stars, half full.
    assertEquals(new Ladder.State(9, 0), Ladder.apply(new Ladder.State(9, 1), -1, false));
    assertEquals(new Ladder.State(8, 250), Ladder.apply(new Ladder.State(9, 1), -3, false));
  }

  private void seatAt(GameSession s, long playerId, int level) {
    Player p = seat(s, playerId).getPlayer();
    p.setLadderLevelRiichi(level);
    p.setLadderPointsRiichi(10);
    p.setGamesRiichi(50);
  }

  @Test
  public void two斗战圣佛AtATableDouble() {
    Map<Long, Integer> totals = scores(30000, 10000, -10000, -30000);
    GameSession s = session(GameMode.RIICHI, totals, null);
    seatAt(s, 1, 9);
    seatAt(s, 2, 8);
    seatAt(s, 3, 8);
    seatAt(s, 4, 9);

    tierService.onSessionCompleted(s, totals);

    assertEquals(6, seat(s, 1).getLadderDelta(), 1e-9);
    assertEquals(-6, seat(s, 4).getLadderDelta(), 1e-9);
    // Doubling is for 魂珠 only.
    assertEquals(10 + 5, seat(s, 2).getLadderDelta(), 1e-9, "齐天大圣 2nd place, with 素点");
  }

  @Test
  public void aLone斗战圣佛IsNotDoubled() {
    Map<Long, Integer> totals = scores(30000, 10000, -10000, -30000);
    GameSession s = session(GameMode.RIICHI, totals, null);
    seatAt(s, 1, 9);
    for (long id = 2; id <= 4; id++) seatAt(s, id, 8);

    tierService.onSessionCompleted(s, totals);

    assertEquals(3, seat(s, 1).getLadderDelta(), 1e-9);
    assertEquals(-50 - 15, seat(s, 4).getLadderDelta(), 1e-9, "齐天大圣 last place, with 素点");
  }

  @Test
  public void tierFollowsTheLevelFromTheFirstGame() {
    Player p = player(1L);
    // A new player is 美猴王 before playing at all.
    assertEquals(Tier.LV2, tierService.computeTier(p, GameMode.DONGBEI));

    p.setGamesDongbei(1);
    p.setLadderLevelDongbei(7);
    assertEquals(Tier.LV3, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(9);
    assertEquals(Tier.LV4_THRONE, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(4);
    assertEquals(Tier.LV2, tierService.computeTier(p, GameMode.DONGBEI));
    p.setLadderLevelDongbei(1);
    assertEquals(Tier.LV1, tierService.computeTier(p, GameMode.DONGBEI));
    // Bots are never ranked.
    p.setBot(true);
    assertEquals(Tier.UNRANKED, tierService.computeTier(p, GameMode.DONGBEI));
  }

  @Test
  public void backfillRecordsEachSeatsResult() {
    Map<Long, Integer> totals = scores(40000, 10000, -20000, -30000);
    GameSession s = session(GameMode.RIICHI, totals, null);
    s.setCreatedAt(LocalDateTime.of(2026, 9, 1, 20, 0));
    s.getRounds().add(round(s, totals));
    seat(s, 1).getPlayer().setLadderLevelRiichi(8);
    seat(s, 1).getPlayer().setLadderPointsRiichi(490);
    when(playerRepo.findAll())
        .thenReturn(s.getPlayers().stream().map(GameSessionPlayer::getPlayer).toList());
    when(sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.COMPLETED))
        .thenReturn(List.of(s));

    assertEquals(new TierService.BackfillResult(1, 0), tierService.backfillLadder());

    // The replay starts everyone over, so the earlier 齐天大圣 level is gone.
    GameSessionPlayer first = seat(s, 1);
    assertEquals(Ladder.START_LEVEL, first.getLadderLevelBefore());
    assertEquals(30 + 0.5 * 40, first.getLadderDelta(), 1e-9);
    assertEquals(Ladder.START_LEVEL, first.getLadderLevelAfter());
    assertEquals(75 + 30 + 0.5 * 40, first.getLadderPointsAfter(), 1e-9);
    // History does not count as games played; those counters were already right.
    assertEquals(0, first.getPlayer().getGamesRiichi());
  }

  @Test
  public void backfillSkipsASessionWithNoRounds() {
    GameSession s = session(GameMode.RIICHI, scores(0, 0, 0, 0), null);
    s.setCreatedAt(LocalDateTime.of(2026, 9, 1, 20, 0));
    when(playerRepo.findAll())
        .thenReturn(s.getPlayers().stream().map(GameSessionPlayer::getPlayer).toList());
    when(sessionRepo.findByStatusOrderByCreatedAtDesc(SessionStatus.COMPLETED))
        .thenReturn(List.of(s));

    assertEquals(new TierService.BackfillResult(0, 1), tierService.backfillLadder());
    assertNull(seat(s, 1).getLadderDelta());
  }

  private static Round round(GameSession s, Map<Long, Integer> totals) {
    Round r = new Round();
    r.setGameSession(s);
    for (GameSessionPlayer gsp : s.getPlayers()) {
      RoundScore rs = new RoundScore();
      rs.setRound(r);
      rs.setPlayer(gsp.getPlayer());
      rs.setScore(totals.get(gsp.getPlayer().getId()));
      r.getScores().add(rs);
    }
    return r;
  }

  @Test
  public void movesNameStarsAndTiers() {
    assertNull(Ladder.move(4, 4));
    assertEquals("STAR_UP", Ladder.move(3, 4));
    assertEquals("TIER_UP", Ladder.move(5, 6));
    assertEquals("TIER_UP", Ladder.move(8, 9), "into 斗战圣佛");
    assertEquals("STAR_DOWN", Ladder.move(4, 3));
    assertEquals("TIER_DOWN", Ladder.move(3, 2));
  }

  @Test
  public void aSeatShowsItsStateAfterThatGame() {
    Map<Long, Integer> totals = scores(100, 20, -40, -80);
    GameSession s = session(GameMode.GUOBIAO, totals, null);
    GameSessionPlayer gsp = seat(s, 1);
    Player p = gsp.getPlayer();
    p.setLadderLevelGuobiao(7);

    // Not rated yet: the live state.
    assertEquals("LV3", tierService.seatTier(gsp, GameMode.GUOBIAO).getTier());

    gsp.setLadderLevelAfter(4);
    gsp.setLadderPointsAfter(98.0);
    var info = tierService.seatTier(gsp, GameMode.GUOBIAO);
    assertEquals("LV2", info.getTier());
    assertEquals(2, info.getStars());
    assertEquals(98.0, info.getPoints(), 1e-9);
    assertEquals(150, info.getStarCap());
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
                snapshot(4L, 1500, 9, 40.0)));

    Map<Long, TierService.MonthlyTierInfo> tiers =
        tierService.computeMonthlySnapshotTiers(GameMode.RIICHI, 2026, 10);

    assertEquals(Tier.LV2, tiers.get(1L).tier());
    assertEquals(Tier.LV3, tiers.get(2L).tier(), "the furthest-along 齐天大圣 is not singled out");
    assertEquals(2, tiers.get(2L).stars());
    assertEquals(400, tiers.get(2L).starCap());
    // More than one player can be 斗战圣佛, and their 魂珠 have no cap.
    assertEquals(Tier.LV4_THRONE, tiers.get(3L).tier());
    assertEquals(Tier.LV4_THRONE, tiers.get(4L).tier());
    assertEquals(40.0, tiers.get(4L).ladderPoints(), 1e-9);
    assertEquals(0, tiers.get(4L).starCap());
  }

  @Test
  public void fiveGamesToRankOnlyAppliesBefore段位战() {
    PlayerMonthlySkill ladder = snapshot(1L, 1500, 3, 75.0);
    ladder.setGames(1);
    PlayerMonthlySkill legacy = snapshot(2L, 1450, null, null);
    legacy.setGames(TierService.RANKED_MIN_GAMES - 1);
    when(monthlyRepo.findByModeAndYearAndMonth(GameMode.RIICHI, 2026, 10))
        .thenReturn(List.of(ladder, legacy));

    Map<Long, TierService.MonthlyTierInfo> tiers =
        tierService.computeMonthlySnapshotTiers(GameMode.RIICHI, 2026, 10);

    assertEquals(Tier.LV2, tiers.get(1L).tier());
    assertEquals(Tier.UNRANKED, tiers.get(2L).tier());
    assertEquals(1, tiers.get(2L).gamesNeeded());
  }
}
