package com.mahjong.omakase.service.scoring;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 国标麻将 score calculator.
 *
 * <p>Base payment: every non-winner pays 8 to the winner regardless of win type.
 *
 * <p>点炮 (Ron): deal-in player pays (score + 8), each other player pays 8. Winner total = score + 8
 * × (numPlayers - 1)
 *
 * <p>自摸 (Tsumo): each other player pays (score + 8). Winner total = (score + 8) × (numPlayers - 1)
 */
@Component
public class GuobiaoScoreCalculator implements ScoreCalculator {

  private static final int BASE_PAYMENT = 8;

  @Override
  public Map<Long, Integer> calculate(
      List<Long> playerIds, Long winnerId, Long dealInPlayerId, Map<String, Object> params) {
    int score = ((Number) params.get("score")).intValue();
    boolean selfDraw = dealInPlayerId == null;

    Map<Long, Integer> result = new HashMap<>();
    for (Long id : playerIds) {
      result.put(id, 0);
    }

    int winnerGets = 0;

    if (selfDraw) {
      // 自摸: each other player pays (score + 8)
      int eachPays = score + BASE_PAYMENT;
      for (Long id : playerIds) {
        if (!id.equals(winnerId)) {
          result.put(id, -eachPays);
          winnerGets += eachPays;
        }
      }
    } else {
      // 点炮: deal-in pays (score + 8), others pay 8
      for (Long id : playerIds) {
        if (id.equals(winnerId)) continue;
        if (id.equals(dealInPlayerId)) {
          int pays = score + BASE_PAYMENT;
          result.put(id, -pays);
          winnerGets += pays;
        } else {
          result.put(id, -BASE_PAYMENT);
          winnerGets += BASE_PAYMENT;
        }
      }
    }

    result.put(winnerId, winnerGets);
    return result;
  }
}
