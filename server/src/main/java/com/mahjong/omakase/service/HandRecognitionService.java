package com.mahjong.omakase.service;

import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Chooses which recogniser answers a photo, and keeps the sample either way.
 *
 * <p>Local only — Gemini ({@link TileRecognitionService}) is retired and unused legacy code now. A
 * local miss returns an empty hand plus a warning, and the user fills it in by hand.
 *
 * <p>{@link RecognitionSampleStore#saveFailure} still runs on a local miss — that failure is itself
 * useful signal for the retraining this is all in service of.
 */
@Slf4j
@Service
public class HandRecognitionService {

  public static final String LOCAL = "local";

  /** An empty, well-formed hand — safe for the browser to auto-apply as "nothing found". */
  private static final String EMPTY_HAND_JSON =
      "{\"concealed\":[],\"melds\":[],\"winningTile\":null,\"isSelfDraw\":false}";

  /**
   * What a recognition produced, plus anything the user should be told about how.
   *
   * @param rawJson the recogniser's own JSON, passed to the browser untouched
   * @param warning null when all went to plan; otherwise why the hand came back empty
   * @param sampleId what the browser hands back with the confirmed hand, or null when samples are
   *     not being kept
   */
  public record Recognition(String rawJson, String warning, String sampleId) {}

  private final LocalReaderService reader;
  private final RecognitionSampleStore sampleStore;

  public HandRecognitionService(LocalReaderService reader, RecognitionSampleStore sampleStore) {
    this.reader = reader;
    this.sampleStore = sampleStore;
  }

  /** Recognises one photo, always locally. */
  public Recognition recognize(String imageBase64, String mimeType, Long sessionId) {
    try {
      String json = reader.recognize(imageBase64, mimeType, sessionId);
      String sampleId = sampleStore.save(imageBase64, mimeType, LOCAL, json);
      return new Recognition(json, null, sampleId);
    } catch (ReaderUnavailableException e) {
      // This message carries the reader's URL and the transport error. That belongs in the log and
      // in the sample, not in a browser: it is internal topology and it tells the user nothing they
      // can act on.
      log.warn("Local recognition unavailable: {}", e.getMessage());
      String sampleId = sampleStore.saveFailure(imageBase64, mimeType, LOCAL, e.getMessage());
      return new Recognition(EMPTY_HAND_JSON, "本地识别服务连不上，请直接输入", sampleId);
    } catch (IllegalStateException e) {
      // The reader looked at the photo and declined it — usually nothing in the frame resembles a
      // row of tiles. That detail *is* worth showing, because the fix next time is to reframe.
      log.warn("Local recognition declined the photo: {}", e.getMessage());
      String sampleId = sampleStore.saveFailure(imageBase64, mimeType, LOCAL, e.getMessage());
      return new Recognition(EMPTY_HAND_JSON, "本地识别没读出手牌：" + e.getMessage(), sampleId);
    }
  }
}
