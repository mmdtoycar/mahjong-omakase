package com.mahjong.omakase.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Keeps a copy of every recognised photo next to what the model answered.
 *
 * <p>Written for one purpose: a local tile detector needs training and evaluation data, and the
 * only source of realistically framed photos of this particular tile set is the app itself. Today
 * each photo is decoded, sent, and dropped, so every session that goes by is data lost for good.
 * The corrected hand is already kept as {@code Round.winHand}; this supplies the missing half.
 *
 * <p>Deliberately best-effort. A failure here is logged and swallowed, never propagated — losing a
 * training sample is a nuisance, failing a recognition the user is waiting on is not.
 */
@Slf4j
@Component
public class RecognitionSampleStore {

  /** Server-generated, so nothing user-supplied ever reaches a path. */
  private static final DateTimeFormatter DAY =
      DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

  private static final DateTimeFormatter STAMP =
      DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS'Z'").withZone(ZoneOffset.UTC);

  private static final Map<String, String> EXTENSIONS =
      Map.of(
          "image/jpeg", "jpg",
          "image/png", "png",
          "image/webp", "webp",
          "image/heic", "heic",
          "image/heif", "heif");

  private final Optional<Path> root;

  public RecognitionSampleStore(@Value("${recognition.sample-dir:}") String sampleDir) {
    this.root =
        sampleDir == null || sampleDir.isBlank()
            ? Optional.empty()
            : Optional.of(Path.of(sampleDir));
    root.ifPresentOrElse(
        dir -> log.info("Recognition samples will be written to {}", dir),
        () -> log.info("Recognition samples are not being kept (recognition.sample-dir is unset)"));
  }

  /**
   * Writes the photo and a sidecar JSON describing what the model made of it.
   *
   * <p>Both files share a stem so a later training script can pair them by name, and they are
   * grouped into a directory per UTC day so no single directory grows unbounded and a date range is
   * easy to pull.
   */
  public void save(String imageBase64, String mimeType, String model, String rawJson) {
    if (root.isEmpty()) {
      return;
    }
    try {
      Instant now = Instant.now();
      Path dir = root.get().resolve(DAY.format(now));
      Files.createDirectories(dir);

      String stem = STAMP.format(now) + "-" + model;
      byte[] image = Base64.getDecoder().decode(imageBase64);
      Files.write(dir.resolve(stem + "." + extensionFor(mimeType)), image);
      Files.writeString(
          dir.resolve(stem + ".json"),
          sidecar(now, mimeType, model, rawJson),
          StandardCharsets.UTF_8);

      log.info("Kept recognition sample {} ({} KB)", stem, image.length / 1024);
    } catch (IOException | RuntimeException e) {
      log.warn("Could not keep a recognition sample: {}", e.toString());
    }
  }

  private static String extensionFor(String mimeType) {
    return EXTENSIONS.getOrDefault(mimeType, "bin");
  }

  /**
   * Hand-built rather than serialised through Jackson because {@code rawJson} is the model's own
   * JSON text and must be embedded verbatim, not re-parsed and reformatted — the point of keeping
   * it is to see exactly what came back.
   */
  private static String sidecar(Instant now, String mimeType, String model, String rawJson) {
    return "{\"recognizedAt\":\""
        + now
        + "\",\"model\":\""
        + model
        + "\",\"mimeType\":\""
        + mimeType
        + "\",\"rawJson\":"
        + quote(rawJson)
        + "}\n";
  }

  private static String quote(String value) {
    StringBuilder out = new StringBuilder(value.length() + 2).append('"');
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      switch (c) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    return out.append('"').toString();
  }
}
