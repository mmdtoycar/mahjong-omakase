package com.mahjong.omakase.controller;

import com.mahjong.omakase.service.SessionEvents;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventsController {

  private final SessionEvents events;

  @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseBodyEmitter listen(HttpServletResponse response) {
    // Proxies must not buffer the stream.
    response.setHeader("X-Accel-Buffering", "no");
    response.setHeader("Cache-Control", "no-cache");
    return events.subscribe();
  }
}
