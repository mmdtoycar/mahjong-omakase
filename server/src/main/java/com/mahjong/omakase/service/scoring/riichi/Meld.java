package com.mahjong.omakase.service.scoring.riichi;

import java.util.List;

/** A group of a hand: a sequence, a triplet, a kan, or the pair. */
public record Meld(Kind kind, List<Tile> tiles, boolean open, boolean completedByWin) {

  public enum Kind {
    SHUNZI,
    KEZI,
    GANGZI,
    DUIZI
  }

  public Meld(Kind kind, List<Tile> tiles, boolean open) {
    this(kind, tiles, open, false);
  }

  public Tile first() {
    return tiles.get(0);
  }

  public Meld completed() {
    return new Meld(kind, tiles, open, true);
  }

  public boolean isTriplet() {
    return kind == Kind.KEZI || kind == Kind.GANGZI;
  }
}
