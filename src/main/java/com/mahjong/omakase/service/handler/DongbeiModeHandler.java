package com.mahjong.omakase.service.handler;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.DongbeiScoreCalculator;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DongbeiModeHandler implements GameModeHandler {

  private final DongbeiScoreCalculator calculator;

  public DongbeiModeHandler(DongbeiScoreCalculator calculator) {
    this.calculator = calculator;
  }

  @Override
  public GameMode getGameMode() {
    return GameMode.DONGBEI;
  }

  @Override
  public Map<Long, Integer> calculateRoundScores(
      AddRoundRequest request, List<Long> sessionPlayerIds) {
    if (request.isDrawnGame()) {
      throw new UnsupportedOperationException("Drawn game is not supported for 东北麻将");
    }

    if (request.getHan() == null) {
      throw new IllegalArgumentException("Fan (番) is required for Dongbei mode");
    }
    if (request.getDealerId() == null) {
      throw new IllegalArgumentException("Dealer (庄家) is required for Dongbei mode");
    }
    if (!sessionPlayerIds.contains(request.getDealerId())) {
      throw new IllegalArgumentException("Dealer is not in this session");
    }

    Map<String, Object> params = new HashMap<>();
    params.put("fan", request.getHan());
    params.put("dealerId", request.getDealerId());
    params.put(
        "bimenPlayerIds",
        request.getBimenPlayerIds() != null
            ? request.getBimenPlayerIds()
            : Collections.emptyList());

    return calculator.calculate(
        sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);
  }
}
