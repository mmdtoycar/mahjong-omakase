package com.mahjong.omakase.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Keeps a copy of every recognised photo, what each recogniser answered, and what the user
 * confirmed.
 *
 * <p>Written for one purpose: a local tile detector needs training and evaluation data, and the
 * only source of realistically framed photos of this particular tile set is the app itself. Today
 * each photo is decoded, sent, and dropped, so every session that goes by is data lost for good.
 *
 * <p>One photo is one sample and one JSON file beside it, holding every answer it has ever had:
 *
 * <pre>
 * 2026-08-09/a3f1c8e90b21.jpg
 * 2026-08-09/a3f1c8e90b21.json
 *   {"photo": "a3f1c8e90b21.jpg", "mimeType": "image/jpeg",
 *    "answers": {"local":             {"recognizedAt": "...", "rawJson": "..."},
 *                "gemini-3.6-flash":  {"recognizedAt": "...", "rawJson": "..."}},
 *    "confirmed": {"confirmedAt": "...", "hand": {...}}}
 * </pre>
 *
 * <p>The consumer is an offline script comparing the local reader against Gemini against what the
 * user actually confirmed, and it wants all of that for one photo in one read. Splitting it per
 * writer would only buy append-only writes, which at a few samples an evening nobody is paying for.
 *
 * <p>The name is a digest of the photo's own bytes, which is what makes the same photo recognised
 * twice one sample rather than two. The first scheme stamped the time into the name, so re-reading
 * a photo produced an unrelated sample and comparing the recognisers had to be done by eye. Grouped
 * into a directory per UTC day so no directory grows unbounded and a date range is easy to pull.
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

  /** What {@link #write} hands out and {@link #saveConfirmed} will accept back. */
  private static final Pattern SAMPLE_ID = Pattern.compile("\\d{4}-\\d{2}-\\d{2}/[0-9a-f]{12}");

  private static final Map<String, String> EXTENSIONS =
      Map.of(
          "image/jpeg", "jpg",
          "image/png", "png",
          "image/webp", "webp",
          "image/heic", "heic",
          "image/heif", "heif");

  /**
   * Held while a sample is read back and written out. Two recognitions of the same photo at once
   * would otherwise be a lost update, and the whole point of the digest naming is that the same
   * photo lands in the same place.
   */
  private final Lock lock = new ReentrantLock();

  private final ObjectMapper json;
  private final Optional<Path> root;

  public RecognitionSampleStore(
      ObjectMapper json, @Value("${recognition.sample-dir:}") String sampleDir) {
    this.json = json;
    this.root =
        sampleDir == null || sampleDir.isBlank()
            ? Optional.empty()
            : Optional.of(Path.of(sampleDir));
    root.ifPresentOrElse(
        dir -> log.info("Recognition samples will be written to {}", dir),
        () -> log.info("Recognition samples are not being kept (recognition.sample-dir is unset)"));
  }

  /**
   * Writes the photo, if it is not already there, and files what this recogniser made of it.
   *
   * @return the sample's id, {@code <day>/<digest>}, or null when nothing was kept
   */
  public String save(String imageBase64, String mimeType, String model, String rawJson) {
    return write(imageBase64, mimeType, model, "rawJson", rawJson);
  }

  /**
   * Records that a recogniser was asked and could not answer.
   *
   * <p>A failure is a sample too, and on this project it is the more interesting one: the photos
   * the local reader cannot read are precisely the ones worth studying. Filed in the same slot as
   * an answer would be, so one sample reads "local could not do this, and here is what Gemini
   * said".
   *
   * @return the sample's id, {@code <day>/<digest>}, or null when nothing was kept
   */
  public String saveFailure(String imageBase64, String mimeType, String model, String reason) {
    return write(imageBase64, mimeType, model, "error", reason == null ? "" : reason);
  }

  /**
   * Records the hand the user confirmed, which is the only label in a sample a human has checked.
   *
   * <p>Everything else in it is what a model answered, and a model's answer is not a label —
   * measuring the local reader against Gemini's opinion says where the two differ, not which one
   * was right. This is what the user pressed apply on after fixing whatever the recognition got
   * wrong, so it is the half that makes the collected photos trainable.
   *
   * <p>The id is validated rather than trusted. It arrives from the browser and is resolved against
   * the sample directory, which is exactly the shape of a path traversal, so anything that is not a
   * day and a digest is dropped on the floor.
   */
  public void saveConfirmed(String sampleId, JsonNode hand) {
    if (root.isEmpty()) {
      return;
    }
    if (sampleId == null || !SAMPLE_ID.matcher(sampleId).matches()) {
      log.warn("Ignoring a confirmed hand: {} is not a sample id", sampleId);
      return;
    }
    lock.lock();
    try {
      Path sidecar = root.get().resolve(sampleId + ".json");
      Files.createDirectories(sidecar.getParent());
      ObjectNode sample = read(sidecar);
      ObjectNode confirmed = sample.putObject("confirmed");
      confirmed.put("confirmedAt", Instant.now().toString());
      confirmed.set("hand", hand);
      replace(sidecar, sample);
      log.info("Kept the confirmed hand for sample {}", sampleId);
    } catch (IOException | RuntimeException e) {
      log.warn("Could not keep a confirmed hand: {}", e.toString());
    } finally {
      lock.unlock();
    }
  }

  private String write(
      String imageBase64, String mimeType, String model, String field, String value) {
    if (root.isEmpty()) {
      return null;
    }
    lock.lock();
    try {
      Instant now = Instant.now();
      String day = DAY.format(now);
      Path dir = root.get().resolve(day);
      Files.createDirectories(dir);

      byte[] image = Base64.getDecoder().decode(imageBase64);
      String stem = digest(image);
      String photoName = stem + "." + extensionFor(mimeType);
      Path photo = dir.resolve(photoName);
      // The bytes are identical by construction when it is already there, so re-writing it would
      // only burn disk on a small droplet.
      if (!Files.exists(photo)) {
        Files.write(photo, image);
      }

      Path sidecar = dir.resolve(stem + ".json");
      ObjectNode sample = read(sidecar);
      sample.put("photo", photoName);
      sample.put("mimeType", mimeType);
      ObjectNode answer = answers(sample).putObject(model);
      answer.put("recognizedAt", now.toString());
      // The model's own JSON text, kept as a string rather than parsed: what came back is the point
      // of keeping it, and some of it is not valid JSON at all.
      answer.put(field, value);
      replace(sidecar, sample);

      log.info("Kept recognition sample {} from {} ({} KB)", stem, model, image.length / 1024);
      return day + "/" + stem;
    } catch (IOException | RuntimeException e) {
      log.warn("Could not keep a recognition sample: {}", e.toString());
      return null;
    } finally {
      lock.unlock();
    }
  }

  private static ObjectNode answers(ObjectNode sample) {
    JsonNode existing = sample.get("answers");
    return existing instanceof ObjectNode node ? node : sample.putObject("answers");
  }

  /**
   * The sample as it stands, or a fresh one.
   *
   * <p>An unreadable file is started over rather than propagated: its contents are already lost,
   * and refusing to write would throw away the answer in hand as well.
   */
  private ObjectNode read(Path sidecar) {
    if (Files.exists(sidecar)) {
      try {
        if (json.readTree(sidecar.toFile()) instanceof ObjectNode existing) {
          return existing;
        }
      } catch (IOException e) {
        log.warn("Starting {} over, it could not be read: {}", sidecar, e.toString());
      }
    }
    return json.createObjectNode();
  }

  /** Written aside and moved into place, so a crash cannot leave a sample half rewritten. */
  private void replace(Path sidecar, ObjectNode sample) throws IOException {
    Path partial = sidecar.resolveSibling(sidecar.getFileName() + ".partial");
    json.writerWithDefaultPrettyPrinter().writeValue(partial.toFile(), sample);
    Files.move(
        partial, sidecar, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
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
}
