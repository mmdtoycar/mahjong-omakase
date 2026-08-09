package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.RecognitionConfirmRequest;
import com.mahjong.omakase.dto.TileRecognitionRequest;
import com.mahjong.omakase.dto.TileRecognitionResponse;
import com.mahjong.omakase.service.HandRecognitionService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Server-side proxy for hand photo recognition — keeps the Gemini key off the client. */
@Slf4j
@RestController
@RequestMapping("/api/recognize")
public class TileRecognitionController {

  private final HandRecognitionService service;

  public TileRecognitionController(HandRecognitionService service) {
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<Object> recognize(@Valid @RequestBody TileRecognitionRequest request) {
    try {
      HandRecognitionService.Recognition recognition =
          service.recognize(request.getImageBase64(), request.getMimeType(), request.getEngine());
      return ResponseEntity.ok(
          new TileRecognitionResponse(
              recognition.rawJson(), recognition.warning(), recognition.sampleId()));
    } catch (IllegalStateException e) {
      log.warn("Photo recognition unavailable: {}", e.getMessage());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("message", e.getMessage()));
    }
  }

  /**
   * Files the hand the user settled on for a photo that was just recognised.
   *
   * <p>Answers 204 whether or not anything was written. The caller is a fire-and-forget call made
   * while the user is closing a dialog: there is nothing it could usefully do about a failure, and
   * samples being switched off is not one.
   */
  @PostMapping("/confirm")
  public ResponseEntity<Void> confirm(@Valid @RequestBody RecognitionConfirmRequest request) {
    service.confirm(request.getSampleId(), request.getHand());
    return ResponseEntity.noContent().build();
  }
}
