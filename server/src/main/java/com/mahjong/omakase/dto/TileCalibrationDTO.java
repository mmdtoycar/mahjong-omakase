package com.mahjong.omakase.dto;

import com.mahjong.omakase.model.TileCalibration;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TileCalibrationDTO {
  private Long id;
  private String imagePreview;
  private String handText;
  private Boolean isFull34Set;
  private LocalDateTime createdAt;

  public static TileCalibrationDTO fromEntity(TileCalibration entity) {
    if (entity == null) return null;
    return new TileCalibrationDTO(
        entity.getId(),
        entity.getImagePreview(),
        entity.getHandText(),
        entity.getIsFull34Set(),
        entity.getCreatedAt());
  }
}
