package com.mahjong.omakase.service.scoring.riichi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import org.junit.jupiter.api.Test;

class HandParserTest {

  @Test
  void readsAConcealedHandAndItsWinningTile() {
    HandParser.Hand hand = HandParser.parse("4m5m7m7m7m6p7p8p9p9p2s3s4s^6m");

    assertThat(hand.concealed()).hasSize(13);
    assertThat(hand.melds()).isEmpty();
    assertThat(hand.winTile()).isEqualTo(Tile.of("6m"));
  }

  @Test
  void readsCalledGroupsAndPutsASequenceInOrder() {
    HandParser.Hand hand = HandParser.parse("6s6s6s9s9s9s1z^1z[4s2s3s][5z5z5z](1m1m1m1m)");

    assertThat(hand.melds()).hasSize(3);
    Meld chi = hand.melds().get(0);
    assertThat(chi.kind()).isEqualTo(Kind.SHUNZI);
    assertThat(chi.open()).isTrue();
    assertThat(chi.tiles()).containsExactly(Tile.of("2s"), Tile.of("3s"), Tile.of("4s"));
    assertThat(hand.melds().get(1).kind()).isEqualTo(Kind.KEZI);
    assertThat(hand.melds().get(2).kind()).isEqualTo(Kind.GANGZI);
    assertThat(hand.melds().get(2).open()).isFalse();
  }

  @Test
  void refusesWhatIsNotAHand() {
    assertThatThrownBy(() -> HandParser.parse("4m5m6m"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> HandParser.parse("4m5m^"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> HandParser.parse("4x^5m"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> HandParser.parse("4m^8z"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> HandParser.parse("4m^5m[1m2m]"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
