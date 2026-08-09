package com.mahjong.omakase.service;

import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Chooses which recogniser answers a photo, keeps the sample either way, and never leaves the user
 * stuck because the local one had a bad day.
 *
 * <p>The local reader is the default and Gemini is a button, which is the right way round: the
 * reader is free, answers in about half a second rather than eleven to twenty-four, cannot run out
 * of quota, and where it is unsure it says which tiles it is unsure of — something Gemini has no
 * way to express.
 *
 * <p><strong>Any local failure falls back to Gemini, and says so.</strong> The user gets their hand
 * either way; what they also get is a warning rather than silence, because a silent fallback would
 * mean weeks of use with no idea whether the local reader is working. The warning is the visible
 * half and {@link RecognitionSampleStore#saveFailure} is the durable half — the reason is written
 * next to the photo under the same digest as Gemini's answer, so a directory listing later reads
 * "the reader could not do this one, and here is what Gemini said instead".
 *
 * <p>That pairing is the point of wiring the local path up before it is good enough to trust
 * unattended. Ordinary use produces the dataset, concentrated on exactly the photos worth studying,
 * without anyone comparing anything by hand.
 */
@Slf4j
@Service
public class HandRecognitionService {

  public static final String LOCAL = "local";
  public static final String GEMINI = "gemini";

  /**
   * What a recognition produced, plus anything the user should be told about how.
   *
   * @param rawJson the recogniser's own JSON, passed to the browser untouched
   * @param warning null when all went to plan; otherwise why the answer came from the fallback
   */
  public record Recognition(String rawJson, String warning) {}

  private final LocalReaderService reader;
  private final TileRecognitionService gemini;
  private final RecognitionSampleStore sampleStore;

  public HandRecognitionService(
      LocalReaderService reader,
      TileRecognitionService gemini,
      RecognitionSampleStore sampleStore) {
    this.reader = reader;
    this.gemini = gemini;
    this.sampleStore = sampleStore;
  }

  /**
   * Recognises one photo, locally unless the client asked for Gemini or the local path failed.
   *
   * @throws IllegalStateException with a user-facing message when Gemini cannot answer either
   */
  public Recognition recognize(String imageBase64, String mimeType, String engine) {
    if (GEMINI.equals(engine) || !reader.isConfigured()) {
      return new Recognition(gemini.recognize(imageBase64, mimeType), null);
    }
    try {
      String json = reader.recognize(imageBase64, mimeType);
      // The Gemini path saves inside TileRecognitionService, once it has an answer to pair the
      // photo with; this is the same point in the local path.
      sampleStore.save(imageBase64, mimeType, LOCAL, json);
      return new Recognition(json, null);
    } catch (ReaderUnavailableException e) {
      return afterLocalFailure(imageBase64, mimeType, "本地识别服务连不上", e.getMessage());
    } catch (IllegalStateException e) {
      // The reader looked at the photo and declined it — usually nothing in the frame resembles
      // a row of tiles. Worth telling the user, because the fix next time is to reframe.
      return afterLocalFailure(imageBase64, mimeType, "本地识别没读出手牌", e.getMessage());
    }
  }

  private Recognition afterLocalFailure(
      String imageBase64, String mimeType, String summary, String detail) {
    log.warn("Local recognition failed ({}), falling back to Gemini: {}", summary, detail);
    sampleStore.saveFailure(imageBase64, mimeType, LOCAL, detail);
    String json = gemini.recognize(imageBase64, mimeType);
    return new Recognition(json, summary + "，已自动改用在线识别：" + detail);
  }
}
