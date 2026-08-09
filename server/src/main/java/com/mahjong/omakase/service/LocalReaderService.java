package com.mahjong.omakase.service;

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
 * <p>The distinction this class exists to draw is between the two ways it can fail, because they
 * deserve opposite responses:
 *
 * <ul>
 *   <li><strong>The reader is not there</strong> — container down, wrong URL, timeout. Nothing
 *       about the request or the photo is wrong, so making the user do something about it is
 *       unreasonable. {@link ReaderUnavailableException} says "fall back to Gemini and carry on".
 *   <li><strong>The reader read the photo and could not find a hand in it.</strong> That is
 *       information, and it belongs in front of the user: reframe and try again, or use the online
 *       button. An {@link IllegalStateException} carries it, which is what the controller already
 *       maps to a 503 with a message.
 * </ul>
 *
 * <p>Falling back automatically only in the first case is deliberate. Doing it in both would spend
 * Gemini quota silently on every photo the local reader cannot handle, and — worse for this project
 * — would hide exactly the cases worth collecting.
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

  private final RestClient restClient;
  private final String url;

  public LocalReaderService(RestClient localReaderRestClient, @Value("${reader.url:}") String url) {
    this.restClient = localReaderRestClient;
    this.url = url == null ? "" : url.trim();
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
  public String recognize(String imageBase64, String mimeType) {
    if (!isConfigured()) {
      throw new ReaderUnavailableException("reader.url is not set");
    }
    long startedAtNanos = System.nanoTime();
    try {
      String body =
          restClient
              .post()
              .uri(url + "/recognize")
              .contentType(MediaType.APPLICATION_JSON)
              .body(
                  Map.of("imageBase64", imageBase64, "mimeType", mimeType == null ? "" : mimeType))
              .retrieve()
              .body(String.class);
      if (body == null || body.isBlank()) {
        throw new ReaderUnavailableException("the reader returned an empty body");
      }
      log.info(
          "Local recognition succeeded in {} ms ({} chars returned)",
          (System.nanoTime() - startedAtNanos) / 1_000_000,
          body.length());
      return body;
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
      // 4xx: the reader looked and said no. 422 is "nothing in this photo looks like a hand", which
      // is the one worth passing on verbatim.
      String detail = message(e.getResponseBodyAsString());
      log.info("Local reader declined the photo ({}): {}", status, detail);
      throw new IllegalStateException(detail.isBlank() ? "本地识别没有在照片里找到手牌，请重拍或改用在线识别" : detail, e);
    }
  }

  /**
   * Pulls {@code message} out of the reader's error body, which is always {@code {"message": …}}.
   */
  private static String message(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return "";
    }
    int key = responseBody.indexOf("\"message\"");
    if (key < 0) {
      return "";
    }
    int open = responseBody.indexOf('"', responseBody.indexOf(':', key) + 1);
    int close = open < 0 ? -1 : responseBody.indexOf('"', open + 1);
    return open < 0 || close < 0 ? "" : responseBody.substring(open + 1, close);
  }
}
