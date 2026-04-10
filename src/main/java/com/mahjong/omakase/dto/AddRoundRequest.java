package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public class AddRoundRequest {
  @NotNull(message = "Winner is required")
  private Long winnerId;

  // For non-Riichi modes: raw score
  @Positive(message = "Score must be positive")
  private Integer score;

  // For Riichi mode
  private Integer han;
  private Integer fu;
  private Long dealerId; // the table dealer (親) player ID
  private Integer honba; // 本場 count

  private Long dealInPlayerId; // null means 自摸 (self-draw)

  private List<Long> bimenPlayerIds; // 闭门 players (for Dongbei)

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
}
