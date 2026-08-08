package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.TileRecognitionRequest;
import com.mahjong.omakase.dto.TileRecognitionResponse;
import com.mahjong.omakase.service.TileRecognitionService;
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

  private final TileRecognitionService service;

  public TileRecognitionController(TileRecognitionService service) {
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<Object> recognize(@Valid @RequestBody TileRecognitionRequest request) {
    try {
      String rawJson = service.recognize(request.getImageBase64(), request.getMimeType());
      return ResponseEntity.ok(new TileRecognitionResponse(rawJson));
    } catch (IllegalStateException e) {
      log.warn("Photo recognition unavailable: {}", e.getMessage());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("message", e.getMessage()));
    }
  }
}
