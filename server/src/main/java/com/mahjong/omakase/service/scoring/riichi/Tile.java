package com.mahjong.omakase.service.scoring.riichi;

/** One tile. Suits are m, p, s and z; honors are 1-7 = 东 南 西 北 中 发 白. */
public record Tile(char suit, int rank) implements Comparable<Tile> {

  private static final String SUITS = "mpsz";

  public static Tile of(String text) {
    if (text.length() != 2
        || !Character.isDigit(text.charAt(0))
        || SUITS.indexOf(text.charAt(1)) < 0) {
      throw new IllegalArgumentException("Not a tile: " + text);
    }
    Tile tile = new Tile(text.charAt(1), text.charAt(0) - '0');
    if (tile.rank < 1 || tile.rank > (tile.isHonor() ? 7 : 9)) {
      throw new IllegalArgumentException("Not a tile: " + text);
    }
    return tile;
  }

  public boolean isHonor() {
    return suit == 'z';
  }

  public boolean isNumber() {
    return suit != 'z';
  }

  public boolean isTerminal() {
    return isNumber() && (rank == 1 || rank == 9);
  }

  public boolean isTerminalOrHonor() {
    return isTerminal() || isHonor();
  }

  public boolean isWind() {
    return isHonor() && rank <= 4;
  }

  public boolean isDragon() {
    return isHonor() && rank >= 5;
  }

  public boolean isGreen() {
    return (suit == 's' && (rank == 2 || rank == 3 || rank == 4 || rank == 6 || rank == 8))
        || (isHonor() && rank == 6);
  }

  @Override
  public int compareTo(Tile other) {
    if (suit != other.suit) return SUITS.indexOf(suit) - SUITS.indexOf(other.suit);
    return rank - other.rank;
  }

  @Override
  public String toString() {
    return rank + String.valueOf(suit);
  }
}
