package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.RoundType;
import jakarta.validation.constraints.Positive;
import java.util.List;

public class AddRoundRequest {
  private String roundType; // "WIN" (default) or "DRAWN_GAME"

  private Long winnerId;

  @Positive(message = "Score must be positive")
  private Integer score;

  private Integer han;
  private Integer fu;
  private Long dealerId;
  private Integer honba;
  private Integer kyoutaku;

  private Long dealInPlayerId;

  private List<Long> bimenPlayerIds;

  private List<Long> tenpaiPlayerIds; // for drawn games

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

  public Integer getHan() {
    return han;
  }

  public void setHan(Integer han) {
    this.han = han;
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
}
