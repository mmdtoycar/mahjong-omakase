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

  /** Used when {@code GEMINI_MODEL} is unset — or set to an empty string, which Spring keeps. */
  private static final String DEFAULT_MODEL = "gemini-3.6-flash";

  /** Describes IMAGE 1 (the calibration legend) and forbids answering from it. */
  private static final String LEGEND_PROMPT =
      """
      You will be given TWO images, in order.

      IMAGE 1 is a master reference calibration photo of ALL 34 tile faces of this
      physical mahjong set, plus its tile backs. The tiles are upright, in FOUR ROWS
      of nine. Read each row from LEFT to RIGHT:
        Row 1: 1m to 9m (1万 to 9万)
        Row 2: 1p to 9p (1饼/筒 to 9饼/筒)
        Row 3: 1s to 9s (1条/索 to 9条/索)
        Row 4: 东,西,南,北,白,发,中 (1z,3z,2z,4z,7z,6z,5z), then 2 face-DOWN tile backs

      NOTE: Row 4 is NOT in the canonical 东南西北 order. It runs 东,西,南,北.
      The last two cells of Row 4 show what a face-DOWN tile looks like in this set,
      which is what the two covered tiles of an An-Gang (暗杠) look like.

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

      3. **ORDER OF "concealed" CARRIES THE WINNING TILE (和牌张)**:
         - The players place the winning tile at the END of the standing hand, deliberately, when they
           arrange it. The last standing tile in the photo is therefore the winning tile.
         - **List "concealed" in the order the tiles appear, left to right. NEVER sort it.** The app
           reads the last element as the winning tile and scores from it — the winning tile decides
           fu, whether the hand counts as self-drawn concealed, and the wait shape. Sorting the array
           moves the winning tile into the middle and the score comes out wrong with nothing to show
           that it did.
         - Also repeat that tile in "winningTile". Leave it in "concealed" as well.
         - If the standing tiles do not read as one row, or you cannot tell which end is the end, keep
           the order you see, set "winningTile" to null, and say so in "notes".

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

  /**
   * Wall-clock point after which no further key is tried.
   *
   * <p>Sized to block exactly one thing: stacked read timeouts. Three of those in a row would run
   * to minutes, long after Cloudflare's free plan gave up at 100s and answered 524, spending Gemini
   * quota on a response nobody will receive. Matching the 60s read timeout is enough to stop them,
   * because a timed-out attempt always lands above 60s — connecting and uploading the image both
   * happen before the read wait even starts.
   *
   * <p>Deliberately no safety margin below that, and deliberately not derived from the worst case
   * (100s minus a full 65s attempt would put this near 35s). Every second shaved off here only ever
   * cancels a retry that had time to succeed: a 503 arriving at 57s still leaves ~40s, plenty for a
   * call that normally takes twenty-something seconds. Refusing to retry makes failure certain,
   * whereas retrying and running into the 524 is no worse than that.
   *
   * <p>The common case never reaches this at all: a 429 comes back in well under a second, so all
   * three keys can be tried in a couple of seconds.
   *
   * <p><strong>This is a floor on wasted work, not a total deadline — a gateway timeout is still
   * reachable.</strong> A failure at 59s passes the check, and that retry may then use its full
   * 65s, putting the total near 125s; the caller sees Cloudflare's own 524 page instead of our JSON
   * error. Accepted rather than fixed. Capping each attempt at the remaining gateway time would
   * mean rebuilding the request factory per attempt, which replaces the one {@code
   * MockRestServiceServer} binds to and would point every test in {@code
   * TileRecognitionServiceTest} at the real Gemini API. The cheaper alternative — lowering this
   * constant until {@code budget + 65s <= 100s} — is exactly what the paragraph above rejects.
   */
  private static final long RETRY_BUDGET_MS = 60_000;

  private final ObjectMapper objectMapper;
  private final RestClient restClient;
  private final RecognitionSampleStore sampleStore;
  private final List<String> apiKeys;
  private final List<String> models;
  private final String legendBase64;
  private final AtomicInteger keyCursor = new AtomicInteger();

  public TileRecognitionService(
      ObjectMapper objectMapper,
      RestClient geminiRestClient,
      RecognitionSampleStore sampleStore,
      @Value("${gemini.api-keys:}") String rawApiKeys,
      @Value("${gemini.models:}") String rawModels) {
    this.objectMapper = objectMapper;
    this.sampleStore = sampleStore;
    this.apiKeys = splitList(rawApiKeys);
    List<String> configured = splitList(rawModels);
    this.models = configured.isEmpty() ? List.of(DEFAULT_MODEL) : configured;
    this.restClient = geminiRestClient;
    this.legendBase64 = loadCalibrationLegend();

    if (apiKeys.isEmpty()) {
      log.warn("GEMINI_API_KEYS is not set — photo recognition will fail until configured");
    } else {
      log.info("Photo recognition ready: {} Gemini key(s), models {}", apiKeys.size(), this.models);
    }
  }

  private static List<String> splitList(String raw) {
    if (raw == null) {
      return List.of();
    }
    return Arrays.stream(raw.split(",")).map(String::trim).filter(v -> !v.isEmpty()).toList();
  }

  /**
   * What the model answered, and the sample the answer was filed under.
   *
   * @param rawJson the model's own JSON text, passed on untouched
   * @param sampleId where the photo was kept, or null when samples are not being kept
   */
  public record Answer(String rawJson, String sampleId) {}

  /**
   * Returns the model's raw JSON text for one hand photo.
   *
   * <p>Failures advance whichever dimension can actually help, which is why there are two cursors
   * rather than one loop over keys. A 429 is our key's own allowance, so the next key is tried on
   * the same model. A 503 is the model being over capacity — global to that model, identical for
   * every key — so rotating keys there is three guaranteed failures in a row, as production showed;
   * the next model is tried on the same key instead.
   *
   * @throws IllegalStateException if no key is configured, or nothing left to fall back to
   */
  public Answer recognize(String imageBase64, String mimeType) {
    if (apiKeys.isEmpty()) {
      throw new IllegalStateException("服务端未配置 Gemini API Key，请联系管理员");
    }

    Map<String, Object> payload = buildPayload(imageBase64, mimeType);
    int firstKey = keyCursor.get();
    int keyOffset = 0;
    int modelIndex = 0;
    String lastError = null;
    // Log on the way in as well as on failure: Gemini takes tens of seconds for two images, and
    // without this a request in flight looks identical to one that never arrived.
    long startedAtNanos = System.nanoTime();
    log.info("Recognition request received: {} KB of {}", imageBase64.length() / 1024, mimeType);

    while (true) {
      long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000;
      if ((keyOffset > 0 || modelIndex > 0) && elapsedMs > RETRY_BUDGET_MS) {
        log.warn("Giving up after {} ms: not enough left before the gateway gives up", elapsedMs);
        break;
      }

      int keyIndex = (firstKey + keyOffset) % apiKeys.size();
      String model = models.get(modelIndex);
      try {
        String body =
            restClient
                .post()
                .uri(String.format(ENDPOINT, model))
                .header("x-goog-api-key", apiKeys.get(keyIndex))
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);
        // Success: next request starts at the key after this one.
        keyCursor.set((keyIndex + 1) % apiKeys.size());
        String text = extractText(body);
        log.info(
            "Recognition succeeded in {} ms on key #{} with {} ({} chars returned)",
            (System.nanoTime() - startedAtNanos) / 1_000_000,
            keyIndex,
            model,
            text.length());
        // After extractText, so a photo is only kept once there is an answer to pair it with.
        return new Answer(text, sampleStore.save(imageBase64, mimeType, model, text));
      } catch (RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String detail = errorMessage(e.getResponseBodyAsString());
        // errorMessage() yields "" for an empty or non-JSON body, and an empty reason would travel
        // all the way out as {"message":""}. The status is then the only thing left to report, and
        // it is worth reporting: it still says whether this was quota or capacity.
        String reason =
            detail.isBlank() ? "Gemini returned HTTP " + status + " with no message" : detail;
        if (!isRetryable(status, detail)) {
          log.warn("Gemini rejected the request ({} on {}): {}", status, model, detail);
          throw new IllegalStateException(reason, e);
        }
        lastError = reason;
        if (isQuotaFailure(status, detail)) {
          log.warn("Gemini key #{} is out of quota ({}): {}", keyIndex, status, detail);
          keyCursor.set((keyIndex + 1) % apiKeys.size());
          keyOffset++;
          if (keyOffset >= apiKeys.size()) {
            log.warn("All {} keys are out of quota", apiKeys.size());
            break;
          }
        } else {
          log.warn("Model {} is over capacity ({}): {}", model, status, detail);
          modelIndex++;
          if (modelIndex >= models.size()) {
            log.warn("All {} models are over capacity: {}", models.size(), models);
            break;
          }
          log.info("Falling back to model {}", models.get(modelIndex));
        }
      } catch (ResourceAccessException e) {
        // A timeout says nothing about which model or key is at fault, so treat it like the key
        // being unusable and move on rather than hammering the same one.
        log.warn("Gemini request failed on key #{} with {}: {}", keyIndex, model, e.getMessage());
        // Coalesced because a null would reach Map.of("message", ...) in the controller and NPE
        // into a 500, hiding the timeout behind "An unexpected error occurred".
        lastError = e.getMessage() != null ? e.getMessage() : "Upstream request failed";
        keyCursor.set((keyIndex + 1) % apiKeys.size());
        keyOffset++;
        if (keyOffset >= apiKeys.size()) {
          break;
        }
      }
    }

    // Non-null by construction: apiKeys is non-empty, so the loop ran at least once, and every path
    // out of an attempt either returns, throws, or records a reason here.
    throw new IllegalStateException(lastError);
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
    return status == 503 || status == 500 || isQuotaFailure(status, detail);
  }

  /**
   * Whether the key itself ran out, as opposed to Gemini being over capacity — a 503 "experiencing
   * high demand" is Google's own problem and hits every key at once, so reporting it as an
   * exhausted key sends anyone reading the log to look at their quota instead of at the upstream
   * status.
   */
  private static boolean isQuotaFailure(int status, String detail) {
    String lower = detail.toLowerCase(Locale.ROOT);
    return status == 429
        || lower.contains("quota")
        || lower.contains("resource has been exhausted");
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
