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

    boolean isChombo = isChomboDueToFlowerTiles(request);
    if (!isChombo) {
      if (request.getScore() == null) {
        throw new IllegalArgumentException("Score is required");
      }
      if (request.getScore() < 8) {
        throw new IllegalArgumentException("Score must be at least 8 for Guobiao mode");
      }
    }

    if (isChombo) {
      // Chombo penalty: offender pays 15 points to each other player
      Map<Long, Integer> chomboScores = new HashMap<>();
      for (Long id : sessionPlayerIds) {
        if (id.equals(request.getWinnerId())) {
          chomboScores.put(id, -(sessionPlayerIds.size() - 1) * 15);
        } else {
          chomboScores.put(id, 15);
        }
      }
      return chomboScores;
    }

    Map<String, Object> params = new HashMap<>();
    params.put("score", request.getScore());

    return calculator.calculate(
        sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);
  }

  private boolean isChomboDueToFlowerTiles(AddRoundRequest request) {
    if (Boolean.TRUE.equals(request.getChombo())) {
      return true;
    }
    if (request.getScore() == null) {
      return false;
    }
    if (request.getFanDetails() == null || request.getFanDetails().isEmpty()) {
      return false;
    }
    int totalScore = request.getScore();
    int flowerScore = parseFlowerScore(request.getFanDetails());
    int scoreWithoutFlowers = totalScore - flowerScore;
    return scoreWithoutFlowers < 8 && flowerScore > 0;
  }

  private int parseFlowerScore(String fanDetails) {
    if (fanDetails == null || fanDetails.isEmpty()) {
      return 0;
    }
    int flowerScore = 0;
    String[] parts = fanDetails.split(",");
    for (String part : parts) {
      part = part.trim();
      if (part.startsWith("花牌(")) {
        int openParen = part.indexOf('(');
        int closeParen = part.indexOf(')');
        if (openParen != -1 && closeParen != -1 && closeParen > openParen + 1) {
          String content = part.substring(openParen + 1, closeParen);
          // Format: "花牌(N)" when count == 1, or "花牌(NxC)" when count > 1.
          // N is the already-summed total score; C is the count and is informational only.
          String totalPart = content.contains("x") ? content.split("x")[0] : content;
          try {
            flowerScore += Integer.parseInt(totalPart.trim());
          } catch (NumberFormatException e) {
            // ignore
          }
        }
      }
    }
    return flowerScore;
  }
}
