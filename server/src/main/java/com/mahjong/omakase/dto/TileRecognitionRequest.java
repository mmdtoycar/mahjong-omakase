package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Client request for photo hand recognition: one base64 image, no API key. */
@Data
public class TileRecognitionRequest {

  /** Bare base64 payload (no {@code data:} URI prefix). ~8MB cap keeps the heap bounded. */
  @NotBlank
  @Size(max = 8_000_000, message = "图片过大，请重新拍摄")
  private String imageBase64;

  @Pattern(
      regexp = "image/(jpeg|png|webp|heic|heif)",
      message = "仅支持 JPEG / PNG / WebP / HEIC / HEIF 图片")
  private String mimeType = "image/jpeg";
}
