package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.Round;
import com.mahjong.omakase.model.RoundScore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Dealer, wind, 本场 and 供托, replayed from the rounds so far. */
public final class GameStateDeriver {

  private static final String[] WIND_NAMES = {"东", "南", "西", "北"};

  private GameStateDeriver() {}

  /** prevalentWind is 1=东 .. 4=北; kyoutaku is the carried riichi sticks, in points. */
  public record State(
      int dealerSeat,
      long dealerPlayerId,
      int prevalentWind,
      int handNumber,
      int honba,
      int kyoutaku,
      String displayName,
      int playerCount) {}

  /** Tenpai and riichi are null when unrecorded. */
  public record RoundFacts(
      Long winnerId, List<Long> tenpai, List<Long> riichi, Map<Long, Integer> scores) {}

  public record Seat(long playerId, Integer seat) {}

  /** The state before each round, then after the last. */
  public static List<State> deriveAll(GameSession session) {
    List<Seat> seats =
        session.getPlayers().stream()
            .filter(gsp -> gsp.getPlayer() != null)
            .map(gsp -> new Seat(gsp.getPlayer().getId(), gsp.getSeat()))
            .toList();
    List<Round> ordered =
        session.getRounds().stream()
            .sorted(Comparator.comparingInt(Round::getRoundNumber))
            .toList();
    List<RoundFacts> rounds = new ArrayList<>();
    for (Round r : ordered) {
      Map<Long, Integer> scores = new HashMap<>();
      for (RoundScore rs : r.getScores()) {
        if (rs.getPlayer() != null) scores.put(rs.getPlayer().getId(), rs.getScore());
      }
      rounds.add(
          new RoundFacts(
              r.getWinnerId(),
              r.getTenpaiPlayerIds() == null ? null : parseIds(r.getTenpaiPlayerIds()),
              r.getRiichiPlayerIds() == null ? null : parseIds(r.getRiichiPlayerIds()),
              scores));
    }
    return deriveAll(session.getGameMode(), seats, rounds);
  }

  public static State derive(GameSession session) {
    List<State> all = deriveAll(session);
    return all.get(all.size() - 1);
  }

  public static List<State> deriveAll(GameMode mode, List<Seat> players, List<RoundFacts> rounds) {
    List<Seat> bySeat =
        players.stream()
            .sorted(Comparator.comparingInt(s -> s.seat() == null ? 0 : s.seat()))
            .toList();
    int n = bySeat.size();
    List<State> states = new ArrayList<>();

    if (mode == GameMode.GUOBIAO) {
      for (int i = 0; i <= rounds.size(); i++) {
        int index = i % n;
        Seat dealer = bySeat.get(index);
        states.add(
            new State(
                dealer.seat() != null ? dealer.seat() : index + 1,
                dealer.playerId(),
                1,
                i + 1,
                0,
                0,
                "第" + (i + 1) + "/" + n + "局",
                n));
      }
      return states;
    }

    int seatIndex = 0;
    int wind = 1;
    int hand = 1;
    int honba = 0;
    int kyoutaku = 0;
    for (int i = 0; i <= rounds.size(); i++) {
      Seat dealer = bySeat.get(seatIndex);
      String windHand = WIND_NAMES[(wind - 1) % 4] + hand;
      states.add(
          new State(
              dealer.seat() != null ? dealer.seat() : seatIndex + 1,
              dealer.playerId(),
              wind,
              hand,
              honba,
              kyoutaku,
              honba > 0 ? windHand + "(" + honba + ")" : windHand,
              n));
      if (i == rounds.size()) break;

      RoundFacts round = rounds.get(i);
      if (round.riichi() != null) kyoutaku += round.riichi().size() * 1000;
      if (round.winnerId() != null) kyoutaku = 0;

      boolean stays = dealerStays(mode, round, dealer.playerId());
      if (!stays) {
        seatIndex = (seatIndex + 1) % n;
        hand++;
        if (hand > n) {
          hand = 1;
          wind++;
        }
      }
      // A draw adds a 本场 even when the dealer is passed.
      honba = stays || round.winnerId() == null ? honba + 1 : 0;
    }
    return states;
  }

  private static boolean dealerStays(GameMode mode, RoundFacts round, long dealerId) {
    if (round.winnerId() != null) return round.winnerId() == dealerId;
    return switch (mode) {
      case DONGBEI -> true;
      case RIICHI -> dealerTenpai(round, dealerId);
      default -> false;
    };
  }

  private static boolean dealerTenpai(RoundFacts round, long dealerId) {
    if (round.tenpai() != null) return round.tenpai().contains(dealerId);
    // Older rounds have no tenpai list: read the dealer's points.
    return round.scores().getOrDefault(dealerId, 0) >= 0;
  }

  private static List<Long> parseIds(String raw) {
    return Arrays.stream(raw.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .map(Long::valueOf)
        .toList();
  }
}
