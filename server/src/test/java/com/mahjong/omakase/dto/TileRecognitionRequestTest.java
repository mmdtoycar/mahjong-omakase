package com.mahjong.omakase.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** 这些校验以前是静默 400 (handleValidation 不打日志), iPhone 上的识别失败就因此完全没有线索, 所以把每条规则钉住。 */
class TileRecognitionRequestTest {

  private static ValidatorFactory factory;
  private static Validator validator;

  @BeforeAll
  static void setUp() {
    factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @AfterAll
  static void tearDown() {
    factory.close();
  }

  private Set<String> violations(String imageBase64, String mimeType) {
    TileRecognitionRequest req = new TileRecognitionRequest();
    req.setImageBase64(imageBase64);
    req.setMimeType(mimeType);
    return validator.validate(req).stream()
        .map(v -> v.getPropertyPath() + ": " + v.getMessage())
        .collect(Collectors.toSet());
  }

  @Test
  void acceptsJpeg() {
    assertThat(violations("AAAA", "image/jpeg")).isEmpty();
  }

  /** iPhone 默认存 HEIC, 归一化在大图解码失败时会退回原始文件, 所以必须放行。 */
  @Test
  void acceptsHeicAndHeif() {
    assertThat(violations("AAAA", "image/heic")).isEmpty();
    assertThat(violations("AAAA", "image/heif")).isEmpty();
  }

  @Test
  void acceptsPngAndWebp() {
    assertThat(violations("AAAA", "image/png")).isEmpty();
    assertThat(violations("AAAA", "image/webp")).isEmpty();
  }

  @Test
  void rejectsUnsupportedMime() {
    assertThat(violations("AAAA", "image/gif")).anyMatch(v -> v.contains("mimeType"));
    assertThat(violations("AAAA", "application/pdf")).anyMatch(v -> v.contains("mimeType"));
  }

  /** mimeType 可选: 不传就用默认的 image/jpeg。 */
  @Test
  void allowsNullMime() {
    assertThat(violations("AAAA", null)).isEmpty();
  }

  /** 客户端把空 data URL 切出 undefined 时, 字段会缺失 —— 就是 iPhone 上踩到的那条路。 */
  @Test
  void rejectsBlankImage() {
    assertThat(violations(null, "image/jpeg")).anyMatch(v -> v.contains("imageBase64"));
    assertThat(violations("", "image/jpeg")).anyMatch(v -> v.contains("imageBase64"));
    assertThat(violations("   ", "image/jpeg")).anyMatch(v -> v.contains("imageBase64"));
  }

  @Test
  void rejectsOversizedImage() {
    String tooBig = "A".repeat(8_000_001);
    assertThat(violations(tooBig, "image/jpeg")).anyMatch(v -> v.contains("图片过大"));
  }

  @Test
  void acceptsImageAtTheSizeLimit() {
    String atLimit = "A".repeat(8_000_000);
    assertThat(violations(atLimit, "image/jpeg")).isEmpty();
  }
}
