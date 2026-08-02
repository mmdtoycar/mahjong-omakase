package com.mahjong.omakase.service.scoring;

import java.util.*;
import java.util.stream.Collectors;

public final class RankCalculator {

  private RankCalculator() {}

  /**
   * Standard competition ranking: sort by score descending, tied scores share the same rank, and
   * the next distinct score skips (e.g. [100,50,30,30] → ranks [1,2,3,3]). Ties are broken by
   * playerId so the ordering is deterministic. Mirrors {@code rankByScore} in the frontend.
   */
  public static List<RankEntry> rankPlayers(Map<Long, Integer> scoresByPlayerId) {
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
      for (int k = i; k < j; k++) {
        Long pid = sortedIds.get(k);
        results.add(new RankEntry(pid, scoresByPlayerId.get(pid), rank));
      }
      i = j;
    }
    return results;
  }

  public record RankEntry(Long playerId, int score, int rank) {}
}
