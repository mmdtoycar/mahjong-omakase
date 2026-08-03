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
}
