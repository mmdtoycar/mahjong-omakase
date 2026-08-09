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
import org.junit.jupiter.api.Test;

class HandRecognitionServiceTest {

  private final LocalReaderService reader = mock(LocalReaderService.class);
  private final TileRecognitionService gemini = mock(TileRecognitionService.class);
  private final RecognitionSampleStore samples = mock(RecognitionSampleStore.class);
  private final HandRecognitionService service =
      new HandRecognitionService(reader, gemini, samples);

  private static final String LOCAL_ANSWER = "{\"concealed\":[\"1m\"]}";
  private static final String GEMINI_ANSWER = "{\"concealed\":[\"9p\"]}";

  @Test
  void readsLocallyByDefaultAndKeepsTheSample() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString())).thenReturn(LOCAL_ANSWER);

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).isEqualTo(LOCAL_ANSWER);
    assertThat(recognition.warning()).isNull();
    verify(samples).save("BASE64", "image/jpeg", HandRecognitionService.LOCAL, LOCAL_ANSWER);
    verify(gemini, never()).recognize(anyString(), anyString());
  }

  /** The reader being down is nobody's fault and nothing the user can act on. */
  @Test
  void fallsBackToGeminiWhenTheReaderCannotBeReached() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new ReaderUnavailableException("connection refused"));
    when(gemini.recognize(anyString(), anyString())).thenReturn(GEMINI_ANSWER);

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).isEqualTo(GEMINI_ANSWER);
    assertThat(recognition.warning()).contains("连不上").contains("connection refused");
  }

  /**
   * The reader looked at the photo and declined it. That also falls back — the user should never be
   * left without a hand because the local model had a bad day — but it must not do so silently, or
   * weeks pass with nobody knowing whether the local path works.
   */
  @Test
  void fallsBackWithAWarningWhenTheReaderDeclinedThePhoto() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new IllegalStateException("no line of tiles found"));
    when(gemini.recognize(anyString(), anyString())).thenReturn(GEMINI_ANSWER);

    Recognition recognition = service.recognize("BASE64", "image/jpeg", "local");

    assertThat(recognition.rawJson()).isEqualTo(GEMINI_ANSWER);
    assertThat(recognition.warning()).contains("没读出手牌").contains("no line of tiles found");
  }

  /**
   * A failure is a sample too, and the more interesting one: it lands under the same digest as
   * Gemini's answer, so the pair says "the reader could not do this, and here is what Gemini said".
   */
  @Test
  void recordsWhyTheLocalReadFailedNextToThePhoto() {
    when(reader.isConfigured()).thenReturn(true);
    when(reader.recognize(anyString(), anyString()))
        .thenThrow(new IllegalStateException("no line of tiles found"));
    when(gemini.recognize(anyString(), anyString())).thenReturn(GEMINI_ANSWER);

    service.recognize("BASE64", "image/jpeg", "local");

    verify(samples)
        .saveFailure(
            "BASE64", "image/jpeg", HandRecognitionService.LOCAL, "no line of tiles found");
    verify(samples, never()).save(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void asksGeminiWhenTheClientAsksForIt() {
    when(gemini.recognize(anyString(), anyString())).thenReturn(GEMINI_ANSWER);

    assertThat(service.recognize("BASE64", "image/jpeg", "gemini").rawJson())
        .isEqualTo(GEMINI_ANSWER);
    verify(reader, never()).recognize(anyString(), anyString());
    // TileRecognitionService keeps its own sample once it has an answer, so this path must not add
    // a
    // second one under the wrong name.
    verify(samples, never())
        .save(anyString(), anyString(), eq(HandRecognitionService.LOCAL), any());
  }

  @Test
  void usesGeminiWhenNoReaderIsConfigured() {
    when(reader.isConfigured()).thenReturn(false);
    when(gemini.recognize(anyString(), anyString())).thenReturn(GEMINI_ANSWER);

    assertThat(service.recognize("BASE64", "image/jpeg", "local").rawJson())
        .isEqualTo(GEMINI_ANSWER);
    verify(reader, never()).recognize(anyString(), anyString());
  }
}
