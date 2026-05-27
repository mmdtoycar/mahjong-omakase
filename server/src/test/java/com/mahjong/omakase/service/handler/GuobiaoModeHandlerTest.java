package com.mahjong.omakase.service.handler;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.GuobiaoScoreCalculator;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class GuobiaoModeHandlerTest {

  private GuobiaoScoreCalculator calculator;
  private GuobiaoModeHandler handler;

  @BeforeEach
  public void setUp() {
    calculator = mock(GuobiaoScoreCalculator.class);
    handler = new GuobiaoModeHandler(calculator);
  }

  @Test
  public void testGetGameMode() {
    assertEquals(GameMode.GUOBIAO, handler.getGameMode());
  }

  @Test
  public void testStandardWinNoFlowers() {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(8);
    request.setFanDetails("平和(2), 断幺(2), 自摸(1), 双暗刻(2), 单钓将(1)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> expectedScores = new HashMap<>();
    expectedScores.put(1L, 48);
    expectedScores.put(2L, -16);
    expectedScores.put(3L, -16);
    expectedScores.put(4L, -16);

    when(calculator.calculate(eq(sessionPlayerIds), eq(1L), eq(null), anyMap()))
        .thenReturn(expectedScores);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);
    assertEquals(expectedScores, actualScores);
  }

  @Test
  public void testChomboExploitingFlowers() {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(8);
    // 6 points base + 2 points flower = 8 points. Base is less than 8, so it's a chombo!
    request.setFanDetails("平和(2), 断幺(2), 自摸(1), 单钓将(1), 花牌(2)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);

    // Chombo penalty: offender (1L) pays 15 to each other player
    // So 1L loses (4-1)*15 = 45 points, others get +15
    assertEquals(-45, actualScores.get(1L));
    assertEquals(15, actualScores.get(2L));
    assertEquals(15, actualScores.get(3L));
    assertEquals(15, actualScores.get(4L));

    verifyNoInteractions(calculator);
  }

  @Test
  public void testValidWinWithFlowers() {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(10);
    // 8 points base + 2 points flower = 10 points. Base is 8 >= 8, so it's a valid win!
    request.setFanDetails("平和(2), 断幺(2), 自摸(1), 双暗刻(2), 单钓将(1), 花牌(2)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> expectedScores = new HashMap<>();
    expectedScores.put(1L, 54);
    expectedScores.put(2L, -18);
    expectedScores.put(3L, -18);
    expectedScores.put(4L, -18);

    when(calculator.calculate(eq(sessionPlayerIds), eq(1L), eq(null), anyMap()))
        .thenReturn(expectedScores);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);
    assertEquals(expectedScores, actualScores);
  }

  @Test
  public void testManualChombo() {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(null); // score can be null for manual chombo!
    request.setChombo(true);

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);

    // Penalty: offender (1L) pays 15 to each other player
    assertEquals(-45, actualScores.get(1L));
    assertEquals(15, actualScores.get(2L));
    assertEquals(15, actualScores.get(3L));
    assertEquals(15, actualScores.get(4L));

    verifyNoInteractions(calculator);
  }

  @Test
  public void testNullScoreThrowsExceptionEvenWithFlowers() {
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(null);
    request.setFanDetails("花牌(2)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> {
              handler.calculateRoundScores(request, sessionPlayerIds);
            });

    assertEquals("Score is required", exception.getMessage());
    verifyNoInteractions(calculator);
  }

  @Test
  public void testValidWinWithFlowersUsingMultiCountFormat() {
    // Regression: the UI emits "花牌(NxC)" where N is the already-summed total flower score and
    // C is the flower count. Server must read N alone (not N*C), otherwise a legitimate 8-fan
    // hand with multiple flowers gets falsely flagged as chombo.
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(10);
    // 8 base fan + 2 flowers (huaCount=2) → flowers serialize as 花牌(2x2), total 10.
    request.setFanDetails("平和(2), 断幺(2), 自摸(1), 双暗刻(2), 单钓将(1), 花牌(2x2)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> expectedScores = new HashMap<>();
    expectedScores.put(1L, 54);
    expectedScores.put(2L, -18);
    expectedScores.put(3L, -18);
    expectedScores.put(4L, -18);

    when(calculator.calculate(eq(sessionPlayerIds), eq(1L), eq(null), anyMap()))
        .thenReturn(expectedScores);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);
    assertEquals(expectedScores, actualScores);
  }

  @Test
  public void testChomboWithMultiCountFlowerFormat() {
    // 6 base fan + 4 flowers (huaCount=4 → 花牌(4x4)). Base 6 < 8 ⇒ chombo.
    // Pre-fix server computed flowerScore = 4*4 = 16 and scoreWithoutFlowers = 10 - 16 = -6
    // (still chombo, but for the wrong reason). Post-fix: flowerScore = 4, scoreWithoutFlowers = 6.
    AddRoundRequest request = new AddRoundRequest();
    request.setRoundType("WIN");
    request.setWinnerId(1L);
    request.setDealInPlayerId(null);
    request.setScore(10);
    request.setFanDetails("平和(2), 断幺(2), 自摸(1), 单钓将(1), 花牌(4x4)");

    List<Long> sessionPlayerIds = Arrays.asList(1L, 2L, 3L, 4L);

    Map<Long, Integer> actualScores = handler.calculateRoundScores(request, sessionPlayerIds);

    assertEquals(-45, actualScores.get(1L));
    assertEquals(15, actualScores.get(2L));
    assertEquals(15, actualScores.get(3L));
    assertEquals(15, actualScores.get(4L));
    verifyNoInteractions(calculator);
  }
}
