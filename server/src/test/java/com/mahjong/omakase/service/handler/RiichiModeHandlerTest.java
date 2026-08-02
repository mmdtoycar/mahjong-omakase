package com.mahjong.omakase.service.handler;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.RiichiScoreCalculator;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class RiichiModeHandlerTest {

  private static final List<Long> YONMA = Arrays.asList(1L, 2L, 3L, 4L);
  private static final List<Long> SANMA = Arrays.asList(1L, 2L, 3L);

  private RiichiScoreCalculator calculator;
  private RiichiModeHandler handler;

  @BeforeEach
  public void setUp() {
    calculator = mock(RiichiScoreCalculator.class);
    handler = new RiichiModeHandler(calculator);
  }

  private AddRoundRequest tsumo(Long winnerId, Long dealerId, int score) {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(winnerId);
    request.setDealerId(dealerId);
    request.setDealInPlayerId(null);
    request.setScore(score);
    request.setHonba(0);
    request.setKyoutaku(0);
    return request;
  }

  private AddRoundRequest drawnGame(List<Long> tenpaiIds) {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("DRAWN_GAME");
    request.setTenpaiPlayerIds(tenpaiIds);
    return request;
  }

  private void assertZeroSum(Map<Long, Integer> scores, int kyoutaku) {
    int sum = scores.values().stream().mapToInt(Integer::intValue).sum();
    assertEquals(kyoutaku, sum, "scores must sum to kyoutaku (carried-over riichi sticks)");
  }

  @Test
  public void testGetGameMode() {
    assertEquals(GameMode.RIICHI, handler.getGameMode());
  }

  // ============================================================
  // Yonma — Dealer self-draw (Oya tsumo): each non-dealer pays p
  // ============================================================

  @Test
  public void testYonmaDealerTsumo_1Han30Fu() {
    // basicPoints = 30 * 2^3 = 240; each pays ceil(480/100)*100 = 500; total 1500
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 1500), YONMA);
    assertEquals(1500, scores.get(1L));
    assertEquals(-500, scores.get(2L));
    assertEquals(-500, scores.get(3L));
    assertEquals(-500, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_2Han30Fu() {
    // basicPoints = 480; each pays 1000; total 3000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 3000), YONMA);
    assertEquals(3000, scores.get(1L));
    assertEquals(-1000, scores.get(2L));
    assertEquals(-1000, scores.get(3L));
    assertEquals(-1000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_3Han20FuPinfu() {
    // basicPoints = 20 * 2^5 = 640; each pays ceil(1280/100)*100 = 1300; total 3900
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 3900), YONMA);
    assertEquals(3900, scores.get(1L));
    assertEquals(-1300, scores.get(2L));
    assertEquals(-1300, scores.get(3L));
    assertEquals(-1300, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_4Han30Fu() {
    // basicPoints = 30 * 2^6 = 1920 (below mangan cap); each pays ceil(3840/100)*100 = 3900; total
    // 11700
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 11700), YONMA);
    assertEquals(11700, scores.get(1L));
    assertEquals(-3900, scores.get(2L));
    assertEquals(-3900, scores.get(3L));
    assertEquals(-3900, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_Mangan() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 12000), YONMA);
    assertEquals(12000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-4000, scores.get(3L));
    assertEquals(-4000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_Haneman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 18000), YONMA);
    assertEquals(18000, scores.get(1L));
    assertEquals(-6000, scores.get(2L));
    assertEquals(-6000, scores.get(3L));
    assertEquals(-6000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_Baiman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 24000), YONMA);
    assertEquals(24000, scores.get(1L));
    assertEquals(-8000, scores.get(2L));
    assertEquals(-8000, scores.get(3L));
    assertEquals(-8000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_Sanbaiman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 36000), YONMA);
    assertEquals(36000, scores.get(1L));
    assertEquals(-12000, scores.get(2L));
    assertEquals(-12000, scores.get(3L));
    assertEquals(-12000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaDealerTsumo_Yakuman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 48000), YONMA);
    assertEquals(48000, scores.get(1L));
    assertEquals(-16000, scores.get(2L));
    assertEquals(-16000, scores.get(3L));
    assertEquals(-16000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  // ====================================================================
  // Yonma — Non-dealer self-draw (Ko tsumo): dealer pays d, others pay n
  // ====================================================================

  @Test
  public void testYonmaNonDealerTsumo_1Han30Fu() {
    // basicPoints = 240; d = ceil(480/100)*100 = 500, n = 300; total 1100
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 1100), YONMA);
    assertEquals(1100, scores.get(1L));
    assertEquals(-500, scores.get(2L));
    assertEquals(-300, scores.get(3L));
    assertEquals(-300, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_1Han40Fu() {
    // basicPoints = 320; d = ceil(640/100)*100 = 700, n = 400; total 1500
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 1500), YONMA);
    assertEquals(1500, scores.get(1L));
    assertEquals(-700, scores.get(2L));
    assertEquals(-400, scores.get(3L));
    assertEquals(-400, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_2Han30Fu() {
    // basicPoints = 480; d = 1000, n = 500; total 2000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 2000), YONMA);
    assertEquals(2000, scores.get(1L));
    assertEquals(-1000, scores.get(2L));
    assertEquals(-500, scores.get(3L));
    assertEquals(-500, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_2Han40Fu() {
    // basicPoints = 640; d = 1300, n = 700; total 2700
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 2700), YONMA);
    assertEquals(2700, scores.get(1L));
    assertEquals(-1300, scores.get(2L));
    assertEquals(-700, scores.get(3L));
    assertEquals(-700, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_3Han30Fu() {
    // basicPoints = 960; d = ceil(1920/100)*100 = 2000, n = 1000; total 4000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 4000), YONMA);
    assertEquals(4000, scores.get(1L));
    assertEquals(-2000, scores.get(2L));
    assertEquals(-1000, scores.get(3L));
    assertEquals(-1000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_4Han20FuPinfu() {
    // basicPoints = 20 * 2^6 = 1280; d = ceil(2560/100)*100 = 2600, n = 1300; total 5200
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 5200), YONMA);
    assertEquals(5200, scores.get(1L));
    assertEquals(-2600, scores.get(2L));
    assertEquals(-1300, scores.get(3L));
    assertEquals(-1300, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_4Han30Fu() {
    // basicPoints = 1920 (just under mangan); d = ceil(3840/100)*100 = 3900, n = 2000; total 7900
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 7900), YONMA);
    assertEquals(7900, scores.get(1L));
    assertEquals(-3900, scores.get(2L));
    assertEquals(-2000, scores.get(3L));
    assertEquals(-2000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_Mangan() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 8000), YONMA);
    assertEquals(8000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-2000, scores.get(3L));
    assertEquals(-2000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_Haneman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 12000), YONMA);
    assertEquals(12000, scores.get(1L));
    assertEquals(-6000, scores.get(2L));
    assertEquals(-3000, scores.get(3L));
    assertEquals(-3000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_Baiman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 16000), YONMA);
    assertEquals(16000, scores.get(1L));
    assertEquals(-8000, scores.get(2L));
    assertEquals(-4000, scores.get(3L));
    assertEquals(-4000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_Sanbaiman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 24000), YONMA);
    assertEquals(24000, scores.get(1L));
    assertEquals(-12000, scores.get(2L));
    assertEquals(-6000, scores.get(3L));
    assertEquals(-6000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_Yakuman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 32000), YONMA);
    assertEquals(32000, scores.get(1L));
    assertEquals(-16000, scores.get(2L));
    assertEquals(-8000, scores.get(3L));
    assertEquals(-8000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_DealerIsLastInPlayerOrder() {
    // Verify that share assignment is by role (dealer vs non-dealer), not by player iteration
    // order.
    // Here 4L is dealer (last in the list) and 1L is winner.
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 4L, 2700), YONMA);
    assertEquals(2700, scores.get(1L));
    assertEquals(-700, scores.get(2L));
    assertEquals(-700, scores.get(3L));
    assertEquals(-1300, scores.get(4L)); // dealer
    assertZeroSum(scores, 0);
  }

  // ====================================================================
  // Sanma — Dealer self-draw: each of the 2 non-dealers pays p
  // ====================================================================

  @Test
  public void testSanmaDealerTsumo_3Han20FuPinfu() {
    // each pays 1300; total 2600
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 2600), SANMA);
    assertEquals(2600, scores.get(1L));
    assertEquals(-1300, scores.get(2L));
    assertEquals(-1300, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaDealerTsumo_Mangan() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 8000), SANMA);
    assertEquals(8000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-4000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaDealerTsumo_Haneman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 12000), SANMA);
    assertEquals(12000, scores.get(1L));
    assertEquals(-6000, scores.get(2L));
    assertEquals(-6000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaDealerTsumo_Baiman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 16000), SANMA);
    assertEquals(16000, scores.get(1L));
    assertEquals(-8000, scores.get(2L));
    assertEquals(-8000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaDealerTsumo_Yakuman() {
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 1L, 32000), SANMA);
    assertEquals(32000, scores.get(1L));
    assertEquals(-16000, scores.get(2L));
    assertEquals(-16000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  // ====================================================================
  // Sanma — Non-dealer self-draw: dealer pays d, the other non-dealer pays n
  // ====================================================================

  @Test
  public void testSanmaNonDealerTsumo_3Han20FuPinfu() {
    // d = 1300, n = 700; total 2000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 2000), SANMA);
    assertEquals(2000, scores.get(1L));
    assertEquals(-1300, scores.get(2L));
    assertEquals(-700, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_2Han40Fu() {
    // d = 1300, n = 700; total 2000 (same payment shape as 3han20fu)
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 3L, 2000), SANMA);
    assertEquals(2000, scores.get(1L));
    assertEquals(-700, scores.get(2L));
    assertEquals(-1300, scores.get(3L)); // dealer
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_Mangan() {
    // d = 4000, n = 2000; total 6000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 6000), SANMA);
    assertEquals(6000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-2000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_Haneman() {
    // d = 6000, n = 3000; total 9000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 9000), SANMA);
    assertEquals(9000, scores.get(1L));
    assertEquals(-6000, scores.get(2L));
    assertEquals(-3000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_Baiman() {
    // d = 8000, n = 4000; total 12000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 12000), SANMA);
    assertEquals(12000, scores.get(1L));
    assertEquals(-8000, scores.get(2L));
    assertEquals(-4000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_Yakuman() {
    // d = 16000, n = 8000; total 24000
    Map<Long, Integer> scores = handler.calculateRoundScores(tsumo(1L, 2L, 24000), SANMA);
    assertEquals(24000, scores.get(1L));
    assertEquals(-16000, scores.get(2L));
    assertEquals(-8000, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  // ====================================================================
  // Honba: tsumo adds 100 yen per non-winner per honba
  // ====================================================================

  @Test
  public void testYonmaDealerTsumo_ManganWith2Honba() {
    AddRoundRequest request = tsumo(1L, 1L, 12000);
    request.setHonba(2);
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    // each non-dealer: 4000 + 200 = 4200; winner: 12000 + 600 = 12600
    assertEquals(12600, scores.get(1L));
    assertEquals(-4200, scores.get(2L));
    assertEquals(-4200, scores.get(3L));
    assertEquals(-4200, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testYonmaNonDealerTsumo_ManganWith3Honba() {
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setHonba(3);
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    // dealer: 4000 + 300 = 4300; non-dealers: 2000 + 300 = 2300; winner: 8000 + 900 = 8900
    assertEquals(8900, scores.get(1L));
    assertEquals(-4300, scores.get(2L));
    assertEquals(-2300, scores.get(3L));
    assertEquals(-2300, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testSanmaNonDealerTsumo_ManganWith1Honba() {
    AddRoundRequest request = tsumo(1L, 2L, 6000);
    request.setHonba(1);
    Map<Long, Integer> scores = handler.calculateRoundScores(request, SANMA);
    // dealer: 4000 + 100 = 4100; other non-dealer: 2000 + 100 = 2100; winner: 6000 + 200 = 6200
    assertEquals(6200, scores.get(1L));
    assertEquals(-4100, scores.get(2L));
    assertEquals(-2100, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  // ====================================================================
  // Kyoutaku: carried-over riichi sticks go to winner only
  // ====================================================================

  @Test
  public void testTsumoWith2Kyoutaku() {
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setKyoutaku(2000); // 2 sticks worth, expressed in yen
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    // winner gets 8000 + 2000 (kyoutaku); per-player payments unchanged
    assertEquals(10000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-2000, scores.get(3L));
    assertEquals(-2000, scores.get(4L));
    assertZeroSum(scores, 2000);
  }

  // ====================================================================
  // Riichi sticks declared this round
  // ====================================================================

  @Test
  public void testTsumoWithWinnerOnlyRiichi() {
    // Winner self-declared riichi: pays -1000, then receives back +1000 from riichi pool → net 0
    // from stick
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setRiichiPlayerIds(Arrays.asList(1L));
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    assertEquals(8000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-2000, scores.get(3L));
    assertEquals(-2000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testTsumoWithMultipleNonWinnerRiichi() {
    // Two non-winners declare riichi; winner receives the 2000-yen pool.
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setRiichiPlayerIds(Arrays.asList(3L, 4L));
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    assertEquals(10000, scores.get(1L)); // 8000 + 2000 from riichi pool
    assertEquals(-4000, scores.get(2L));
    assertEquals(-3000, scores.get(3L)); // -2000 share + -1000 stick
    assertEquals(-3000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testTsumoWithDuplicateRiichiIdsCountedOnce() {
    // Dedup: same id appearing twice should still only count as one stick.
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setRiichiPlayerIds(Arrays.asList(3L, 3L));
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    assertEquals(9000, scores.get(1L));
    assertEquals(-4000, scores.get(2L));
    assertEquals(-3000, scores.get(3L));
    assertEquals(-2000, scores.get(4L));
    assertZeroSum(scores, 0);
  }

  @Test
  public void testTsumoWithRiichiAndKyoutakuAndHonba() {
    // Composite: non-dealer mangan tsumo + 1 honba + 1 carried-over kyoutaku stick + 3L declared
    // riichi this round.
    AddRoundRequest request = tsumo(1L, 2L, 8000);
    request.setHonba(1);
    request.setKyoutaku(1000); // 1 stick worth, expressed in yen
    request.setRiichiPlayerIds(Arrays.asList(3L));
    Map<Long, Integer> scores = handler.calculateRoundScores(request, YONMA);
    // dealer: -(4000 + 100) = -4100
    // 3L: -(2000 + 100) - 1000 = -3100
    // 4L: -(2000 + 100) = -2100
    // winner: 8000 + 300 (honba) + 1000 (kyoutaku) + 1000 (this-round riichi pool) = 10300
    assertEquals(10300, scores.get(1L));
    assertEquals(-4100, scores.get(2L));
    assertEquals(-3100, scores.get(3L));
    assertEquals(-2100, scores.get(4L));
    assertZeroSum(scores, 1000);
  }

  @Test
  public void testSanmaNonDealerTsumoWithHonbaAndRiichi() {
    AddRoundRequest request = tsumo(1L, 2L, 6000); // mangan non-dealer in sanma
    request.setHonba(2);
    request.setRiichiPlayerIds(Arrays.asList(3L));
    Map<Long, Integer> scores = handler.calculateRoundScores(request, SANMA);
    // dealer: -(4000 + 200) = -4200
    // 3L: -(2000 + 200) - 1000 = -3200
    // winner: 6000 + 400 (honba) + 1000 (this-round riichi) = 7400
    assertEquals(7400, scores.get(1L));
    assertEquals(-4200, scores.get(2L));
    assertEquals(-3200, scores.get(3L));
    assertZeroSum(scores, 0);
  }

  // ============================================================
  // Drawn game (流局) — tenpai list validation and noten payments
  // ============================================================

  @Test
  public void testDrawnGameRejectsMissingTenpaiList() {
    AddRoundRequest request = drawnGame(null);
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> handler.calculateRoundScores(request, YONMA));
    assertEquals("Tenpai player list is required for drawn game", e.getMessage());
  }

  @Test
  public void testDrawnGameRejectsTenpaiPlayerOutsideSession() {
    AddRoundRequest request = drawnGame(Arrays.asList(1L, 99L));
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> handler.calculateRoundScores(request, YONMA));
    assertEquals("Player 99 is not in this session", e.getMessage());
  }

  @Test
  public void testDrawnGameAllNotenIsValidWithNoPointMovement() {
    Map<Long, Integer> scores = handler.calculateRoundScores(drawnGame(List.of()), YONMA);
    for (Long id : YONMA) {
      assertEquals(0, scores.get(id));
    }
    assertZeroSum(scores, 0);
  }

  @Test
  public void testDrawnGameTwoTenpaiPayments() {
    Map<Long, Integer> scores =
        handler.calculateRoundScores(drawnGame(Arrays.asList(1L, 2L)), YONMA);
    assertEquals(1500, scores.get(1L));
    assertEquals(1500, scores.get(2L));
    assertEquals(-1500, scores.get(3L));
    assertEquals(-1500, scores.get(4L));
    assertZeroSum(scores, 0);
  }
}
