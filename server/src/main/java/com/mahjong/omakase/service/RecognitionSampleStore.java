package com.mahjong.omakase.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
   * Writes the photo and a sidecar JSON describing what the given recogniser made of it.
   *
   * <p>The photo is named after a digest of its own bytes, and the answer after the photo plus the
   * recogniser. That is what makes the two engines pair up: recognising the same photo locally and
   * then online produces {@code <digest>.jpg}, {@code <digest>-local.json} and {@code
   * <digest>-gemini-3.6-flash.json} — one image, two answers, joinable by a directory listing. The
   * first scheme stamped the time into the name, so the same photo sent twice became two unrelated
   * samples and the comparison had to be done by eye.
   *
   * <p>The image is written only once. When it is already there the bytes are identical by
   * construction, so re-writing it would only burn disk on a small droplet.
   *
   * <p>Grouped into a directory per UTC day so no single directory grows unbounded and a date range
   * is easy to pull. The wall-clock time of each recognition lives in the sidecar's {@code
   * recognizedAt}, which is where it is actually useful.
   */
  public void save(String imageBase64, String mimeType, String model, String rawJson) {
    write(imageBase64, mimeType, model, "\"rawJson\":" + quote(rawJson));
  }

  /**
   * Records that a recogniser was asked and could not answer.
   *
   * <p>A failure is a sample too, and on this project it is the more interesting one: the photos
   * the local reader cannot read are precisely the ones worth studying. Written under the same
   * digest as the photo, so it sits next to whatever the fallback did answer — a directory listing
   * then shows "local could not read this, and Gemini said that" without anyone pairing anything up
   * by hand.
   */
  public void saveFailure(String imageBase64, String mimeType, String model, String reason) {
    write(imageBase64, mimeType, model, "\"error\":" + quote(reason == null ? "" : reason));
  }

  private void write(String imageBase64, String mimeType, String model, String outcome) {
    if (root.isEmpty()) {
      return;
    }
    try {
      Instant now = Instant.now();
      Path dir = root.get().resolve(DAY.format(now));
      Files.createDirectories(dir);

      byte[] image = Base64.getDecoder().decode(imageBase64);
      String stem = digest(image);
      Path photo = dir.resolve(stem + "." + extensionFor(mimeType));
      if (!Files.exists(photo)) {
        Files.write(photo, image);
      }
      Files.writeString(
          dir.resolve(stem + "-" + model + ".json"),
          sidecar(now, mimeType, model, outcome),
          StandardCharsets.UTF_8);

      log.info("Kept recognition sample {} from {} ({} KB)", stem, model, image.length / 1024);
    } catch (IOException | RuntimeException e) {
      log.warn("Could not keep a recognition sample: {}", e.toString());
    }
  }

  /**
   * First 12 hex characters of the photo's SHA-256 — enough that a collision across one day's
   * photos is not a thing to think about, and short enough to read in a directory listing.
   */
  private static String digest(byte[] image) {
    try {
      byte[] hash = MessageDigest.getInstance("SHA-256").digest(image);
      StringBuilder out = new StringBuilder(12);
      for (int i = 0; i < 6; i++) {
        out.append(String.format("%02x", hash[i]));
      }
      return out.toString();
    } catch (NoSuchAlgorithmException e) {
      // SHA-256 is required of every JVM, so this cannot happen; it is checked, so it must be
      // caught.
      throw new IllegalStateException("SHA-256 is unavailable", e);
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
  private static String sidecar(Instant now, String mimeType, String model, String outcome) {
    return "{\"recognizedAt\":\""
        + now
        + "\",\"model\":\""
        + model
        + "\",\"mimeType\":\""
        + mimeType
        + "\","
        + outcome
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
