package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.GameSessionPlayer;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.RoundScore;
import com.mahjong.omakase.service.GameStateDeriver.State;
import com.mahjong.omakase.service.handler.RiichiModeHandler;
import com.mahjong.omakase.service.scoring.RiichiScoreTable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Re-scores Riichi wins recorded against a stale table, by finding the state that explains them.
 */
@Component
public class RoundRecomputer {

  public record Change(
      long sessionId,
      int roundNumber,
      String label,
      Map<String, Integer> before,
      Map<String, Integer> after,
      String reason) {}

  public record Unresolved(long sessionId, int roundNumber, String label, String reason) {}

  public record Result(List<Change> changed, List<Unresolved> unresolved) {}

  /** Fixes the given Riichi sessions in place. */
  public Result recompute(List<GameSession> sessions) {
    List<Change> changed = new ArrayList<>();
    List<Unresolved> unresolved = new ArrayList<>();
    for (GameSession session : sessions) {
      if (session.getGameMode() != GameMode.RIICHI) continue;
      recompute(session, changed, unresolved);
    }
    return new Result(changed, unresolved);
  }

  private void recompute(GameSession session, List<Change> changed, List<Unresolved> unresolved) {
    int players = session.getPlayers().size();
    if (players != 3 && players != 4) return;

    List<State> states = GameStateDeriver.deriveAll(session);
    List<Round> rounds =
        session.getRounds().stream()
            .sorted(Comparator.comparingInt(Round::getRoundNumber))
            .toList();
    List<Long> playerIds =
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(gsp -> gsp.getPlayer().getId())
            .toList();
    Map<Long, String> names = new HashMap<>();
    for (GameSessionPlayer gsp : session.getPlayers()) {
      if (gsp.getPlayer() != null)
        names.put(gsp.getPlayer().getId(), gsp.getPlayer().getUserName());
    }

    for (int i = 0; i < rounds.size(); i++) {
      Round round = rounds.get(i);
      if (round.getWinnerId() == null) continue;
      String label = states.get(i).displayName();
      Map<Long, Integer> recorded = new HashMap<>();
      for (RoundScore rs : round.getScores()) {
        if (rs.getPlayer() != null) recorded.put(rs.getPlayer().getId(), rs.getScore());
      }
      if (!recorded.keySet().containsAll(playerIds)) continue;

      Outcome outcome = analyse(round, recorded, states, i, playerIds);
      if (outcome.fixed() == null) {
        if (outcome.problem() != null) {
          unresolved.add(
              new Unresolved(session.getId(), round.getRoundNumber(), label, outcome.problem()));
        }
        continue;
      }
      for (RoundScore rs : round.getScores()) {
        if (rs.getPlayer() != null) rs.setScore(outcome.fixed().get(rs.getPlayer().getId()));
      }
      changed.add(
          new Change(
              session.getId(),
              round.getRoundNumber(),
              label,
              byName(recorded, playerIds, names),
              byName(outcome.fixed(), playerIds, names),
              outcome.reason()));
    }
  }

  private static Map<String, Integer> byName(
      Map<Long, Integer> scores, List<Long> playerIds, Map<Long, String> names) {
    Map<String, Integer> out = new LinkedHashMap<>();
    for (Long id : playerIds) out.put(names.get(id), scores.get(id));
    return out;
  }

  private record Outcome(Map<Long, Integer> fixed, String reason, String problem) {}

  /** One state the page may have been showing, and the hand value it implies. */
  private record Guess(int stateIndex, boolean dealerWon, int honba, int kyoutaku, int total) {}

  private Outcome analyse(
      Round round, Map<Long, Integer> recorded, List<State> states, int index, List<Long> ids) {
    long winner = round.getWinnerId();
    Long dealIn = round.getDealInPlayerId();
    boolean selfDraw = dealIn == null;
    int n = ids.size();
    List<Long> riichi = parseIds(round.getRiichiPlayerIds());
    Set<Long> riichiSet = new HashSet<>(riichi);

    int paid = 0; // what the table paid the winner for the hand, honba included
    if (selfDraw) {
      for (long p : ids) {
        if (p != winner) paid += -recorded.get(p) - (riichiSet.contains(p) ? 1000 : 0);
      }
    } else {
      if (!recorded.containsKey(dealIn) || dealIn == winner) return new Outcome(null, null, null);
      paid = -recorded.get(dealIn) - (riichiSet.contains(dealIn) ? 1000 : 0);
    }

    Guess truth = null;
    List<Guess> stale = new ArrayList<>();
    for (int j = 0; j <= index; j++) {
      State s = states.get(j);
      int perHonba = selfDraw ? 100 * (n - 1) : 300;
      int total = paid - perHonba * s.honba();
      boolean dealerWon = s.dealerPlayerId() == winner;
      if (total <= 0 || total % 100 != 0) continue;
      if (RiichiScoreTable.basicsFor(total, dealerWon, selfDraw, n, null).isEmpty()) continue;
      Map<Long, Integer> again =
          scored(total, ids, winner, dealIn, s.dealerPlayerId(), s.honba(), s.kyoutaku(), riichi);
      if (!again.equals(recorded)) continue;
      Guess g = new Guess(j, dealerWon, s.honba(), s.kyoutaku(), total);
      if (j == index) truth = g;
      else stale.add(g);
    }
    if (truth != null) return new Outcome(null, null, null);
    if (stale.isEmpty()) {
      return new Outcome(null, null, "分数不能用这一场里任何一个状态解释, 需要人工核对");
    }

    State now = states.get(index);
    boolean dealerWonNow = now.dealerPlayerId() == winner;
    Integer han = round.getFanCount();

    Set<Integer> totals = new HashSet<>();
    Guess chosen = null;
    for (Guess g : stale) {
      Set<Integer> next = new HashSet<>();
      if (g.dealerWon() == dealerWonNow) {
        next.add(g.total());
      } else {
        for (int basic : RiichiScoreTable.basicsFor(g.total(), g.dealerWon(), selfDraw, n, han)) {
          next.add(RiichiScoreTable.total(basic, dealerWonNow, selfDraw, n));
        }
      }
      if (chosen == null) chosen = g;
      totals.addAll(next);
    }
    if (totals.size() != 1) {
      return new Outcome(null, null, "有多个状态都能解释这一局, 无法确定是哪一个");
    }
    int fixedTotal = totals.iterator().next();
    Map<Long, Integer> fixed =
        scored(
            fixedTotal,
            ids,
            winner,
            dealIn,
            now.dealerPlayerId(),
            now.honba(),
            now.kyoutaku(),
            riichi);
    State was = states.get(chosen.stateIndex());
    String reason =
        "录入时页面停在 "
            + was.displayName()
            + " (本场 "
            + was.honba()
            + "), 实际应为 "
            + now.displayName()
            + " (本场 "
            + now.honba()
            + ", 供托 "
            + now.kyoutaku()
            + ")";
    return new Outcome(fixed, reason, null);
  }

  private static Map<Long, Integer> scored(
      int total,
      List<Long> ids,
      long winner,
      Long dealIn,
      long dealer,
      int honba,
      int kyoutaku,
      List<Long> riichi) {
    Map<Long, Integer> scores =
        RiichiModeHandler.calculateDirectScore(total, ids, winner, dealIn, dealer, honba, kyoutaku);
    RiichiModeHandler.settleRiichiSticks(riichi, ids, winner, scores);
    return scores;
  }

  private static List<Long> parseIds(String raw) {
    if (raw == null) return List.of();
    return Arrays.stream(raw.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .map(Long::valueOf)
        .toList();
  }
}
