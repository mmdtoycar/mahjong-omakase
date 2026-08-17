package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.service.HandRecognitionService.Recognition;
import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import com.mahjong.omakase.service.TileRecognitionService.Answer;
import org.junit.jupiter.api.Test;

class HandRecognitionServiceTest {

  private final LocalReaderService reader = mock(LocalReaderService.class);
  private final TileRecognitionService gemini = mock(TileRecognitionService.class);
  private final RecognitionSampleStore samples = mock(RecognitionSampleStore.class);
  private final HandRecognitionService service =
      new HandRecognitionService(reader, gemini, samples);

  private static final String LOCAL_ANSWER = "{\"concealed\":[\"1m\"]}";
  private static final String GEMINI_ANSWER = "{\"concealed\":[\"9p\"]}";
  private static final Answer FROM_GEMINI = new Answer(GEMINI_ANSWER, "2026-08-09/aabbccdd1122");

  @Test
  void readsLocallyByDefaultAndKeepsTheSample() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString())).thenReturn(LOCAL_ANSWER);
    when(samples.save(anyString(), anyString(), anyString(), anyString()))
        .thenReturn("2026-08-09/aabbccdd1122");

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).isEqualTo(LOCAL_ANSWER);
    assertThat(recognition.warning()).isNull();
    // Handed to the browser so the hand the user settles on can be filed against this photo.
    assertThat(recognition.sampleId()).isEqualTo("2026-08-09/aabbccdd1122");
    verify(samples).save("BASE64", "image/jpeg", HandRecognitionService.LOCAL, LOCAL_ANSWER);
    verify(gemini, never()).recognize(anyString(), anyString());
  }

  /**
   * The reader being unreachable is nobody's fault and nothing the user can act on — it does not
   * fall back to Gemini any more, it just says so and hands back an empty hand to fill in by hand.
   */
  @Test
  void returnsAnEmptyHandWhenTheReaderCannotBeReached() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new ReaderUnavailableException("connection refused"));
    when(samples.saveFailure(anyString(), anyString(), anyString(), anyString()))
        .thenReturn("2026-08-09/aabbccdd1122");

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    assertThat(recognition.warning()).contains("连不上");
    // The transport error carries the reader's URL. It belongs in the log and in the sample, not in
    // a browser: it tells the user nothing they can act on.
    assertThat(recognition.warning()).doesNotContain("connection refused");
    assertThat(recognition.sampleId()).isEqualTo("2026-08-09/aabbccdd1122");
    verify(samples)
        .saveFailure("BASE64", "image/jpeg", HandRecognitionService.LOCAL, "connection refused");
    verify(gemini, never()).recognize(anyString(), anyString());
  }

  /**
   * The reader looked at the photo and declined it. That detail is worth showing, because the fix
   * next time is to reframe — but it no longer falls back to Gemini either; an empty hand goes back
   * and the user fills it in (here or in the calculator directly).
   */
  @Test
  void returnsAnEmptyHandWithAWarningWhenTheReaderDeclinedThePhoto() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new IllegalStateException("no line of tiles found"));

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).contains("\"concealed\":[]");
    assertThat(recognition.warning()).contains("没读出手牌").contains("no line of tiles found");
    verify(gemini, never()).recognize(anyString(), anyString());
  }

  /**
   * A failure is a sample too, and on this project the more interesting one: the photos the local
   * reader cannot read are precisely the ones worth studying come retraining time.
   */
  @Test
  void recordsWhyTheLocalReadFailedEvenThoughNothingIsFilledIn() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new IllegalStateException("no line of tiles found"));

    service.recognize("BASE64", "image/jpeg", "local");

    verify(samples)
        .saveFailure(
            "BASE64", "image/jpeg", HandRecognitionService.LOCAL, "no line of tiles found");
    verify(samples, never()).save(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void asksGeminiWhenTheClientAsksForIt() {
    when(gemini.recognize(anyString(), anyString())).thenReturn(FROM_GEMINI);

    assertThat(service.recognize("BASE64", "image/jpeg", "gemini").rawJson())
        .isEqualTo(GEMINI_ANSWER);
    verify(reader, never()).recognize(anyString(), anyString());
    // TileRecognitionService keeps its own sample once it has an answer, so this path must not add
    // a second one under the wrong name.
    verify(samples, never())
        .save(anyString(), anyString(), eq(HandRecognitionService.LOCAL), any());
  }

  @Test
  void usesGeminiWhenNoReaderIsConfigured() {
    when(reader.isConfigured()).thenReturn(false);
    when(gemini.recognize(anyString(), anyString())).thenReturn(FROM_GEMINI);

    assertThat(service.recognize("BASE64", "image/jpeg", "local").rawJson())
        .isEqualTo(GEMINI_ANSWER);
    verify(reader, never()).recognize(anyString(), anyString());
  }
}
