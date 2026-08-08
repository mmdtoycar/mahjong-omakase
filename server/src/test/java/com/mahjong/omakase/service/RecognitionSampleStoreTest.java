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

  @Test
  void writesThePhotoAndASidecarSharingOneStem(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString())
        .save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"1m\"]}");

    List<Path> files = filesUnder(dir);
    assertThat(files).hasSize(2);
    String jpg = files.get(0).getFileName().toString();
    String json = files.get(1).getFileName().toString();
    assertThat(jpg).endsWith("-gemini-3.6-flash.jpg");
    assertThat(json).endsWith("-gemini-3.6-flash.json");
    // Pairing a photo with its answer is the whole point, so the stems have to match exactly.
    assertThat(jpg.replace(".jpg", "")).isEqualTo(json.replace(".json", ""));
  }

  @Test
  void writesTheDecodedImageBytesNotTheBase64(@TempDir Path dir) throws IOException {
    new RecognitionSampleStore(dir.toString()).save(JPEG, "image/jpeg", "m", "{}");

    Path jpg = filesUnder(dir).get(0);
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
    assertThat(filesUnder(dir).get(0).toString()).endsWith(".heic");
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
