package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.service.HandRecognitionService.Recognition;
import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HandRecognitionServiceTest {

  private final LocalReaderService reader = mock(LocalReaderService.class);
  private final RecognitionSampleStore samples = mock(RecognitionSampleStore.class);
  private final HandRecognitionService service = new HandRecognitionService(reader, samples);

  private static final String LOCAL_ANSWER = "{\"concealed\":[\"1m\"]}";

  @Test
  void readsLocallyAndKeepsTheSample() {
    when(reader.recognize(anyString(), anyString(), any())).thenReturn(LOCAL_ANSWER);
    when(samples.save(anyString(), anyString(), anyString(), anyString()))
        .thenReturn("2026-08-09/aabbccdd1122");

    Recognition recognition = service.recognize("BASE64", "image/jpeg", 42L);

    assertThat(recognition.rawJson()).isEqualTo(LOCAL_ANSWER);
    assertThat(recognition.warning()).isNull();
    // Handed to the browser so the hand the user settles on can be filed against this photo.
    assertThat(recognition.sampleId()).isEqualTo("2026-08-09/aabbccdd1122");
    verify(samples).save("BASE64", "image/jpeg", HandRecognitionService.LOCAL, LOCAL_ANSWER);
  }

  /** The reader being unreachable is nobody's fault and nothing the user can act on. */
  @Test
  void returnsAnEmptyHandWhenTheReaderCannotBeReached() {
    when(reader.recognize(anyString(), anyString(), any()))
        .thenThrow(new ReaderUnavailableException("connection refused"));
    when(samples.saveFailure(anyString(), anyString(), anyString(), anyString()))
        .thenReturn("2026-08-09/aabbccdd1122");

    Recognition recognition = service.recognize("BASE64", "image/jpeg", null);

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    assertThat(recognition.warning()).contains("连不上");
    // The transport error carries the reader's URL. It belongs in the log and in the sample, not in
    // a browser: it tells the user nothing they can act on.
    assertThat(recognition.warning()).doesNotContain("connection refused");
    assertThat(recognition.sampleId()).isEqualTo("2026-08-09/aabbccdd1122");
    verify(samples)
        .saveFailure("BASE64", "image/jpeg", HandRecognitionService.LOCAL, "connection refused");
  }

  /**
   * The reader looked at the photo and declined it. That detail is worth showing, because the fix
   * next time is to reframe.
   */
  @Test
  void returnsAnEmptyHandWithAWarningWhenTheReaderDeclinedThePhoto() {
    when(reader.recognize(anyString(), anyString(), any()))
        .thenThrow(new IllegalStateException("short-runs-only"));

    Recognition recognition = service.recognize("BASE64", "image/jpeg", null);

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    // Worded for the player, and the code itself never shown: it is an identifier for a log, and
    // the
    // warning has to say what to do differently instead.
    assertThat(recognition.warning()).contains("摆整齐").doesNotContain("short-runs-only");
  }

  /**
   * Every way of failing to frame the row is the same thing to hold a phone about, so they share
   * one sentence. Asserted because the grouping is a decision and not an accident — one of these
   * codes fires when this side framed a wall instead of the hand, which is a bug here rather than
   * something the player did, and wording it separately told them to fix their own photo for it.
   */
  @Test
  void givesOneAnswerForEveryWayOfFailingToFrameTheRow() {
    Set<String> worded = new HashSet<>();
    for (String code :
        List.of(
            "no-row",
            "short-runs-only",
            "unreadable-row",
            "face-down-in-hand",
            "impossible-tiles",
            "too-many-tiles")) {
      // doThrow, not when(...).thenThrow: re-stubbing this way calls the mock, which throws the
      // exception left over from the previous turn of the loop before the new stub is in place.
      doThrow(new IllegalStateException(code))
          .when(reader)
          .recognize(anyString(), anyString(), any());
      worded.add(service.recognize("BASE64", "image/jpeg", null).warning());
    }
    assertThat(worded).hasSize(1);
  }

  /** A code this side has never heard of still has to read as Chinese, not as an identifier. */
  @Test
  void wordsAnUnknownRefusalCodeRatherThanShowingIt() {
    when(reader.recognize(anyString(), anyString(), any()))
        .thenThrow(new IllegalStateException("something-added-later"));

    Recognition recognition = service.recognize("BASE64", "image/jpeg", null);

    assertThat(recognition.warning()).contains("没读出手牌").doesNotContain("something-added-later");
  }

  /**
   * A failure is a sample too, and on this project the more interesting one: the photos the local
   * reader cannot read are precisely the ones worth studying come retraining time.
   */
  @Test
  void recordsWhyTheLocalReadFailedEvenThoughNothingIsFilledIn() {
    when(reader.recognize(anyString(), anyString(), any()))
        .thenThrow(new IllegalStateException("no line of tiles found"));

    service.recognize("BASE64", "image/jpeg", null);

    verify(samples)
        .saveFailure(
            "BASE64", "image/jpeg", HandRecognitionService.LOCAL, "no line of tiles found");
    verify(samples, never()).save(anyString(), anyString(), anyString(), anyString());
  }

  /** No reader.url configured throws the same exception a reachable-but-down reader would. */
  @Test
  void returnsAnEmptyHandWhenNoReaderIsConfigured() {
    when(reader.recognize(anyString(), anyString(), any()))
        .thenThrow(new ReaderUnavailableException("reader.url is not set"));

    Recognition recognition = service.recognize("BASE64", "image/jpeg", null);

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    assertThat(recognition.warning()).contains("连不上");
  }
}
