package com.mahjong.omakase.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends a hand photo to Gemini and returns the model's raw JSON answer.
 *
 * <p>The API key never leaves the server: it is read from {@code GEMINI_API_KEYS} and attached as a
 * request header here. Several comma-separated keys may be supplied; on a quota/rate-limit response
 * the next key is tried, and the cursor advances so the next request starts from a fresh key.
 *
 * <p>The prompt and the 34-tile calibration legend also live here rather than in the browser, so a
 * caller cannot repurpose this endpoint as a general-purpose Gemini relay.
 */
@Slf4j
@Service
public class TileRecognitionService {

  private static final String ENDPOINT =
      "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

  private static final String CALIBRATION_RESOURCE = "calibration/system_mahjong_calibration.jpg";

  /** Describes IMAGE 1 (the calibration legend) and forbids answering from it. */
  private static final String LEGEND_PROMPT =
      """
      You will be given TWO images, in order.

      IMAGE 1 is a master reference calibration photo of ALL 34 tile faces of this
      physical mahjong set:
        Row 1: 1m to 9m (1万 to 9万)
        Row 2: 1p to 9p (1饼/筒 to 9饼/筒)
        Row 3: 1s to 9s (1条/索 to 9条/索)
        Row 4: 1z to 7z (东,南,西,北,中,发,白)

      Use IMAGE 1 ONLY as a visual legend for what each face looks like in this set, in
      any orientation (0° upright, 90° sideways, 180° inverted).
      NEVER copy tiles out of IMAGE 1 into your answer. IMAGE 1 is not a hand.
      """;

  /** Describes IMAGE 2 (the hand) and the required output. Domain rules are set-specific. */
  private static final String HAND_PROMPT =
      """
      IMAGE 2 is the hand to recognize. Report ONLY tiles visible in IMAGE 2.

      ### Strict Spatial Demarcation (左右空间划分与全数量把关):
      1. **LEFT SIDE: Standing Concealed Hand (暗牌/立牌)**:
         - ALL upright standing tiles on the LEFT side belong strictly to "concealed".
         - Count EVERY standing tile block one by one.
         - List EVERY tile individually in array "concealed".
         - DO NOT skip any standing tile on the left! DO NOT use range hyphens like "1-9m"!

      2. **RIGHT SIDE: Exposed Melds & Kangs (副露/吃碰杠)**:
         - ALL flat/exposed tiles or sets set aside on the RIGHT side belong strictly to "melds".
         - Note: Exposed melds may be stacked in multiple vertical rows on the right.
         - Chi/Shun (吃/顺): 3 consecutive -> { "type": "shun", "tiles": ["1m","2m","3m"], "isOpen": true }
         - Pon/Ke (碰/刻): 3 identical -> { "type": "ke", "tiles": ["5z","5z","5z"], "isOpen": true }
         - Ming-Gang (明杠): 4 face-up identical -> { "type": "gang", "tiles": ["6p","6p","6p","6p"], "isOpen": true }
         - An-Gang (暗杠): 4 tiles (2 face-UP, 2 face-DOWN backs) -> { "type": "gang", "tiles": ["8s","8s","8s","8s"], "isOpen": false }
         - DO NOT mix right-side exposed melds into the left-side concealed hand!

      ### Critical Tile Pattern Audit Rules (防错识别自查规则):
      1. **5s (五条) vs 4s (四条)**:
         - **5s (五条)**: Has 4 corner bamboo sticks PLUS ONE DISTINCT RED BAMBOO STICK IN THE EXACT CENTER!
         - **4s (四条)**: Has ONLY 4 corner bamboo sticks with EMPTY center space (NO red center stick).
         - **MUST CHECK**: If a bamboo tile has a RED vertical stick in the middle surrounded by 4 green sticks, IT IS ALWAYS 5s ("5s"), NEVER 4s!
      2. **Anti-Merge Seams**:
         - **2p vs 4p**: Two adjacent 2-dot tiles = TWO 2p TILES ("2p", "2p"), NEVER one 4p tile!
         - **2s vs 4s**: Two adjacent 2-bamboo tiles = TWO 2s TILES ("2s", "2s"), NEVER one 4s tile!
      - Inspect vertical seams between tiles to count individual rectangular blocks accurately.

      ### Strict English Output Requirement (全英文输出，提升生成速度与稳定性):
      - Write ALL JSON keys and values (especially the 'notes' string) STRICTLY in ENGLISH ASCII characters only.
      - DO NOT use Chinese characters anywhere in the JSON output!

      ### Return Format:
      Return ONLY valid JSON:
      {
        "notes": "Left hand 13 standing tiles, Right 1 meld row An-Gang of 8s",
        "concealed": ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5z"],
        "melds": [
          { "type": "gang", "tiles": ["8s", "8s", "8s", "8s"], "isOpen": false }
        ],
        "winningTile": "5z",
        "isSelfDraw": false
      }
      """;

  private final ObjectMapper objectMapper;
  private final RestClient restClient;
  private final List<String> apiKeys;
  private final String model;
  private final String legendBase64;
  private final AtomicInteger keyCursor = new AtomicInteger();

  public TileRecognitionService(
      ObjectMapper objectMapper,
      RestClient geminiRestClient,
      @Value("${gemini.api-keys:}") String rawApiKeys,
      @Value("${gemini.model:gemini-3.6-flash}") String model) {
    this.objectMapper = objectMapper;
    this.model = model;
    this.apiKeys =
        Arrays.stream(rawApiKeys.split(",")).map(String::trim).filter(k -> !k.isEmpty()).toList();
    this.restClient = geminiRestClient;
    this.legendBase64 = loadCalibrationLegend();

    if (apiKeys.isEmpty()) {
      log.warn("GEMINI_API_KEYS is not set — photo recognition will return 503 until configured");
    } else {
      log.info("Photo recognition ready: {} Gemini key(s), model {}", apiKeys.size(), model);
    }
  }

  /**
   * Returns the model's raw JSON text for one hand photo.
   *
   * @throws IllegalStateException if no key is configured or every key failed
   */
  public String recognize(String imageBase64, String mimeType) {
    if (apiKeys.isEmpty()) {
      throw new IllegalStateException("服务端未配置 Gemini API Key，请联系管理员");
    }

    String url = String.format(ENDPOINT, model);
    Map<String, Object> payload = buildPayload(imageBase64, mimeType);
    int start = keyCursor.get();
    String lastError = null;

    for (int attempt = 0; attempt < apiKeys.size(); attempt++) {
      int index = (start + attempt) % apiKeys.size();
      try {
        String body =
            restClient
                .post()
                .uri(url)
                .header("x-goog-api-key", apiKeys.get(index))
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);
        // Success: next request starts at the key after this one.
        keyCursor.set((index + 1) % apiKeys.size());
        return extractText(body);
      } catch (RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String detail = errorMessage(e.getResponseBodyAsString());
        if (!isRetryable(status, detail)) {
          log.warn("Gemini rejected the request ({}): {}", status, detail);
          throw new IllegalStateException(detail.isEmpty() ? "识别服务返回错误" : detail, e);
        }
        log.warn("Gemini key #{} exhausted ({}): {}", index, status, detail);
        lastError = detail;
      } catch (ResourceAccessException e) {
        log.warn("Gemini request failed on key #{}: {}", index, e.getMessage());
        lastError = "识别服务连接超时，请重试";
      }
      // Skip past the key that just failed so the next request does not retry it first.
      keyCursor.set((index + 1) % apiKeys.size());
    }

    throw new IllegalStateException(lastError == null ? "所有 Gemini API Key 均不可用" : lastError);
  }

  private Map<String, Object> buildPayload(String imageBase64, String mimeType) {
    List<Map<String, Object>> parts = new ArrayList<>();
    if (legendBase64 != null) {
      parts.add(Map.of("text", LEGEND_PROMPT));
      parts.add(inlineImage("image/jpeg", legendBase64));
    }
    parts.add(Map.of("text", HAND_PROMPT));
    // mimeType is optional on the wire; Map.of would NPE on a null value.
    parts.add(
        inlineImage(mimeType == null || mimeType.isBlank() ? "image/jpeg" : mimeType, imageBase64));

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("contents", List.of(Map.of("role", "user", "parts", parts)));
    payload.put("generationConfig", Map.of("response_mime_type", "application/json"));
    return payload;
  }

  private Map<String, Object> inlineImage(String mimeType, String base64) {
    return Map.of("inline_data", Map.of("mime_type", mimeType, "data", base64));
  }

  /** Pulls {@code candidates[0].content.parts[0].text} out of a Gemini response. */
  private String extractText(String responseBody) {
    try {
      JsonNode text =
          objectMapper
              .readTree(responseBody == null ? "" : responseBody)
              .path("candidates")
              .path(0)
              .path("content")
              .path("parts")
              .path(0)
              .path("text");
      if (text.isMissingNode() || text.asText().isBlank()) {
        throw new IllegalStateException("模型未返回有效内容，请重试");
      }
      return text.asText();
    } catch (IOException e) {
      throw new IllegalStateException("识别服务返回了无法解析的内容", e);
    }
  }

  private String errorMessage(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return "";
    }
    try {
      return objectMapper.readTree(responseBody).path("error").path("message").asText("");
    } catch (IOException e) {
      return "";
    }
  }

  /** Quota, rate limit and transient upstream failures are worth trying another key. */
  private boolean isRetryable(int status, String detail) {
    if (status == 429 || status == 503 || status == 500) {
      return true;
    }
    String lower = detail.toLowerCase(Locale.ROOT);
    return lower.contains("quota") || lower.contains("resource has been exhausted");
  }

  private String loadCalibrationLegend() {
    ClassPathResource resource = new ClassPathResource(CALIBRATION_RESOURCE);
    try (InputStream in = resource.getInputStream()) {
      return Base64.getEncoder().encodeToString(in.readAllBytes());
    } catch (IOException e) {
      log.warn(
          "Calibration legend {} unavailable; recognizing without it", CALIBRATION_RESOURCE, e);
      return null;
    }
  }
}
