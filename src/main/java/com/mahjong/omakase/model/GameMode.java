package com.mahjong.omakase.model;

public enum GameMode {
  DONGBEI("抗日麻将"),
  RIICHI("立直麻将"),
  GUOBIAO("国标麻将");

  private final String displayName;

  GameMode(String displayName) {
    this.displayName = displayName;
  }

  public String getDisplayName() {
    return displayName;
  }
}
