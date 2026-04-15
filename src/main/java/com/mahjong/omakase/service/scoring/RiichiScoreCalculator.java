package com.mahjong.omakase.service.scoring;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Riichi (立直麻将) score calculator.
 *
 * <p>Formula: basicPoints = fu × 2^(2+han), capped at limit hands.
 *
 * <p>Ron: Non-dealer winner: discarder pays basicPoints × 4 (rounded up to 100) Dealer winner:
 * discarder pays basicPoints × 6 (rounded up to 100)
 *
 * <p>Tsumo: Dealer winner: each other player pays basicPoints × 2 (rounded up to 100) Non-dealer
 * winner: dealer pays basicPoints × 2, each non-dealer pays basicPoints × 1 (each rounded up to
 * 100)
 *
 * <p>Requires dealerId (table dealer/親) to determine asymmetric tsumo payments.
 */
@Component
public class RiichiScoreCalculator implements ScoreCalculator {

  private static int roundUp100(int value) {
    return (int) Math.ceil(value / 100.0) * 100;
  }

  static int calculateBasicPoints(int han, int fu) {
    if (han >= 13) return 8000; // Yakuman
    if (han >= 11) return 6000; // Sanbaiman
    if (han >= 8) return 4000; // Baiman
    if (han >= 6) return 3000; // Haneman
    if (han >= 5) return 2000; // Mangan
    // 切上満貫 (kiriage mangan): 1920 basic points rounds up to mangan
    if (han == 4 && fu >= 30) return 2000;
    if (han == 3 && fu >= 60) return 2000;

    return Math.min((int) (fu * Math.pow(2, 2 + han)), 2000);
  }

  @Override
  public Map<Long, Integer> calculate(
      List<Long> playerIds, Long winnerId, Long dealInPlayerId, Map<String, Object> params) {
    int han = ((Number) params.get("han")).intValue();
    int fu = ((Number) params.get("fu")).intValue();
    Long dealerId =
        params.get("dealerId") != null ? ((Number) params.get("dealerId")).longValue() : null;
    int honba = params.get("honba") != null ? ((Number) params.get("honba")).intValue() : 0;
    int kyoutaku =
        params.get("kyoutaku") != null ? ((Number) params.get("kyoutaku")).intValue() : 0;
    boolean winnerIsDealer = dealerId != null && dealerId.equals(winnerId);
    boolean selfDraw = dealInPlayerId == null;

    int basicPoints = calculateBasicPoints(han, fu);
    // 本場: each paying player adds 100 × honba
    int honbaPerPlayer = 100 * honba;

    Map<Long, Integer> result = new HashMap<>();
    for (Long id : playerIds) {
      result.put(id, 0);
    }

    if (selfDraw) {
      int winnerGets = 0;

      if (winnerIsDealer) {
        int eachPays = roundUp100(basicPoints * 2) + honbaPerPlayer;
        for (Long id : playerIds) {
          if (!id.equals(winnerId)) {
            result.put(id, -eachPays);
            winnerGets += eachPays;
          }
        }
      } else {
        int dealerPays = roundUp100(basicPoints * 2) + honbaPerPlayer;
        int nonDealerPays = roundUp100(basicPoints) + honbaPerPlayer;

        for (Long id : playerIds) {
          if (id.equals(winnerId)) continue;
          if (id.equals(dealerId)) {
            result.put(id, -dealerPays);
            winnerGets += dealerPays;
          } else {
            result.put(id, -nonDealerPays);
            winnerGets += nonDealerPays;
          }
        }
      }
      result.put(winnerId, winnerGets + kyoutaku);
    } else {
      // Ron: honba bonus = 300 × honba (all from the discarder)
      int total =
          (winnerIsDealer ? roundUp100(basicPoints * 6) : roundUp100(basicPoints * 4))
              + 300 * honba;
      result.put(winnerId, total + kyoutaku);
      result.put(dealInPlayerId, -total);
    }

    return result;
  }
}
