package com.mahjong.omakase.service.handler;

import com.mahjong.omakase.dto.AddRoundRequest;
import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.service.scoring.RiichiScoreCalculator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    if (request.getFan() == null || request.getFu() == null) {
      throw new IllegalArgumentException("Fan and Fu are required for Riichi mode");
    }
    if (request.getFan() < 1) {
      throw new IllegalArgumentException("Fan must be at least 1");
    }
    if (request.getFu() < 20) {
      throw new IllegalArgumentException("Fu must be at least 20");
    }
    if (request.getDealerId() == null) {
      throw new IllegalArgumentException("Dealer (親) is required for Riichi mode");
    }
    if (!sessionPlayerIds.contains(request.getDealerId())) {
      throw new IllegalArgumentException("Dealer is not in this session");
    }

    Map<String, Object> params = new HashMap<>();
    params.put("fan", request.getFan());
    params.put("fu", request.getFu());
    params.put("dealerId", request.getDealerId());
    params.put("honba", request.getHonba() != null ? request.getHonba() : 0);
    params.put("kyoutaku", request.getKyoutaku() != null ? request.getKyoutaku() : 0);

    Map<Long, Integer> scores =
        calculator.calculate(
            sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);

    applyRiichiSticks(request, sessionPlayerIds, scores);

    List<Long> riichiIds = request.getRiichiPlayerIds();
    if (riichiIds != null && !riichiIds.isEmpty()) {
      int riichiPool = new HashSet<>(riichiIds).size() * 1000;
      scores.merge(request.getWinnerId(), riichiPool, Integer::sum);
    }

    return scores;
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
      int totalPool = (sessionPlayerIds.size() - 1) * 1000;
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
    applyRiichiSticks(request, sessionPlayerIds, scores);
    return scores;
  }

  private void applyRiichiSticks(
      AddRoundRequest request, List<Long> sessionPlayerIds, Map<Long, Integer> scores) {
    List<Long> riichiIds = request.getRiichiPlayerIds();
    if (riichiIds != null) {
      Set<Long> uniqueRiichiIds = new HashSet<>(riichiIds);
      for (Long id : uniqueRiichiIds) {
        if (id == null || !sessionPlayerIds.contains(id)) {
          throw new IllegalArgumentException("Riichi player " + id + " is not in this session");
        }
        scores.merge(id, -1000, Integer::sum);
      }
    }
  }
}
