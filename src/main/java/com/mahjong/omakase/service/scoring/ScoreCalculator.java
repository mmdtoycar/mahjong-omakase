package com.mahjong.omakase.service.scoring;

import java.util.List;
import java.util.Map;

/** Calculates score distribution for a round based on game-mode-specific rules. */
public interface ScoreCalculator {

  /**
   * @param playerIds all player IDs in the session
   * @param winnerId the winning player
   * @param dealInPlayerId the player who dealt in (null for self-draw / 自摸)
   * @param params mode-specific parameters (e.g. han, fu, isDealer for Riichi; score for others)
   * @return map of playerId → score change for this round
   */
  Map<Long, Integer> calculate(
      List<Long> playerIds, Long winnerId, Long dealInPlayerId, Map<String, Object> params);
}
