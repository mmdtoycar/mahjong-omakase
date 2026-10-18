package com.mahjong.omakase.service.scoring.riichi;

public record Yaku(String name, int han, boolean yakuman) {

  public static Yaku of(String name, int han) {
    return new Yaku(name, han, false);
  }

  public static Yaku yakuman(String name) {
    return new Yaku(name, 13, true);
  }
}
