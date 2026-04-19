package com.mahjong.omakase.service.handler;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import java.util.List;
import java.util.Map;

public interface GameModeHandler {

  GameMode getGameMode();

  /**
   * Validate the request and return computed scores for all players in the round. The handler is
   * responsible for checking roundType and dispatching to win or drawn-game logic as appropriate.
   * Handlers that don't support a particular roundType should throw UnsupportedOperationException.
   */
  Map<Long, Integer> calculateRoundScores(AddRoundRequest request, List<Long> sessionPlayerIds);
}
