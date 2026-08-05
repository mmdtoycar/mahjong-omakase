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

/**
 * These constraints used to fail as a silent 400 (handleValidation did not log), which is why the
 * iPhone recognition failure left no trace at all. Pin every rule down.
 */
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

  /** iPhone stores HEIC, and normalisation falls back to the original on a decode failure. */
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

  /** mimeType is optional — omitting it falls back to image/jpeg. */
  @Test
  void allowsNullMime() {
    assertThat(violations("AAAA", null)).isEmpty();
  }

  /** Slicing an empty data URL yields undefined, so the field goes missing — the iPhone path. */
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
