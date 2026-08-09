package com.mahjong.omakase.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/** The hand the user confirmed for a photo, which is the sample's only human-checked label. */
@Data
public class RecognitionConfirmRequest {

  /**
   * The id handed out by the recognition that produced this hand.
   *
   * <p>Constrained here as well as in the store: it is resolved against the sample directory, and
   * the pattern is what stops a path from arriving in place of an id. Rejecting it as a 400 also
   * tells the caller they got it wrong, which silently dropping it would not.
   */
  @NotNull
  @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}/[0-9a-f]{12}")
  private String sampleId;

  /** The corrected hand, stored as it arrives so the shape stays the UI's business. */
  @NotNull private JsonNode hand;
}
