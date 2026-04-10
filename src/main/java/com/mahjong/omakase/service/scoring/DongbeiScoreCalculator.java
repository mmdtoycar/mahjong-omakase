package com.mahjong.omakase.service.scoring;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 抗日麻将 score calculator.
 *
 * <p>Per opponent payment formula: payment = 2^(min(fan + 庄家flag + 点炮flag + 闭门flag + 三家闭门flag, 6))
 * × payGate
 *
 * <p>Flags (0 or 1 each):
 *
 * <ul>
 *   <li>庄家flag: 1 if winner or this opponent is dealer
 *   <li>点炮flag: 1 if deal-in player (ron) or all opponents (自摸)
 *   <li>闭门flag: 1 if this opponent is 闭门
 *   <li>三家闭门flag: 1 for all if ALL opponents are 闭门
 * </ul>
 *
 * <p>payGate: opponent pays if 点炮 OR 自摸 OR 闭门, otherwise 0.
 *
 * <p>Max exponent capped at 6 → max payment = 64.
 */
@Component
public class DongbeiScoreCalculator implements ScoreCalculator {

  private static final int MAX_FAN = 6;

  @SuppressWarnings("unchecked")
  @Override
  public Map<Long, Integer> calculate(
      List<Long> playerIds, Long winnerId, Long dealInPlayerId, Map<String, Object> params) {
    int fan = ((Number) params.get("fan")).intValue();
    Long dealerId =
        params.get("dealerId") != null ? ((Number) params.get("dealerId")).longValue() : null;
    List<Long> bimenList =
        params.get("bimenPlayerIds") != null
            ? (List<Long>) params.get("bimenPlayerIds")
            : Collections.emptyList();
    Set<Long> bimenSet = new HashSet<>(bimenList);
    boolean selfDraw = dealInPlayerId == null;

    // Check 三家闭门: all opponents are 闭门
    long opponentCount = playerIds.stream().filter(id -> !id.equals(winnerId)).count();
    long bimenOpponentCount =
        playerIds.stream().filter(id -> !id.equals(winnerId) && bimenSet.contains(id)).count();
    boolean allBimen = bimenOpponentCount == opponentCount && opponentCount > 0;

    boolean winnerIsDealer = dealerId != null && dealerId.equals(winnerId);

    Map<Long, Integer> result = new HashMap<>();
    int winnerGets = 0;

    for (Long id : playerIds) {
      if (id.equals(winnerId)) continue;

      boolean isDealIn = !selfDraw && id.equals(dealInPlayerId);
      boolean isBimen = bimenSet.contains(id);
      boolean isDealer = dealerId != null && dealerId.equals(id);

      // Pay gate: pays if 点炮 or 自摸 or 闭门
      boolean pays = isDealIn || selfDraw || isBimen;
      if (!pays) {
        result.put(id, 0);
        continue;
      }

      // Calculate flags
      int zhuangjiaFlag = (winnerIsDealer || isDealer) ? 1 : 0;
      int dianpaoFlag = (isDealIn || selfDraw) ? 1 : 0;
      int bimenFlag = isBimen ? 1 : 0;
      int sanjiaBimenFlag = allBimen ? 1 : 0;

      int exponent =
          Math.min(fan + zhuangjiaFlag + dianpaoFlag + bimenFlag + sanjiaBimenFlag, MAX_FAN);
      int payment = (int) Math.pow(2, exponent);

      result.put(id, -payment);
      winnerGets += payment;
    }

    result.put(winnerId, winnerGets);
    return result;
  }
}
