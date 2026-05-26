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

  private RiichiScoreCalculator calculator;
  private RiichiModeHandler handler;

  @BeforeEach
  public void setUp() {
    calculator = mock(RiichiScoreCalculator.class);
    handler = new RiichiModeHandler(calculator);
  }

  @Test
  public void testGetGameMode() {
    assertEquals(GameMode.RIICHI, handler.getGameMode());
  }

  @Test
  public void testDirectScoreDealerTsumoSanma() {
    // Sanma: 3 players (1L, 2L, 3L). 1L is winner & dealer (Oya).
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(24000); // 12000 * 2
    request.setHonba(0);
    request.setKyoutaku(0);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(24000, scores.get(1L));
    assertEquals(-12000, scores.get(2L));
    assertEquals(-12000, scores.get(3L));
  }

  @Test
  public void testDirectScoreNonDealerTsumoSanma() {
    // Sanma: 3 players (1L, 2L, 3L). 1L is winner, 2L is dealer (Oya).
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(2L);
    request.setDealInPlayerId(null);
    request.setScore(18000); // 12000 from dealer, 6000 from non-dealer
    request.setHonba(0);
    request.setKyoutaku(0);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(18000, scores.get(1L));
    assertEquals(-12000, scores.get(2L)); // Dealer pays 2/3 of 18000
    assertEquals(-6000, scores.get(3L)); // Non-dealer pays 1/3 of 18000
  }

  @Test
  public void testDirectScoreDealerTsumoYonma() {
    // Yonma: 4 players. 1L is winner & dealer.
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(36000);
    request.setHonba(0);
    request.setKyoutaku(0);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(36000, scores.get(1L));
    assertEquals(-12000, scores.get(2L));
    assertEquals(-12000, scores.get(3L));
    assertEquals(-12000, scores.get(4L));
  }

  @Test
  public void testDirectScoreNonDealerTsumoYonma() {
    // Yonma: 4 players. 1L is winner, 2L is dealer.
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(2L);
    request.setDealInPlayerId(null);
    request.setScore(24000);
    request.setHonba(0);
    request.setKyoutaku(0);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(24000, scores.get(1L));
    assertEquals(-12000, scores.get(2L)); // Dealer pays 2/4 of 24000
    assertEquals(-6000, scores.get(3L)); // Non-dealer pays 1/4 of 24000
    assertEquals(-6000, scores.get(4L)); // Non-dealer pays 1/4 of 24000
  }

  @Test
  public void testDirectScoreNonDealerTsumoWithRiichi() {
    // Yonma: 4 players. 1L is winner, 2L is dealer.
    // Non-dealer Tsumo Mangan (base score 8000). Player 3L declared Riichi.
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(2L);
    request.setDealInPlayerId(null);
    request.setScore(8000);
    request.setHonba(0);
    request.setKyoutaku(0);
    request.setRiichiPlayerIds(Arrays.asList(3L)); // Player 3L declared Riichi

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    // Winner 1L gets 8000 (Tsumo base) + 1000 (Riichi stick) = 9000
    assertEquals(9000, scores.get(1L));
    // Dealer 2L pays 2/4 of 8000 = 4000
    assertEquals(-4000, scores.get(2L));
    // Player 3L pays 1/4 of 8000 (2000) + 1000 (Riichi stick) = 3000
    assertEquals(-3000, scores.get(3L));
    // Player 4L pays 1/4 of 8000 = 2000
    assertEquals(-2000, scores.get(4L));
  }

  @Test
  public void testDirectScoreNonDealerTsumoWithPinfu3Han() {
    // Yonma: 4 players. 1L is winner, 2L is dealer.
    // Non-dealer Tsumo Pinfu 3 Han (2700 total: 1300 from dealer, 700 from each other non-dealer).
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealerId(2L);
    request.setDealInPlayerId(null);
    request.setScore(2700);
    request.setHonba(0);
    request.setKyoutaku(0);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> scores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(2700, scores.get(1L));
    assertEquals(-1300, scores.get(2L)); // Dealer pays 1300
    assertEquals(-700, scores.get(3L)); // Non-dealer pays 700
    assertEquals(-700, scores.get(4L)); // Non-dealer pays 700
  }
}
