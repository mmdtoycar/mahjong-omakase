package com.mahjong.omakase.service.scoring.riichi;

import java.util.List;

/** One way to read a hand: four groups and a pair, seven pairs, or thirteen orphans. */
public record Combination(List<Meld> melds, boolean chiitoitsu, boolean kokushi) {

  public Combination(List<Meld> melds) {
    this(melds, false, false);
  }

  public Meld pair() {
    return melds.stream().filter(m -> m.kind() == Meld.Kind.DUIZI).findFirst().orElseThrow();
  }

  public List<Meld> groups() {
    return melds.stream().filter(m -> m.kind() != Meld.Kind.DUIZI).toList();
  }
}
