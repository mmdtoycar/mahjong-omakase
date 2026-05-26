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
    if (request.getDealerId() == null) {
      throw new IllegalArgumentException("Dealer (親) is required for Riichi mode");
    }
    if (!sessionPlayerIds.contains(request.getDealerId())) {
      throw new IllegalArgumentException("Dealer is not in this session");
    }

    Map<Long, Integer> scores;

    if (request.getScore() != null) {
      scores =
          calculateDirectScore(
              request.getScore(),
              sessionPlayerIds,
              request.getWinnerId(),
              request.getDealInPlayerId(),
              request.getDealerId(),
              request.getHonba() != null ? request.getHonba() : 0,
              request.getKyoutaku() != null ? request.getKyoutaku() : 0);
    } else {
      if (request.getFan() == null || request.getFu() == null) {
        throw new IllegalArgumentException("Fan/Fu or Score is required for Riichi mode");
      }
      if (request.getFan() < 1) {
        throw new IllegalArgumentException("Fan must be at least 1");
      }
      if (request.getFu() < 20) {
        throw new IllegalArgumentException("Fu must be at least 20");
      }

      Map<String, Object> params = new HashMap<>();
      params.put("fan", request.getFan());
      params.put("fu", request.getFu());
      params.put("dealerId", request.getDealerId());
      params.put("honba", request.getHonba() != null ? request.getHonba() : 0);
      params.put("kyoutaku", request.getKyoutaku() != null ? request.getKyoutaku() : 0);

      scores =
          calculator.calculate(
              sessionPlayerIds, request.getWinnerId(), request.getDealInPlayerId(), params);
    }

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

  private Map<Long, Integer> calculateDirectScore(
      int score,
      List<Long> playerIds,
      Long winnerId,
      Long dealInPlayerId,
      Long dealerId,
      int honba,
      int kyoutaku) {
    boolean selfDraw = dealInPlayerId == null;

    Map<Long, Integer> result = new HashMap<>();
    for (Long id : playerIds) {
      result.put(id, 0);
    }

    if (selfDraw) {
      int winnerGets = 0;
      int numOthers = playerIds.size() - 1;
      int honbaPerPlayer = 100 * honba;
      boolean winnerIsDealer = dealerId != null && dealerId.equals(winnerId);

      if (winnerIsDealer) {
        int base = (int) Math.round((double) score / numOthers / 100.0) * 100;
        int remainder = score - base * numOthers;
        int remainderSticks = remainder / 100;

        int idx = 0;
        for (Long id : playerIds) {
          if (!id.equals(winnerId)) {
            int extra = 0;
            if (remainderSticks > 0) {
              extra = 100;
              remainderSticks--;
            } else if (remainderSticks < 0) {
              extra = -100;
              remainderSticks++;
            }
            int pays = base + extra + honbaPerPlayer;
            result.put(id, -pays);
            winnerGets += pays;
            idx++;
          }
        }
      } else {
        int totalShares = numOthers + 1; // dealer pays 2 shares, each other non-dealer pays 1 share
        int baseShare = (int) Math.round((double) score / totalShares / 100.0) * 100;
        int dealerBase = baseShare * 2;
        int nonDealerBase = baseShare;

        int remainder = score - (dealerBase + nonDealerBase * (numOthers - 1));
        int remainderSticks = remainder / 100;

        Map<Long, Integer> playerShares = new HashMap<>();
        for (Long id : playerIds) {
          if (id.equals(winnerId)) continue;
          if (id.equals(dealerId)) {
            playerShares.put(id, dealerBase);
          } else {
            playerShares.put(id, nonDealerBase);
          }
        }

        if (remainderSticks != 0 && dealerId != null && playerShares.containsKey(dealerId)) {
          int extra = 0;
          if (remainderSticks > 0) {
            extra = Math.min(remainderSticks, 2) * 100;
            remainderSticks -= extra / 100;
          } else {
            extra = Math.max(remainderSticks, -2) * 100;
            remainderSticks -= extra / 100;
          }
          playerShares.put(dealerId, playerShares.get(dealerId) + extra);
        }

        int idx = 0;
        for (Long id : playerIds) {
          if (id.equals(winnerId) || id.equals(dealerId)) continue;
          int extra = 0;
          if (remainderSticks > 0) {
            extra = 100;
            remainderSticks--;
          } else if (remainderSticks < 0) {
            extra = -100;
            remainderSticks++;
          }
          playerShares.put(id, playerShares.get(id) + extra);
          idx++;
        }

        for (Map.Entry<Long, Integer> entry : playerShares.entrySet()) {
          int pays = entry.getValue() + honbaPerPlayer;
          result.put(entry.getKey(), -pays);
          winnerGets += pays;
        }
      }
      result.put(winnerId, winnerGets + kyoutaku);
    } else {
      int total = score + 300 * honba;
      result.put(winnerId, total + kyoutaku);
      result.put(dealInPlayerId, -total);
    }

    return result;
  }
}
