package com.mahjong.omakase.service.scoring.riichi;

import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a hand as the scoring page writes it down: the concealed tiles, {@code ^} and the winning
 * tile, then the called groups, open ones in {@code [ ]} and closed kans in {@code ( )}, e.g.
 * {@code 4m5m7m7m7m6p7p8p9p9p2s3s4s^6m} or {@code 6s6s6s9s9s9s1z^1z[4s2s3s][5z5z5z]}.
 */
public final class HandParser {

  public record Hand(List<Tile> concealed, List<Meld> melds, Tile winTile) {}

  private static final Pattern GROUP = Pattern.compile("\\[([^\\]]*)]|\\(([^)]*)\\)");

  private HandParser() {}

  public static Hand parse(String text) {
    int caret = text.indexOf('^');
    if (caret < 0) throw new IllegalArgumentException("Hand has no winning tile: " + text);

    List<Tile> concealed = tiles(text.substring(0, caret));
    String rest = text.substring(caret + 1);
    if (rest.length() < 2) throw new IllegalArgumentException("Hand has no winning tile: " + text);
    Tile winTile = Tile.of(rest.substring(0, 2));

    List<Meld> melds = new ArrayList<>();
    Matcher m = GROUP.matcher(rest.substring(2));
    while (m.find()) {
      boolean open = m.group(1) != null;
      melds.add(meld(tiles(open ? m.group(1) : m.group(2)), open));
    }
    return new Hand(concealed, melds, winTile);
  }

  private static Meld meld(List<Tile> tiles, boolean open) {
    if (tiles.size() == 4) return new Meld(Kind.GANGZI, tiles, open);
    if (tiles.size() == 3 && tiles.stream().allMatch(t -> t.equals(tiles.get(0)))) {
      return new Meld(Kind.KEZI, tiles, open);
    }
    if (tiles.size() != 3) throw new IllegalArgumentException("Not a group: " + tiles);
    // A called sequence may be written with the called tile first; the lowest tile decides its
    // wait.
    List<Tile> sorted = new ArrayList<>(tiles);
    Collections.sort(sorted);
    return new Meld(Kind.SHUNZI, sorted, open);
  }

  private static List<Tile> tiles(String text) {
    if (text.length() % 2 != 0) throw new IllegalArgumentException("Not tiles: " + text);
    List<Tile> out = new ArrayList<>();
    for (int i = 0; i < text.length(); i += 2) out.add(Tile.of(text.substring(i, i + 2)));
    return out;
  }
}
