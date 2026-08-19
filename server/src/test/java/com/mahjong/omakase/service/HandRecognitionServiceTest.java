package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.service.HandRecognitionService.Recognition;
import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
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
        .thenThrow(new IllegalStateException("no line of tiles found"));

    Recognition recognition = service.recognize("BASE64", "image/jpeg", null);

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    assertThat(recognition.warning()).contains("没读出手牌").contains("no line of tiles found");
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
