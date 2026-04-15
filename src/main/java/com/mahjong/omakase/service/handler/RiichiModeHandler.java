package com.mahjong.omakase.service.handler;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.RiichiScoreCalculator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class RiichiModeHandler implements GameModeHandler {

  private final RiichiScoreCalculator calculator;

  public RiichiModeHandler(RiichiScoreCalculator calculator) {
    this.calculator = calculator;
  }

  @Override
  public GameMode getGameMode() {
    return GameMode.RIICHI;
  }

  @Override
  public Map<Long, Integer> calculateRoundScores(
      AddRoundRequest request, List<Long> sessionPlayerIds) {
    if (request.isDrawnGame()) {
      return calculateDrawnGame(request, sessionPlayerIds);
    }
    return calculateWin(request, sessionPlayerIds);
  }

  private Map<Long, Integer> calculateWin(AddRoundRequest request, List<Long> sessionPlayerIds) {
    if (request.getHan() == null || request.getFu() == null) {
      throw new IllegalArgumentException("Han and Fu are required for Riichi mode");
    }
    if (request.getDealerId() == null) {
      throw new IllegalArgumentException("Dealer (親) is required for Riichi mode");
    }
    if (!sessionPlayerIds.contains(request.getDealerId())) {
      throw new IllegalArgumentException("Dealer is not in this session");
    }

    Map<String, Object> params = new HashMap<>();
    params.put("han", request.getHan());
    params.put("fu", request.getFu());
    params.put("dealerId", request.getDealerId());
    params.put("honba", request.getHonba() != null ? request.getHonba() : 0);
    params.put("kyoutaku", request.getKyoutaku() != null ? request.getKyoutaku() : 0);

    return calculator.calculate(
        sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);
  }

  private Map<Long, Integer> calculateDrawnGame(
      AddRoundRequest request, List<Long> sessionPlayerIds) {
    List<Long> tenpaiIds = request.getTenpaiPlayerIds();
    if (tenpaiIds == null) {
      throw new IllegalArgumentException("Tenpai player list is required for drawn game");
    }
    for (Long id : tenpaiIds) {
      if (!sessionPlayerIds.contains(id)) {
        throw new IllegalArgumentException("Player " + id + " is not in this session");
      }
    }

    int tenpaiCount = tenpaiIds.size();
    int notenCount = sessionPlayerIds.size() - tenpaiCount;

    Map<Long, Integer> scores = new HashMap<>();
    if (tenpaiCount == 0 || tenpaiCount == sessionPlayerIds.size()) {
      for (Long id : sessionPlayerIds) {
        scores.put(id, 0);
      }
    } else {
      int totalPool = 3000;
      int eachNotenPays = totalPool / notenCount;
      int eachTenpaiGets = totalPool / tenpaiCount;
      for (Long id : sessionPlayerIds) {
        if (tenpaiIds.contains(id)) {
          scores.put(id, eachTenpaiGets);
        } else {
          scores.put(id, -eachNotenPays);
        }
      }
    }
    return scores;
  }
}
