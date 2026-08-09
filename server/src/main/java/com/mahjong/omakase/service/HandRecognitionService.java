package com.mahjong.omakase.service;

import com.fasterxml.jackson.databind.JsonNode;
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
 * half and {@link RecognitionSampleStore#saveFailure} is the durable half — the reason goes into
 * the same sample as Gemini's answer, so one file reads "the reader could not do this one, and here
 * is what Gemini said instead".
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
   * @param sampleId what the browser hands back with the confirmed hand, or null when samples are
   *     not being kept
   */
  public record Recognition(String rawJson, String warning, String sampleId) {}

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
      TileRecognitionService.Answer answer = gemini.recognize(imageBase64, mimeType);
      return new Recognition(answer.rawJson(), null, answer.sampleId());
    }
    try {
      String json = reader.recognize(imageBase64, mimeType);
      // The Gemini path saves inside TileRecognitionService, once it has an answer to pair the
      // photo with; this is the same point in the local path.
      String sampleId = sampleStore.save(imageBase64, mimeType, LOCAL, json);
      return new Recognition(json, null, sampleId);
    } catch (ReaderUnavailableException e) {
      // This message carries the reader's URL and the transport error. That belongs in the log and
      // in
      // the sample, not in a browser: it is internal topology and it tells the user nothing they
      // can
      // act on. The warning they get is the same either way — Gemini answered instead.
      return afterLocalFailure(imageBase64, mimeType, e.getMessage(), "本地识别服务连不上，已自动改用在线识别");
    } catch (IllegalStateException e) {
      // The reader looked at the photo and declined it — usually nothing in the frame resembles a
      // row
      // of tiles. That detail *is* worth showing, because the fix next time is to reframe.
      return afterLocalFailure(
          imageBase64, mimeType, e.getMessage(), "本地识别没读出手牌，已自动改用在线识别：" + e.getMessage());
    }
  }

  private Recognition afterLocalFailure(
      String imageBase64, String mimeType, String detail, String warning) {
    log.warn("Local recognition failed, falling back to Gemini: {}", detail);
    sampleStore.saveFailure(imageBase64, mimeType, LOCAL, detail);
    TileRecognitionService.Answer answer = gemini.recognize(imageBase64, mimeType);
    return new Recognition(answer.rawJson(), warning, answer.sampleId());
  }

  /**
   * Files the hand the user confirmed for a sample. Best-effort, like everything else about the
   * collection: a lost label must never surface as a failed recognition.
   */
  public void confirm(String sampleId, JsonNode hand) {
    sampleStore.saveConfirmed(sampleId, hand);
  }
}
