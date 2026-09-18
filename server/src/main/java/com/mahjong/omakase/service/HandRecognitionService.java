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

  /**
   * What to tell the player about a photo the reader would not read.
   *
   * <p>Eight codes, four sentences, and the collapsing is the point. The reader distinguishes a row
   * it could not frame from one it framed and could not slice, from one whose cells came back as
   * tile backs — useful in a log, and all the same thing to hold a phone about: the tiles were not
   * laid out or framed in a way that could be read, so lay them in one row, keep everything else
   * out of shot, and take it again. Wording each code separately was the first attempt and it read
   * as a list of excuses, with two of them telling the player to fix something that is this side's
   * bug rather than theirs.
   *
   * <p>face-down-in-hand is the clearest of those: it fires when the region framed was a wall or a
   * spare row instead of the hand, which is a localisation failure and not a framing mistake. It is
   * grouped here rather than worded, and it should stop happening rather than get better copy.
   *
   * <p>The codes come from reader.py and serve.py. An unknown one falls back rather than showing a
   * bare identifier, so adding one on that side cannot put an English token in front of a player.
   */
  private static String advice(String code) {
    return switch (code) {
      case "undecodable" -> "这张图片打不开，请换一张或者重拍";
      case "no-tiles" -> "没看到手牌，请对准这一副牌重拍";
      case "no-row",
          "short-runs-only",
          "unreadable-row",
          "face-down-in-hand",
          "impossible-tiles",
          "too-many-tiles" -> "手牌不整齐，请把牌摆整齐重拍";
      case "too-uncertain" -> "手牌看不清，请对准这一副牌重拍";
      default -> "本地识别没读出手牌，请重拍或手动输入";
    };
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
      // The reader looked at the photo and declined it, and says why as a code. Worded here rather
      // than there: what the player needs to hear is which thing to change about the photo, and the
      // reader has no business holding Chinese product copy to say it in.
      log.warn("Local recognition declined the photo: {}", e.getMessage());
      String sampleId = sampleStore.saveFailure(imageBase64, mimeType, LOCAL, e.getMessage());
      return new Recognition(EMPTY_HAND_JSON, advice(e.getMessage()), sampleId);
    }
  }
}
