package com.mahjong.omakase.service.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RiichiScoreCalculatorTest {

  private static final List<Long> TABLE = List.of(1L, 2L, 3L, 4L);
  private final RiichiScoreCalculator calculator = new RiichiScoreCalculator();

  private Map<Long, Integer> ron(int han, int fu, long dealer, int honba) {
    return calculator.calculate(
        TABLE,
        2L,
        3L,
        Map.of("fan", han, "fu", fu, "dealerId", dealer, "honba", honba, "kyoutaku", 0));
  }

  @Test
  void theSameHandIsWorthMoreToTheDealer() {
    assertThat(ron(3, 40, 1L, 0)).containsEntry(2L, 5200).containsEntry(3L, -5200);
    assertThat(ron(3, 40, 2L, 0)).containsEntry(2L, 7700).containsEntry(3L, -7700);
  }

  @Test
  void eachHonbaAddsThreeHundredFromTheDiscarder() {
    assertThat(ron(3, 40, 1L, 5)).containsEntry(2L, 6700).containsEntry(3L, -6700);
  }

  @Test
  void thirteenHanOrMoreIsOneYakuman() {
    assertThat(ron(13, 20, 1L, 0)).containsEntry(2L, 32000);
    assertThat(ron(26, 20, 1L, 0)).containsEntry(2L, 32000);
  }

  @Test
  void aNonDealerTsumoSplitsOneAndTwoShares() {
    Map<Long, Integer> scores =
        calculator.calculate(
            TABLE, 3L, null, Map.of("fan", 3, "fu", 30, "dealerId", 2L, "honba", 1, "kyoutaku", 0));
    assertThat(scores)
        .containsEntry(3L, 4300)
        .containsEntry(2L, -2100)
        .containsEntry(1L, -1100)
        .containsEntry(4L, -1100);
  }
}
