package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RecognitionSampleStoreTest {

  private static final String JPEG = Base64.getEncoder().encodeToString(new byte[] {1, 2, 3, 4});

  private static List<Path> filesUnder(Path root) throws IOException {
    try (Stream<Path> walk = Files.walk(root)) {
      return walk.filter(Files::isRegularFile).sorted().toList();
    }
  }

  /**
   * Named by extension rather than by position: the two files no longer share a stem, so which of
   * them sorts first depends on the digest and on '-' sorting before '.'.
   */
  private static List<String> namesEnding(Path root, String suffix) throws IOException {
    return filesUnder(root).stream()
        .map(path -> path.getFileName().toString())
        .filter(name -> name.endsWith(suffix))
        .toList();
  }

  @Test
  void writesThePhotoAndASidecarNamedAfterIt(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString())
        .save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"1m\"]}");

    assertThat(filesUnder(dir)).hasSize(2);
    String jpg = namesEnding(dir, ".jpg").get(0);
    // Pairing a photo with its answers is the whole point, so the answer is named after the photo.
    assertThat(namesEnding(dir, ".json"))
        .containsExactly(jpg.replace(".jpg", "") + "-gemini-3.6-flash.json");
  }

  /**
   * The reason the photo is named after a digest of its own bytes rather than after the clock.
   *
   * <p>Recognising the same photo locally and then online has to leave one image and two answers,
   * so that a later comparison is a directory listing rather than a manual pairing exercise. The
   * first scheme stamped the time into the name, which made the same photo sent twice into two
   * unrelated samples — and comparing the two recognisers is the entire reason the samples are
   * kept.
   */
  @Test
  void keepsOneImageAndAnAnswerPerRecogniserForTheSamePhoto(@TempDir Path dir) throws IOException {
    RecognitionSampleStore store = new RecognitionSampleStore(dir.toString());

    store.save(JPEG, "image/jpeg", "local", "{\"concealed\":[\"1m\"]}");
    store.save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"9p\"]}");

    assertThat(namesEnding(dir, ".jpg")).hasSize(1);
    String stem = namesEnding(dir, ".jpg").get(0).replace(".jpg", "");
    assertThat(namesEnding(dir, ".json"))
        .containsExactlyInAnyOrder(stem + "-local.json", stem + "-gemini-3.6-flash.json");
  }

  /** A failure is a sample too, and lands beside whatever the fallback answered. */
  @Test
  void recordsAFailureAgainstTheSamePhoto(@TempDir Path dir) throws IOException {
    RecognitionSampleStore store = new RecognitionSampleStore(dir.toString());

    store.saveFailure(JPEG, "image/jpeg", "local", "no line of tiles found");
    store.save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"9p\"]}");

    String stem = namesEnding(dir, ".jpg").get(0).replace(".jpg", "");
    Path failure = filesUnder(dir).get(0).getParent().resolve(stem + "-local.json");
    assertThat(Files.readString(failure, StandardCharsets.UTF_8))
        .contains("\"error\":\"no line of tiles found\"")
        .doesNotContain("rawJson");
    assertThat(namesEnding(dir, ".json")).hasSize(2);
  }

  @Test
  void writesTheDecodedImageBytesNotTheBase64(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString()).save(JPEG, "image/jpeg", "m", "{}");

    Path jpg =
        filesUnder(dir).stream()
            .filter(p -> p.toString().endsWith(".jpg"))
            .findFirst()
            .orElseThrow();
    assertThat(Files.readAllBytes(jpg)).containsExactly(1, 2, 3, 4);
  }

  @Test
  void groupsSamplesIntoADirectoryPerDay(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString()).save(JPEG, "image/jpeg", "m", "{}");

    Path day = filesUnder(dir).get(0).getParent();
    assertThat(day.getFileName().toString()).matches("\\d{4}-\\d{2}-\\d{2}");
    assertThat(day.getParent()).isEqualTo(dir);
  }

  /** The model's own JSON must survive verbatim — reformatting it would defeat keeping it. */
  @Test
  void embedsTheModelAnswerWithoutReparsingIt(@TempDir Path dir) throws IOException {
    String raw = "{\n  \"notes\": \"quote \\\" and \\\\ backslash\",\n  \"concealed\": []\n}";
    new RecognitionSampleStore(dir.toString()).save(JPEG, "image/heic", "gemini-3.5-flash", raw);

    String sidecar =
        Files.readString(
            filesUnder(dir).stream()
                .filter(p -> p.toString().endsWith(".json"))
                .findFirst()
                .orElseThrow(),
            StandardCharsets.UTF_8);
    assertThat(sidecar).contains("\"model\":\"gemini-3.5-flash\"", "\"mimeType\":\"image/heic\"");
    // Escaped, so the sidecar stays parseable, and recoverable, so the original text is not lost.
    assertThat(sidecar).contains("quote \\\\\\\" and \\\\\\\\ backslash");
  }

  @Test
  void namesTheFileAfterTheActualImageType(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString()).save(JPEG, "image/heic", "m", "{}");
    assertThat(namesEnding(dir, ".heic")).hasSize(1);
  }

  @Test
  void keepsNothingWhenNoDirectoryIsConfigured(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore("").save(JPEG, "image/jpeg", "m", "{}");
    new RecognitionSampleStore(null).save(JPEG, "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).isEmpty();
  }

  /**
   * The caller is a user waiting on a recognition that already succeeded. Losing a training sample
   * is a nuisance; turning it into a failed recognition is not acceptable.
   */
  @Test
  void swallowsAnUndecodableImageRatherThanFailingTheRecognition(@TempDir Path dir)
      throws IOException {
    new RecognitionSampleStore(dir.toString()).save("not base64!!", "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).isEmpty();
  }

  @Test
  void swallowsAnUnwritableDirectoryRatherThanFailingTheRecognition(@TempDir Path dir)
      throws IOException {
    // A path whose parent is a regular file can never be created.
    Path file = Files.createFile(dir.resolve("occupied"));
    new RecognitionSampleStore(file.resolve("nested").toString())
        .save(JPEG, "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).containsExactly(file);
  }
}
