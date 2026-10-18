package com.mahjong.omakase.service.scoring.riichi;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * The server scores a hand like the scoring page; generated and real Tenhou hands hold the two
 * together.
 */
class RiichiHandCalculatorTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  private static JsonNode fixture(String name) throws IOException {
    try (InputStream in = RiichiHandCalculatorTest.class.getResourceAsStream("/riichi/" + name)) {
      return JSON.readTree(in);
    }
  }

  private static List<Tile> tiles(JsonNode array) {
    List<Tile> out = new ArrayList<>();
    for (JsonNode t : array) out.add(Tile.of(t.asText()));
    return out;
  }

  @Test
  void agreesWithThePageOnGeneratedHands() throws IOException {
    JsonNode cases = fixture("typescript_calculator_cases.json");
    assertThat(cases.size()).isGreaterThan(1000);

    for (int i = 0; i < cases.size(); i++) {
      JsonNode c = cases.get(i);
      List<Meld> melds = new ArrayList<>();
      for (JsonNode m : c.get("melds")) {
        Kind kind = Kind.valueOf(m.get("type").asText().toUpperCase());
        melds.add(new Meld(kind, tiles(m.get("tiles")), m.get("open").asBoolean()));
      }
      JsonNode o = c.get("options");
      GameOptions options =
          new GameOptions(
              o.get("isTsumo").asBoolean(),
              o.get("changfeng").asInt(),
              o.get("zifeng").asInt(),
              o.get("isRiichi").asBoolean(),
              o.get("isDoubleRiichi").asBoolean(),
              o.get("isYifa").asBoolean(),
              o.get("isQianggang").asBoolean(),
              o.get("isLingshang").asBoolean(),
              o.get("isHaidi").asBoolean(),
              o.get("isTianhu").asBoolean(),
              o.get("isDihu").asBoolean(),
              o.get("doraCount").asInt());

      Optional<HandResult> result =
          RiichiHandCalculator.calculate(
              tiles(c.get("concealed")), melds, Tile.of(c.get("win").asText()), options);

      String where = "case " + i + ": " + c;
      JsonNode expected = c.get("expected");
      if (expected.isNull()) {
        assertThat(result).as(where).isEmpty();
        continue;
      }
      assertThat(result).as(where).isPresent();
      HandResult r = result.get();
      assertThat(r.han()).as(where).isEqualTo(expected.get("han").asInt());
      assertThat(r.fu()).as(where).isEqualTo(expected.get("fu").asInt());
      assertThat(r.yakuman()).as(where).isEqualTo(expected.get("yakuman").asBoolean());
      assertThat(r.yakumanCount()).as(where).isEqualTo(expected.get("yakumanCount").asInt());
      assertThat(r.ron()).as(where).isEqualTo(expected.get("ron").asInt());
      assertThat(r.tsumoDealer()).as(where).isEqualTo(expected.get("tsumoDealer").asInt());
      assertThat(r.tsumoNonDealer()).as(where).isEqualTo(expected.get("tsumoNonDealer").asInt());
      List<String> yaku = new ArrayList<>();
      for (JsonNode y : expected.get("yaku"))
        yaku.add(y.get(0).asText() + "(" + y.get(1).asInt() + ")");
      assertThat(r.yaku().stream().map(y -> y.name() + "(" + y.han() + ")").toList())
          .as(where)
          .isEqualTo(yaku);
    }
  }

  private static List<Tile> tenhouTiles(String text) {
    List<Tile> out = new ArrayList<>();
    List<Integer> ranks = new ArrayList<>();
    for (char ch : text.toCharArray()) {
      if (Character.isDigit(ch)) {
        ranks.add(ch - '0');
      } else {
        char suit = ch == 'h' ? 'z' : ch;
        for (int n : ranks) out.add(new Tile(suit, n == 0 ? 5 : n));
        ranks.clear();
      }
    }
    return out;
  }

  private static Meld tenhouMeld(String text) {
    boolean closed = text.contains("f");
    List<Tile> tiles = tenhouTiles(text.replaceAll("[cf]", ""));
    if (tiles.size() == 4) return new Meld(Kind.GANGZI, tiles, !closed);
    if (tiles.stream().allMatch(t -> t.equals(tiles.get(0))))
      return new Meld(Kind.KEZI, tiles, !closed);
    List<Tile> sorted = new ArrayList<>(tiles);
    sorted.sort(null);
    return new Meld(Kind.SHUNZI, sorted, true);
  }

  @Test
  void matchesTenhouOnARealThousandHands() throws IOException {
    JsonNode hands = fixture("tenhou_hands.json");
    assertThat(hands.size()).isEqualTo(1000);

    for (int i = 0; i < hands.size(); i++) {
      JsonNode h = hands.get(i);
      List<Tile> concealed = tenhouTiles(h.get("hand").asText());
      List<Meld> melds = new ArrayList<>();
      for (JsonNode m : h.get("melds")) {
        Meld meld = tenhouMeld(m.asText());
        if (meld.tiles().size() >= 3) melds.add(meld);
      }
      Tile win = tenhouTiles(h.get("winningTile").asText()).get(0);
      concealed.remove(win);
      int roundWind =
          switch (h.get("roundWind").asText()) {
            case "SOUTH" -> 2;
            case "WEST" -> 3;
            case "NORTH" -> 4;
            default -> 1;
          };
      List<Tile> seat = tenhouTiles(h.get("seatWind").asText());
      int seatWind = !seat.isEmpty() && seat.get(0).isHonor() ? seat.get(0).rank() : 1;
      GameOptions options =
          new GameOptions(
              h.get("isTsumo").asBoolean(),
              roundWind,
              seatWind,
              h.get("isRiichi").asBoolean(),
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              0);

      String where = "hand " + i + ": " + h.get("hand").asText() + " win " + win;
      Optional<HandResult> result = RiichiHandCalculator.calculate(concealed, melds, win, options);
      assertThat(result).as(where).isPresent();
      assertThat(result.get().fu()).as(where).isEqualTo(h.get("fu").asInt());

      HandResult score =
          RiichiHandCalculator.score(
              h.get("han").asInt(),
              h.get("fu").asInt(),
              h.get("isDealer").asBoolean(),
              0,
              List.of());
      int expected = h.get("pointValue").asInt();
      assertThat(score.total(h.get("isDealer").asBoolean(), h.get("isTsumo").asBoolean(), 4))
          .as(where)
          .isEqualTo(expected);
    }
  }
}
