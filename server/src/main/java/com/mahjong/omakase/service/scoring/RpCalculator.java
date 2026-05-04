package com.mahjong.omakase.service.scoring;

import java.util.*;
import java.util.stream.Collectors;

public final class RpCalculator {

  private RpCalculator() {}

  public static double calculateRp(int score, double factor, double avgUma) {
    return (score / factor) + avgUma;
  }

  public static double calculateAvgUma(int startPos, int endPos, double[] umaDist) {
    double totalUma = 0;
    int groupSize = endPos - startPos;
    for (int k = startPos; k < endPos; k++) {
      totalUma += (k < umaDist.length) ? umaDist[k] : 0;
    }
    return totalUma / groupSize;
  }

  public static List<RankEntry> rankPlayers(
      Map<Long, Integer> scoresByPlayerId, double rpFactor, double[] umaDist) {
    List<Long> sortedIds =
        scoresByPlayerId.keySet().stream()
            .sorted(
                Comparator.<Long, Integer>comparing(
                        scoresByPlayerId::get, Comparator.reverseOrder())
                    .thenComparingLong(Long::longValue))
            .collect(Collectors.toList());

    List<RankEntry> results = new ArrayList<>();
    int i = 0;
    while (i < sortedIds.size()) {
      int j = i;
      while (j < sortedIds.size()
          && scoresByPlayerId
              .get(sortedIds.get(j))
              .equals(scoresByPlayerId.get(sortedIds.get(i)))) {
        j++;
      }

      int rank = i + 1;
      double avgUma = calculateAvgUma(i, j, umaDist);

      for (int k = i; k < j; k++) {
        Long pid = sortedIds.get(k);
        int score = scoresByPlayerId.get(pid);
        double rp = calculateRp(score, rpFactor, avgUma);
        results.add(new RankEntry(pid, score, rank, rp));
      }
      i = j;
    }
    return results;
  }

  public record RankEntry(Long playerId, int score, int rank, double rp) {}
}
