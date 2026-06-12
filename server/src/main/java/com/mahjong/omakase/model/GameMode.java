package com.mahjong.omakase.model;

public enum GameMode {
  GUOBIAO("国标麻将", 10.0, 0.0),
  RIICHI("立直麻将", 2000.0, 25000.0),
  DONGBEI("东北麻将", 10.0, 0.0);

  private static final double[] UMA_3P = {15.0, 5.0, -5.0};
  private static final double[] UMA_4P = {15.0, 5.0, -5.0, -15.0};

  private final String displayName;
  private final double rpFactor;
  private final double rpOrigin;

  GameMode(String displayName, double rpFactor, double rpOrigin) {
    this.displayName = displayName;
    this.rpFactor = rpFactor;
    this.rpOrigin = rpOrigin;
  }

  public String getDisplayName() {
    return displayName;
  }

  public double getRpFactor() {
    return rpFactor;
  }

  public double getRpOrigin() {
    return rpOrigin;
  }

  public double[] getUmaDist(int playerCount) {
    return playerCount == 3 ? UMA_3P : UMA_4P;
  }
}
