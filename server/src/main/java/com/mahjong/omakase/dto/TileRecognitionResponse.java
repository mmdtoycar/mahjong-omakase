package com.mahjong.omakase.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Raw JSON text as returned by the model.
 *
 * <p>Tile-string parsing stays in the UI (it already owns the {@code Tile} type and the
 * Chinese/ASCII notation handling), so the server passes the model output through untouched.
 */
@Data
@AllArgsConstructor
public class TileRecognitionResponse {
  private String rawJson;

  /**
   * Why the answer did not come from the recogniser that was asked, or null when it did.
   *
   * <p>Separate from an error because it is not one: the hand in {@code rawJson} is usable. It
   * exists so a local reader quietly failing for weeks is impossible — the fallback is silent
   * otherwise, and the whole reason the local path is deployed early is to find out where it fails.
   */
  private String warning;

  /**
   * Identifies the kept sample, so the browser can hand back the hand the user confirmed.
   *
   * <p>Null when samples are not being kept, which is the normal state of a local run.
   */
  private String sampleId;
}
