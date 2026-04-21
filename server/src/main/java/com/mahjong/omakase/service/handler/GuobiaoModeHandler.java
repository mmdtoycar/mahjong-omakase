package com.mahjong.omakase.service.handler;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.GuobiaoScoreCalculator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class GuobiaoModeHandler implements GameModeHandler {

  private final GuobiaoScoreCalculator calculator;

  public GuobiaoModeHandler(GuobiaoScoreCalculator calculator) {
    this.calculator = calculator;
  }

  @Override
  public GameMode getGameMode() {
    return GameMode.GUOBIAO;
  }

  @Override
  public Map<Long, Integer> calculateRoundScores(
      AddRoundRequest request, List<Long> sessionPlayerIds) {
    if (request.isDrawnGame()) {
      throw new UnsupportedOperationException("Drawn game is not supported for 国标麻将");
    }

    if (request.getScore() == null) {
      throw new IllegalArgumentException("Score is required");
    }
    if (request.getScore() < 8) {
      throw new IllegalArgumentException("Score must be at least 8 for Guobiao mode");
    }

    Map<String, Object> params = new HashMap<>();
    params.put("score", request.getScore());

    return calculator.calculate(
        sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);
  }
}
