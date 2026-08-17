package com.mahjong.omakase.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Calls the local tile reader — the Python sidecar in {@code ml/serve.py} — and returns its JSON.
 *
 * <p>The reader answers in the same shape Gemini does, so the response travels on to the browser
 * untouched, exactly as the Gemini text does.
 *
 * <p>The distinction this class exists to draw is between the two ways it can fail. Both fall back
 * to Gemini — {@link HandRecognitionService} sees to that, so the user gets their hand either way —
 * but they are not the same thing to tell them:
 *
 * <ul>
 *   <li><strong>The reader is not there</strong> — container down, wrong URL, timeout. Nothing
 *       about the request or the photo is wrong, and the message carries the reader's URL and a
 *       transport error, which is internal topology and nothing the user can act on. {@link
 *       ReaderUnavailableException} is what keeps it in the log and out of the browser.
 *   <li><strong>The reader read the photo and could not find a hand in it.</strong> That the user
 *       can act on: reframe and try again. An {@link IllegalStateException} carries the reader's
 *       own words so they can be shown with the fallback warning.
 * </ul>
 */
@Slf4j
@Service
public class LocalReaderService {

  /** Thrown when the reader could not be reached at all, as opposed to declining a photo. */
  public static class ReaderUnavailableException extends RuntimeException {
    public ReaderUnavailableException(String message) {
      super(message);
    }

    public ReaderUnavailableException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  private final ObjectMapper objectMapper;
  private final RestClient restClient;
  private final String url;

  public LocalReaderService(
      ObjectMapper objectMapper,
      RestClient localReaderRestClient,
      @Value("${reader.url:}") String url) {
    this.objectMapper = objectMapper;
    this.restClient = localReaderRestClient;
    // Trailing slash stripped, because the endpoint below appends one. A reader.url ending in "/"
    // would otherwise produce ".../recognize" with a double slash, which the reader answers 404 —
    // indistinguishable from the container being down, and so a silent fallback to Gemini forever.
    this.url = url == null ? "" : url.trim().replaceAll("/+$", "");
    if (this.url.isEmpty()) {
      log.info(
          "Local tile reader is not configured (reader.url is unset); recognition uses Gemini");
    } else {
      log.info("Local tile reader at {}", this.url);
    }
  }

  public boolean isConfigured() {
    return !url.isEmpty();
  }

  /**
   * Returns the reader's JSON for one photo.
   *
   * @throws ReaderUnavailableException if the reader could not be reached
   * @throws IllegalStateException if the reader answered but declined the photo
   */
  public String recognize(String imageBase64, String mimeType, Long sessionId) {
    if (!isConfigured()) {
      throw new ReaderUnavailableException("reader.url is not set");
    }
    long startedAtNanos = System.nanoTime();
    Map<String, Object> body = new HashMap<>();
    body.put("imageBase64", imageBase64);
    body.put("mimeType", mimeType == null ? "" : mimeType);
    // Purely for the reader's own log — it has no other way to say which session a request was
    // for, since a round does not exist yet at recognition time to give it anything more precise.
    if (sessionId != null) {
      body.put("sessionId", sessionId);
    }
    try {
      String responseBody =
          restClient
              .post()
              .uri(url + "/recognize")
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(String.class);
      if (responseBody == null || responseBody.isBlank()) {
        throw new ReaderUnavailableException("the reader returned an empty body");
      }
      log.info(
          "Local recognition succeeded in {} ms ({} chars returned)",
          (System.nanoTime() - startedAtNanos) / 1_000_000,
          responseBody.length());
      return responseBody;
    } catch (ResourceAccessException e) {
      // Connect refused, DNS, or the read timing out. All infrastructure, none of it the user's
      // problem, so this is the case that falls through to Gemini.
      throw new ReaderUnavailableException(
          "could not reach the reader at " + url + ": " + e.getMessage(), e);
    } catch (RestClientResponseException e) {
      int status = e.getStatusCode().value();
      if (status >= 500) {
        throw new ReaderUnavailableException("the reader answered " + status, e);
      }
      String detail = message(e.getResponseBodyAsString());
      // Only 415 and 422 mean the reader looked at the photo and declined it: it could not decode
      // the
      // format, or nothing in the frame resembled a hand. Every other 4xx is this side's fault — a
      // wrong path, a body it would not parse — and reporting those as a photo problem hides a
      // wiring
      // bug behind "没读出手牌" while showing the user something like "expected a JSON body".
      if (status != 415 && status != 422) {
        throw new ReaderUnavailableException(
            "the reader answered " + status + " for a request it should have accepted: " + detail,
            e);
      }
      log.info("Local reader declined the photo ({}): {}", status, detail);
      throw new IllegalStateException(detail.isBlank() ? "本地识别没有在照片里找到手牌，请重拍或改用在线识别" : detail, e);
    }
  }

  /**
   * Pulls {@code message} out of the reader's error body, which is always {@code {"message": …}}.
   *
   * <p>Parsed rather than scanned for quotes. Hand-rolled index arithmetic stopped at the first
   * quote that looked closing, so a reason containing an escaped one came back truncated and a
   * unicode escape came back raw. {@link TileRecognitionService} already reads Gemini's error
   * bodies this way.
   */
  private String message(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return "";
    }
    try {
      JsonNode message = objectMapper.readTree(responseBody).path("message");
      return message.isTextual() ? message.asText() : "";
    } catch (IOException e) {
      return "";
    }
  }
}
