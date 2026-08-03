package com.mahjong.omakase.model;

public enum GameMode {
  GUOBIAO("国标麻将", 0.0),
  RIICHI("立直麻将", 25000.0),
  DONGBEI("东北麻将", 0.0);

  private final String displayName;
  private final double startingPoints;

  GameMode(String displayName, double startingPoints) {
    this.displayName = displayName;
    this.startingPoints = startingPoints;
  }

  public String getDisplayName() {
    return displayName;
  }

  /** 起始点数 — Riichi starts everyone at 25000, the other modes score from 0. */
  public double getStartingPoints() {
    return startingPoints;
  }
}
