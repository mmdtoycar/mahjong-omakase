package com.mahjong.omakase.service;

import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Chooses which recogniser answers a photo, and keeps the sample either way.
 *
 * <p>The local reader is the only automatic path — Gemini is not called on a local failure. It used
 * to be: this project's whole point right now is bringing the local model up, and every local miss
 * that got quietly patched over by Gemini was tens of seconds of latency (Gemini's own retry chain
 * can run past a minute) for no benefit to that goal, while also hiding exactly the failures worth
 * looking at. A local miss now returns an empty hand plus a warning, and the user fills it in by
 * hand — which they can also just do in the calculator.
 *
 * <p>Gemini is not deleted: {@link #recognize} still answers {@code engine=gemini} the same as
 * before. There is simply no button that sends it any more.
 *
 * <p>{@link RecognitionSampleStore#saveFailure} still runs on a local miss — that failure is itself
 * useful signal for the retraining this is all in service of.
 */
@Slf4j
@Service
public class HandRecognitionService {

  public static final String LOCAL = "local";
  public static final String GEMINI = "gemini";

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
   * Recognises one photo, locally unless the client asked for Gemini or no reader is configured.
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
