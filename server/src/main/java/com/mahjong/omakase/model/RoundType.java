package com.mahjong.omakase.model;

public enum RoundType {
  WIN,
  DRAWN_GAME;

  public static RoundType fromString(String value) {
    if (value == null || value.isEmpty()) {
      return WIN;
    }
    try {
      return valueOf(value.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid round type: " + value);
    }
  }
}
