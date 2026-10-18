package com.mahjong.omakase.service.scoring.riichi;

/** What the table and the moment of the win add to a hand. Winds are 1=东 .. 4=北. */
public record GameOptions(
    boolean tsumo,
    int roundWind,
    int seatWind,
    boolean riichi,
    boolean doubleRiichi,
    boolean ippatsu,
    boolean chankan,
    boolean rinshan,
    boolean haitei,
    boolean tenhou,
    boolean chiihou,
    int dora) {}
