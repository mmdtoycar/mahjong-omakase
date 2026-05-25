package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.RoundType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.util.List;

public class AddRoundRequest {
  private String roundType; // "WIN" (default) or "DRAWN_GAME"

  private Long winnerId;

  @Positive(message = "Score must be positive")
  private Integer score;

  @Min(value = 0, message = "Fan must be non-negative")
  private Integer fan;

  @Min(value = 20, message = "Fu must be at least 20")
  private Integer fu;

  private Long dealerId;

  @Min(value = 0, message = "Honba must be non-negative")
  private Integer honba;

  @Min(value = 0, message = "Kyoutaku must be non-negative")
  private Integer kyoutaku;

  private Long dealInPlayerId;

  private List<Long> bimenPlayerIds;

  private List<Long> tenpaiPlayerIds; // for drawn games

  private List<Long> riichiPlayerIds; // players who declared riichi

  private Boolean backfill;

  private String winHand;

  private String fanDetails;

  @Min(value = 0, message = "Fan count must be non-negative")
  private Integer fanCount;

  @Min(value = 1, message = "Prevalent wind must be between 1 and 4")
  @Max(value = 4, message = "Prevalent wind must be between 1 and 4")
  private Integer prevalentWind;

  public Integer getPrevalentWind() {
    return prevalentWind;
  }

  public void setPrevalentWind(Integer prevalentWind) {
    this.prevalentWind = prevalentWind;
  }

  public Integer getFanCount() {
    return fanCount;
  }

  public void setFanCount(Integer fanCount) {
    this.fanCount = fanCount;
  }

  public String getWinHand() {
    return winHand;
  }

  public void setWinHand(String winHand) {
    this.winHand = winHand;
  }

  public String getFanDetails() {
    return fanDetails;
  }

  public void setFanDetails(String fanDetails) {
    this.fanDetails = fanDetails;
  }

  public String getRoundType() {
    return roundType;
  }

  public void setRoundType(String roundType) {
    this.roundType = roundType;
  }

  public RoundType getParsedRoundType() {
    return RoundType.fromString(roundType);
  }

  public boolean isDrawnGame() {
    return getParsedRoundType() == RoundType.DRAWN_GAME;
  }

  public Long getWinnerId() {
    return winnerId;
  }

  public void setWinnerId(Long winnerId) {
    this.winnerId = winnerId;
  }

  public Integer getScore() {
    return score;
  }

  public void setScore(Integer score) {
    this.score = score;
  }

  public Integer getFan() {
    return fan;
  }

  public void setFan(Integer fan) {
    this.fan = fan;
  }

  public Integer getFu() {
    return fu;
  }

  public void setFu(Integer fu) {
    this.fu = fu;
  }

  public Long getDealerId() {
    return dealerId;
  }

  public void setDealerId(Long dealerId) {
    this.dealerId = dealerId;
  }

  public Integer getHonba() {
    return honba;
  }

  public void setHonba(Integer honba) {
    this.honba = honba;
  }

  public Integer getKyoutaku() {
    return kyoutaku;
  }

  public void setKyoutaku(Integer kyoutaku) {
    this.kyoutaku = kyoutaku;
  }

  public Long getDealInPlayerId() {
    return dealInPlayerId;
  }

  public void setDealInPlayerId(Long dealInPlayerId) {
    this.dealInPlayerId = dealInPlayerId;
  }

  public boolean isSelfDraw() {
    return dealInPlayerId == null;
  }

  public List<Long> getBimenPlayerIds() {
    return bimenPlayerIds;
  }

  public void setBimenPlayerIds(List<Long> bimenPlayerIds) {
    this.bimenPlayerIds = bimenPlayerIds;
  }

  public List<Long> getTenpaiPlayerIds() {
    return tenpaiPlayerIds;
  }

  public void setTenpaiPlayerIds(List<Long> tenpaiPlayerIds) {
    this.tenpaiPlayerIds = tenpaiPlayerIds;
  }

  public List<Long> getRiichiPlayerIds() {
    return riichiPlayerIds;
  }

  public void setRiichiPlayerIds(List<Long> riichiPlayerIds) {
    this.riichiPlayerIds = riichiPlayerIds;
  }

  public Boolean getBackfill() {
    return backfill;
  }

  public void setBackfill(Boolean backfill) {
    this.backfill = backfill;
  }

  private Boolean chombo;

  public Boolean getChombo() {
    return chombo;
  }

  public void setChombo(Boolean chombo) {
    this.chombo = chombo;
  }
}
