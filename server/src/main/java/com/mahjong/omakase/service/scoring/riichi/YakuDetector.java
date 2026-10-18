package com.mahjong.omakase.service.scoring.riichi;

import com.mahjong.omakase.service.scoring.riichi.FuCalculator.Wait;
import com.mahjong.omakase.service.scoring.riichi.Meld.Kind;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** The yaku of one reading of a hand. */
final class YakuDetector {

  private YakuDetector() {}

  static List<Yaku> detect(
      Combination combination, List<Tile> allTiles, Tile winTile, GameOptions options) {
    if (combination.kokushi()) {
      List<Yaku> yaku = new ArrayList<>(List.of(Yaku.yakuman("国士无双")));
      addSituationalYakuman(yaku, options);
      return yaku;
    }
    if (combination.chiitoitsu()) return chiitoitsu(allTiles, options);
    return standard(combination, allTiles, winTile, options);
  }

  private static List<Yaku> chiitoitsu(List<Tile> allTiles, GameOptions options) {
    List<Yaku> yaku = new ArrayList<>(List.of(Yaku.of("七对子", 2)));
    if (options.tsumo()) yaku.add(Yaku.of("门前清自摸和", 1));
    addRiichi(yaku, options, true);
    if (isTanyao(allTiles)) yaku.add(Yaku.of("断幺九", 1));
    if (isHonroutou(allTiles)) yaku.add(Yaku.of("混老头", 2));
    if (isHonitsu(allTiles)) yaku.add(Yaku.of("混一色", 3));
    if (isChinitsu(allTiles)) yaku.add(Yaku.of("清一色", 6));

    List<Yaku> yakuman = new ArrayList<>();
    if (allTiles.stream().allMatch(Tile::isHonor)) yakuman.add(Yaku.yakuman("字一色"));
    addSituationalYakuman(yakuman, options);
    if (!yakuman.isEmpty()) return yakuman;

    addHaitei(yaku, options);
    addDora(yaku, options);
    return yaku;
  }

  private static List<Yaku> standard(
      Combination combination, List<Tile> allTiles, Tile winTile, GameOptions options) {
    List<Yaku> yakuman = yakuman(combination, allTiles, winTile, options);
    if (!yakuman.isEmpty()) return yakuman;

    List<Yaku> yaku = new ArrayList<>();
    List<Meld> melds = combination.melds();
    Meld pair = combination.pair();
    List<Meld> groups = combination.groups();
    boolean concealed = groups.stream().noneMatch(Meld::open);
    List<Meld> sequences = groups.stream().filter(m -> m.kind() == Kind.SHUNZI).toList();
    List<Meld> triplets = groups.stream().filter(Meld::isTriplet).toList();

    if (concealed && options.tsumo()) yaku.add(Yaku.of("门前清自摸和", 1));
    addRiichi(yaku, options, concealed);

    if (concealed && isPinfu(combination, winTile, options)) yaku.add(Yaku.of("平和", 1));
    if (isTanyao(allTiles)) yaku.add(Yaku.of("断幺九", 1));
    if (concealed && hasIipeiko(sequences) && !hasRyanpeiko(sequences)) {
      yaku.add(Yaku.of("一杯口", 1));
    }

    yaku.addAll(yakuhai(triplets, options));

    if (hasSanshokuDoujun(sequences)) yaku.add(Yaku.of("三色同顺", concealed ? 2 : 1));
    if (hasIttsu(sequences)) yaku.add(Yaku.of("一气通贯", concealed ? 2 : 1));
    if (isChanta(melds)) yaku.add(Yaku.of("混全带幺九", concealed ? 2 : 1));
    if (groups.stream().allMatch(Meld::isTriplet)) yaku.add(Yaku.of("对对和", 2));
    Wait wait = FuCalculator.wait(combination, winTile);
    if (isSanankou(triplets, winTile, options.tsumo(), wait)) yaku.add(Yaku.of("三暗刻", 2));
    if (hasSanshokuDoukou(triplets)) yaku.add(Yaku.of("三色同刻", 2));
    if (isHonroutou(allTiles)) yaku.add(Yaku.of("混老头", 2));
    if (triplets.stream().filter(m -> m.kind() == Kind.GANGZI).count() == 3) {
      yaku.add(Yaku.of("三杠子", 2));
    }
    if (isShousangen(triplets, pair)) yaku.add(Yaku.of("小三元", 2));

    if (concealed && hasRyanpeiko(sequences)) yaku.add(Yaku.of("二杯口", 3));
    if (isHonitsu(allTiles)) yaku.add(Yaku.of("混一色", concealed ? 3 : 2));
    if (isJunchan(melds)) yaku.add(Yaku.of("纯全带幺九", concealed ? 3 : 2));

    if (isChinitsu(allTiles)) yaku.add(Yaku.of("清一色", concealed ? 6 : 5));

    addHaitei(yaku, options);
    addDora(yaku, options);
    removeConflicts(yaku);
    return yaku;
  }

  private static List<Yaku> yakuman(
      Combination combination, List<Tile> allTiles, Tile winTile, GameOptions options) {
    List<Yaku> yaku = new ArrayList<>();
    Meld pair = combination.pair();
    List<Meld> groups = combination.groups();
    List<Meld> triplets = groups.stream().filter(Meld::isTriplet).toList();
    boolean concealed = groups.stream().noneMatch(Meld::open);

    if (concealed && isSuuankou(triplets, winTile, options.tsumo())) yaku.add(Yaku.yakuman("四暗刻"));
    if (triplets.stream().filter(m -> m.first().isDragon()).count() == 3) {
      yaku.add(Yaku.yakuman("大三元"));
    }
    long windTriplets = triplets.stream().filter(m -> m.first().isWind()).count();
    if (windTriplets == 3 && pair.first().isWind()) yaku.add(Yaku.yakuman("小四喜"));
    if (windTriplets == 4) yaku.add(Yaku.yakuman("大四喜"));
    if (allTiles.stream().allMatch(Tile::isHonor)) yaku.add(Yaku.yakuman("字一色"));
    if (allTiles.stream().allMatch(Tile::isGreen)) yaku.add(Yaku.yakuman("绿一色"));
    if (allTiles.stream().allMatch(Tile::isTerminal)) yaku.add(Yaku.yakuman("清老头"));
    if (concealed && isChuuren(allTiles)) yaku.add(Yaku.yakuman("九莲宝灯"));
    if (triplets.stream().filter(m -> m.kind() == Kind.GANGZI).count() == 4) {
      yaku.add(Yaku.yakuman("四杠子"));
    }
    addSituationalYakuman(yaku, options);
    return yaku;
  }

  private static boolean isPinfu(Combination combination, Tile winTile, GameOptions options) {
    return combination.groups().stream().allMatch(m -> m.kind() == Kind.SHUNZI)
        && !FuCalculator.isYakuhaiPair(combination.pair(), options)
        && FuCalculator.wait(combination, winTile) == Wait.LIANGMIAN;
  }

  private static boolean isTanyao(List<Tile> tiles) {
    return tiles.stream().allMatch(t -> t.isNumber() && t.rank() >= 2 && t.rank() <= 8);
  }

  private static boolean hasIipeiko(List<Meld> sequences) {
    for (int i = 0; i < sequences.size(); i++) {
      for (int j = i + 1; j < sequences.size(); j++) {
        if (identical(sequences.get(i), sequences.get(j))) return true;
      }
    }
    return false;
  }

  private static boolean hasRyanpeiko(List<Meld> sequences) {
    if (sequences.size() < 4) return false;
    int pairs = 0;
    Set<Integer> used = new HashSet<>();
    for (int i = 0; i < sequences.size(); i++) {
      if (used.contains(i)) continue;
      for (int j = i + 1; j < sequences.size(); j++) {
        if (used.contains(j)) continue;
        if (identical(sequences.get(i), sequences.get(j))) {
          pairs++;
          used.add(i);
          used.add(j);
          break;
        }
      }
    }
    return pairs >= 2;
  }

  private static List<Yaku> yakuhai(List<Meld> triplets, GameOptions options) {
    List<Yaku> out = new ArrayList<>();
    for (Meld m : triplets) {
      Tile t = m.first();
      if (t.isDragon()) {
        out.add(Yaku.of(t.rank() == 5 ? "役牌:中" : t.rank() == 6 ? "役牌:发" : "役牌:白", 1));
      }
      if (t.isWind() && t.rank() == options.roundWind()) out.add(Yaku.of("役牌:场风牌", 1));
      if (t.isWind() && t.rank() == options.seatWind()) out.add(Yaku.of("役牌:自风牌", 1));
    }
    return out;
  }

  private static boolean hasSanshokuDoujun(List<Meld> sequences) {
    for (Meld m : sequences) {
      Set<Character> suits = new HashSet<>();
      for (Meld s : sequences) {
        if (s.first().rank() == m.first().rank()) suits.add(s.first().suit());
      }
      if (suits.contains('m') && suits.contains('p') && suits.contains('s')) return true;
    }
    return false;
  }

  private static boolean hasIttsu(List<Meld> sequences) {
    for (char suit : new char[] {'m', 'p', 's'}) {
      Set<Integer> starts = new HashSet<>();
      for (Meld m : sequences) if (m.first().suit() == suit) starts.add(m.first().rank());
      if (starts.contains(1) && starts.contains(4) && starts.contains(7)) return true;
    }
    return false;
  }

  private static boolean isChanta(List<Meld> melds) {
    return melds.stream().anyMatch(m -> m.kind() == Kind.SHUNZI)
        && melds.stream().anyMatch(m -> m.tiles().stream().anyMatch(Tile::isHonor))
        && melds.stream().allMatch(m -> m.tiles().stream().anyMatch(Tile::isTerminalOrHonor));
  }

  private static boolean isJunchan(List<Meld> melds) {
    return melds.stream().anyMatch(m -> m.kind() == Kind.SHUNZI)
        && melds.stream().noneMatch(m -> m.tiles().stream().anyMatch(Tile::isHonor))
        && melds.stream().allMatch(m -> m.tiles().stream().anyMatch(Tile::isTerminal));
  }

  private static boolean isSanankou(List<Meld> triplets, Tile winTile, boolean tsumo, Wait wait) {
    int concealedTriplets = 0;
    boolean ronTargetCounted = false;
    for (Meld m : triplets) {
      if (m.open()) continue;
      if (!tsumo && wait == Wait.DUIPENG && !ronTargetCounted && m.first().equals(winTile)) {
        ronTargetCounted = true;
        continue;
      }
      concealedTriplets++;
    }
    return concealedTriplets == 3;
  }

  private static boolean hasSanshokuDoukou(List<Meld> triplets) {
    for (Meld m : triplets) {
      Tile t = m.first();
      if (!t.isNumber()) continue;
      Set<Character> suits = new HashSet<>();
      for (Meld k : triplets) {
        if (k.first().isNumber() && k.first().rank() == t.rank()) suits.add(k.first().suit());
      }
      if (suits.size() >= 3) return true;
    }
    return false;
  }

  private static boolean isHonroutou(List<Tile> tiles) {
    return tiles.stream().anyMatch(Tile::isTerminal)
        && tiles.stream().anyMatch(Tile::isHonor)
        && tiles.stream().allMatch(Tile::isTerminalOrHonor);
  }

  private static boolean isShousangen(List<Meld> triplets, Meld pair) {
    return triplets.stream().filter(m -> m.first().isDragon()).count() == 2
        && pair.first().isDragon();
  }

  private static boolean isHonitsu(List<Tile> tiles) {
    if (tiles.stream().noneMatch(Tile::isHonor)) return false;
    Set<Character> suits = new HashSet<>();
    for (Tile t : tiles) if (t.isNumber()) suits.add(t.suit());
    return suits.size() == 1;
  }

  private static boolean isChinitsu(List<Tile> tiles) {
    if (tiles.stream().anyMatch(Tile::isHonor)) return false;
    Set<Character> suits = new HashSet<>();
    for (Tile t : tiles) suits.add(t.suit());
    return suits.size() == 1;
  }

  private static boolean isSuuankou(List<Meld> triplets, Tile winTile, boolean tsumo) {
    if (triplets.size() != 4) return false;
    if (tsumo) return triplets.stream().noneMatch(Meld::open);
    // On a ron the triplet the winning tile completed counts as open, so only a pair wait is left.
    int concealedTriplets = 0;
    for (Meld m : triplets) {
      if (m.open() || m.first().equals(winTile)) continue;
      concealedTriplets++;
    }
    return concealedTriplets == 4;
  }

  private static boolean isChuuren(List<Tile> tiles) {
    if (tiles.stream().anyMatch(Tile::isHonor)) return false;
    Set<Character> suits = new HashSet<>();
    for (Tile t : tiles) suits.add(t.suit());
    if (suits.size() != 1) return false;
    Map<Integer, Integer> counts = new TreeMap<>();
    for (Tile t : tiles) counts.merge(t.rank(), 1, Integer::sum);
    if (counts.getOrDefault(1, 0) < 3 || counts.getOrDefault(9, 0) < 3) return false;
    for (int r = 2; r <= 8; r++) if (counts.getOrDefault(r, 0) < 1) return false;
    return true;
  }

  private static void addRiichi(List<Yaku> yaku, GameOptions options, boolean concealed) {
    if (!concealed) return;
    if (options.doubleRiichi()) {
      yaku.add(Yaku.of("两立直", 2));
    } else if (options.riichi()) {
      yaku.add(Yaku.of("立直", 1));
    }
    if ((options.doubleRiichi() || options.riichi()) && options.ippatsu()) {
      yaku.add(Yaku.of("一发", 1));
    }
  }

  private static void addHaitei(List<Yaku> yaku, GameOptions options) {
    if (options.tsumo() && options.rinshan()) {
      yaku.add(Yaku.of("岭上开花", 1));
    } else if (options.tsumo() && options.haitei()) {
      yaku.add(Yaku.of("海底摸月", 1));
    }
    if (!options.tsumo() && options.chankan()) {
      yaku.add(Yaku.of("抢杠", 1));
    } else if (!options.tsumo() && options.haitei()) {
      yaku.add(Yaku.of("河底捞鱼", 1));
    }
  }

  private static void addSituationalYakuman(List<Yaku> yaku, GameOptions options) {
    if (options.tenhou()) yaku.add(Yaku.yakuman("天和"));
    if (options.chiihou()) yaku.add(Yaku.yakuman("地和"));
  }

  private static void addDora(List<Yaku> yaku, GameOptions options) {
    if (options.dora() > 0) yaku.add(Yaku.of("宝牌", options.dora()));
  }

  private static boolean identical(Meld a, Meld b) {
    return a.kind() == b.kind() && a.first().equals(b.first());
  }

  private static void removeConflicts(List<Yaku> yaku) {
    Set<String> names = new HashSet<>();
    for (Yaku y : yaku) names.add(y.name());
    if (names.contains("二杯口")) yaku.removeIf(y -> "一杯口".equals(y.name()));
    if (names.contains("纯全带幺九")) yaku.removeIf(y -> "混全带幺九".equals(y.name()));
    if (names.contains("清一色")) yaku.removeIf(y -> "混一色".equals(y.name()));
  }
}
