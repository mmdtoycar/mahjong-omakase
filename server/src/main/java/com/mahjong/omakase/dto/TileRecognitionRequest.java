package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

  /**
   * Which recogniser to use. Defaults to the local reader, so a client that does not send this
   * field gets the fast free path; the UI's online button sends {@code gemini}.
   */
  @NotNull(message = "识别方式不能为空")
  @Pattern(regexp = "local|gemini", message = "识别方式只能是 local 或 gemini")
  private String engine = "local";
}
