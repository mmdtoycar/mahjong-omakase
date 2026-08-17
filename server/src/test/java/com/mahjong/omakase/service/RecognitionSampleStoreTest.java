package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String JPEG = Base64.getEncoder().encodeToString(new byte[] {1, 2, 3, 4});

  private static RecognitionSampleStore storeIn(String dir) {
    return new RecognitionSampleStore(MAPPER, dir);
  }

  private static List<Path> filesUnder(Path root) throws IOException {
    try (Stream<Path> walk = Files.walk(root)) {
      return walk.filter(Files::isRegularFile).sorted().toList();
    }
  }

  private static List<String> namesEnding(Path root, String suffix) throws IOException {
    return filesUnder(root).stream()
        .map(path -> path.getFileName().toString())
        .filter(name -> name.endsWith(suffix))
        .toList();
  }

  /** The sample as JSON, whatever day directory it landed in. */
  private static JsonNode sample(Path root) throws IOException {
    Path sidecar =
        filesUnder(root).stream()
            .filter(path -> path.toString().endsWith(".json"))
            .findFirst()
            .orElseThrow();
    return MAPPER.readTree(sidecar.toFile());
  }

  @Test
  void writesThePhotoAndOneSampleNamedAfterIt(@TempDir Path dir) throws IOException {
    storeIn(dir.toString())
        .save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"1m\"]}");

    // Two files and no leftovers: the sample is moved into place from a .partial.
    assertThat(filesUnder(dir)).hasSize(2);
    String jpg = namesEnding(dir, ".jpg").get(0);
    assertThat(namesEnding(dir, ".json")).containsExactly(jpg.replace(".jpg", "") + ".json");
    assertThat(sample(dir).path("photo").asText()).isEqualTo(jpg);
    assertThat(sample(dir).path("answers").path("gemini-3.6-flash").path("rawJson").asText())
        .isEqualTo("{\"concealed\":[\"1m\"]}");
  }

  /**
   * The reason the photo is named after a digest of its own bytes rather than after the clock, and
   * the reason every answer goes in one file.
   *
   * <p>Recognising the same photo locally and then online has to leave one image and one sample
   * holding both answers, so a later comparison is a single read rather than a pairing exercise.
   */
  @Test
  void keepsOneSampleWithAnAnswerPerRecogniserForTheSamePhoto(@TempDir Path dir)
      throws IOException {
    RecognitionSampleStore store = storeIn(dir.toString());

    store.save(JPEG, "image/jpeg", "local", "{\"concealed\":[\"1m\"]}");
    store.save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"9p\"]}");

    assertThat(namesEnding(dir, ".jpg")).hasSize(1);
    assertThat(namesEnding(dir, ".json")).hasSize(1);
    JsonNode answers = sample(dir).path("answers");
    assertThat(answers.path("local").path("rawJson").asText())
        .isEqualTo("{\"concealed\":[\"1m\"]}");
    assertThat(answers.path("gemini-3.6-flash").path("rawJson").asText())
        .isEqualTo("{\"concealed\":[\"9p\"]}");
    assertThat(answers.path("local").path("recognizedAt").asText()).isNotEmpty();
  }

  /** A failure fills the same slot an answer would, so one sample tells the whole story. */
  @Test
  void recordsAFailureBesideWhatTheFallbackAnswered(@TempDir Path dir) throws IOException {
    RecognitionSampleStore store = storeIn(dir.toString());

    store.saveFailure(JPEG, "image/jpeg", "local", "no line of tiles found");
    store.save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"9p\"]}");

    JsonNode answers = sample(dir).path("answers");
    assertThat(answers.path("local").path("error").asText()).isEqualTo("no line of tiles found");
    assertThat(answers.path("local").has("rawJson")).isFalse();
    assertThat(answers.path("gemini-3.6-flash").path("rawJson").asText()).contains("9p");
  }

  @Test
  void writesTheDecodedImageBytesNotTheBase64(@TempDir Path dir) throws IOException {
    storeIn(dir.toString()).save(JPEG, "image/jpeg", "m", "{}");

    Path jpg =
        filesUnder(dir).stream()
            .filter(p -> p.toString().endsWith(".jpg"))
            .findFirst()
            .orElseThrow();
    assertThat(Files.readAllBytes(jpg)).containsExactly(1, 2, 3, 4);
  }

  @Test
  void groupsSamplesIntoADirectoryPerDay(@TempDir Path dir) throws IOException {
    storeIn(dir.toString()).save(JPEG, "image/jpeg", "m", "{}");

    Path day = filesUnder(dir).get(0).getParent();
    assertThat(day.getFileName().toString()).matches("\\d{4}-\\d{2}-\\d{2}");
    assertThat(day.getParent()).isEqualTo(dir);
  }

  /**
   * The model's own text must come back out unchanged — reformatting it would defeat keeping it.
   */
  @Test
  void keepsTheModelAnswerVerbatim(@TempDir Path dir) throws IOException {
    String raw = "{\n  \"notes\": \"quote \\\" and \\\\ backslash\",\n  \"concealed\": []\n}";
    storeIn(dir.toString()).save(JPEG, "image/heic", "gemini-3.5-flash", raw);

    JsonNode kept = sample(dir);
    assertThat(kept.path("mimeType").asText()).isEqualTo("image/heic");
    assertThat(kept.path("answers").path("gemini-3.5-flash").path("rawJson").asText())
        .isEqualTo(raw);
  }

  @Test
  void namesTheFileAfterTheActualImageType(@TempDir Path dir) throws IOException {
    storeIn(dir.toString()).save(JPEG, "image/heic", "m", "{}");
    assertThat(namesEnding(dir, ".heic")).hasSize(1);
  }

  @Test
  void keepsNothingWhenNoDirectoryIsConfigured(@TempDir Path dir) throws IOException {
    storeIn("").save(JPEG, "image/jpeg", "m", "{}");
    storeIn(null).save(JPEG, "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).isEmpty();
  }

  /**
   * The caller is a user waiting on a recognition that already succeeded. Losing a training sample
   * is a nuisance; turning it into a failed recognition is not acceptable.
   */
  @Test
  void swallowsAnUndecodableImageRatherThanFailingTheRecognition(@TempDir Path dir)
      throws IOException {
    storeIn(dir.toString()).save("not base64!!", "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).isEmpty();
  }

  @Test
  void swallowsAnUnwritableDirectoryRatherThanFailingTheRecognition(@TempDir Path dir)
      throws IOException {
    // A path whose parent is a regular file can never be created.
    Path file = Files.createFile(dir.resolve("occupied"));
    storeIn(file.resolve("nested").toString()).save(JPEG, "image/jpeg", "m", "{}");
    assertThat(filesUnder(dir)).containsExactly(file);
  }

  /**
   * A sample that cannot be read is started over rather than propagated. Its contents are lost
   * either way, and refusing to write would throw away the answer in hand as well.
   */
  @Test
  void startsOverRatherThanLosingTheAnswerInHand(@TempDir Path dir) throws IOException {
    RecognitionSampleStore store = storeIn(dir.toString());
    String id = store.save(JPEG, "image/jpeg", "local", "{\"concealed\":[\"1m\"]}");
    Files.writeString(dir.resolve(id + ".json"), "not json at all", StandardCharsets.UTF_8);

    store.save(JPEG, "image/jpeg", "gemini-3.6-flash", "{\"concealed\":[\"9p\"]}");

    assertThat(sample(dir).path("answers").path("gemini-3.6-flash").path("rawJson").asText())
        .contains("9p");
  }

  /** The id is what the browser gets back and hands to {@code confirmForRound}. */
  @Test
  void handsBackAnIdThatLocatesTheSample(@TempDir Path dir) {
    String id = storeIn(dir.toString()).save(JPEG, "image/jpeg", "local", "{}");

    assertThat(id).matches("\\d{4}-\\d{2}-\\d{2}/[0-9a-f]{12}");
    assertThat(dir.resolve(id + ".json")).exists();
  }

  @Test
  void hasNoIdToHandBackWhenNothingIsKept(@TempDir Path dir) {
    assertThat(storeIn("").save(JPEG, "image/jpeg", "local", "{}")).isNull();
    assertThat(storeIn(dir.toString()).save("not base64!!", "image/jpeg", "m", "{}")).isNull();
  }

  /**
   * The confirmed hand joins the answers rather than replacing them, and moves the sample out of
   * its day folder into one named after the round.
   */
  @Test
  void filesTheConfirmedHandAndMovesTheSampleIntoARoundFolder(@TempDir Path dir)
      throws IOException {
    RecognitionSampleStore store = storeIn(dir.toString());
    String id = store.save(JPEG, "image/jpeg", "local", "{\"concealed\":[\"1m\"]}");

    store.confirmForRound(List.of(id), 228, 3, MAPPER.readTree("{\"concealed\":[\"9p\"]}"));

    assertThat(dir.resolve("228-3")).isDirectory();
    assertThat(filesUnder(dir.resolve(id.split("/")[0]))).isEmpty();
    JsonNode kept = sample(dir);
    assertThat(kept.path("answers").path("local").path("rawJson").asText()).contains("1m");
    assertThat(kept.path("confirmed").path("hand").path("concealed").get(0).asText())
        .isEqualTo("9p");
    assertThat(kept.path("confirmed").path("confirmedAt").asText()).isNotEmpty();
  }

  /**
   * Every photo from a retaken round lands beside each other, each with the same confirmed hand.
   */
  @Test
  void groupsEveryPhotoOfARoundTogether(@TempDir Path dir) throws IOException {
    RecognitionSampleStore store = storeIn(dir.toString());
    String failed = store.saveFailure(JPEG, "image/jpeg", "local", "no line of tiles found");
    byte[] secondPhoto = {5, 6, 7, 8};
    String succeeded =
        store.save(
            Base64.getEncoder().encodeToString(secondPhoto),
            "image/jpeg",
            "local",
            "{\"concealed\":[\"1m\"]}");
    JsonNode hand = MAPPER.readTree("{\"concealed\":[\"1m\"]}");

    store.confirmForRound(List.of(failed, succeeded), 228, 3, hand);

    Path round = dir.resolve("228-3");
    assertThat(namesEnding(round, ".json")).hasSize(2);
    assertThat(namesEnding(round, ".jpg")).hasSize(2);
  }

  /**
   * The id is resolved against the sample directory, which is the shape of a path traversal.
   * Anything that is not a day and a digest has to be dropped.
   */
  @Test
  void ignoresSampleIdsOutsideTheSampleDirectory(@TempDir Path dir) throws IOException {
    Path samples = Files.createDirectory(dir.resolve("samples"));
    RecognitionSampleStore store = storeIn(samples.toString());
    JsonNode hand = MAPPER.readTree("{}");

    store.confirmForRound(List.of("../escaped"), 1, 1, hand);
    store.confirmForRound(List.of("2026-08-09/../../escaped"), 1, 1, hand);
    store.confirmForRound(List.of("/etc/escaped"), 1, 1, hand);
    store.confirmForRound(List.of("2026-08-09/NOTHEX123456"), 1, 1, hand);
    store.confirmForRound(null, 1, 1, hand);

    assertThat(filesUnder(samples)).isEmpty();
  }
}
