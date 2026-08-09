package com.mahjong.omakase.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahjong.omakase.dto.RecognitionConfirmRequest;
import com.mahjong.omakase.dto.TileRecognitionRequest;
import com.mahjong.omakase.service.HandRecognitionService;
import com.mahjong.omakase.service.HandRecognitionService.Recognition;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class TileRecognitionControllerTest {

  private final HandRecognitionService service = mock(HandRecognitionService.class);
  private final TileRecognitionController controller = new TileRecognitionController(service);

  private static TileRecognitionRequest request() {
    TileRecognitionRequest request = new TileRecognitionRequest();
    request.setImageBase64("BASE64");
    request.setMimeType("image/jpeg");
    return request;
  }

  /**
   * Was 502, which Cloudflare replaces with its own branded gateway-error page — the user saw that
   * instead of the reason. 503 is passed through, so the message below actually reaches the
   * browser.
   */
  @Test
  void answers503SoTheProxyDoesNotReplaceOurMessage() {
    when(service.recognize(anyString(), anyString(), anyString()))
        .thenThrow(new IllegalStateException("This model is currently experiencing high demand."));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(response.getStatusCode()).isNotEqualTo(HttpStatus.BAD_GATEWAY);
    assertThat(response.getBody())
        .isEqualTo(Map.of("message", "This model is currently experiencing high demand."));
  }

  /** A missing key is a server-side configuration gap, so it belongs on the same branch. */
  @Test
  void answers503WhenNoKeyIsConfigured() {
    when(service.recognize(anyString(), anyString(), anyString()))
        .thenThrow(new IllegalStateException("服务端未配置 Gemini API Key，请联系管理员"));

    assertThat(controller.recognize(request()).getStatusCode())
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }

  @Test
  void returnsTheModelJsonOnSuccess() {
    when(service.recognize(anyString(), anyString(), anyString()))
        .thenReturn(new Recognition("{\"concealed\":[\"1m\"]}", null, "2026-08-09/aabbccdd1122"));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody())
        .hasToString(
            "TileRecognitionResponse(rawJson={\"concealed\":[\"1m\"]}, warning=null,"
                + " sampleId=2026-08-09/aabbccdd1122)");
  }

  /**
   * `engine` has a default, and a pattern on its own would let an explicit null through and wipe
   * it. The values are the contract between the browser and the router that picks a recogniser.
   */
  @Test
  void rejectsAnEngineThatIsNullOrUnknown() {
    Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    TileRecognitionRequest nulled = request();
    nulled.setEngine(null);
    assertThat(validator.validate(nulled)).hasSize(1);

    TileRecognitionRequest unknown = request();
    unknown.setEngine("claude");
    assertThat(validator.validate(unknown)).hasSize(1);

    assertThat(validator.validate(request())).isEmpty();
    assertThat(new TileRecognitionRequest().getEngine()).isEqualTo("local");
  }

  /**
   * A fallback is a success with a note attached, not an error: the hand is usable, and the note is
   * the only thing standing between "the local reader is broken" and nobody noticing for weeks.
   */
  @Test
  void carriesTheFallbackWarningAlongsideTheHand() {
    when(service.recognize(anyString(), anyString(), anyString()))
        .thenReturn(new Recognition("{\"concealed\":[\"1m\"]}", "本地识别服务连不上，已自动改用在线识别", null));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().toString()).contains("已自动改用在线识别");
  }

  private static RecognitionConfirmRequest confirmation(String sampleId) throws Exception {
    RecognitionConfirmRequest request = new RecognitionConfirmRequest();
    request.setSampleId(sampleId);
    request.setHand(new ObjectMapper().readTree("{\"concealed\":[\"1m\"]}"));
    return request;
  }

  /**
   * Passed through as it arrived: the shape of a hand is the UI's business, not this endpoint's.
   */
  @Test
  void passesTheConfirmedHandThroughUntouched() throws Exception {
    RecognitionConfirmRequest request = confirmation("2026-08-09/aabbccdd1122");

    ResponseEntity<Void> response = controller.confirm(request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    verify(service).confirm("2026-08-09/aabbccdd1122", request.getHand());
  }

  /**
   * The id is resolved against the sample directory, so it is validated before it gets there. A 400
   * rather than a silent drop, because a caller sending the wrong thing is a bug worth seeing.
   */
  @Test
  void rejectsASampleIdThatIsNotADayAndADigest() throws Exception {
    Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    assertThat(validator.validate(confirmation("2026-08-09/aabbccdd1122"))).isEmpty();
    assertThat(validator.validate(confirmation("../../etc/passwd"))).hasSize(1);
    assertThat(validator.validate(confirmation("2026-08-09/NOTHEX123456"))).hasSize(1);
    assertThat(validator.validate(confirmation("2026-08-09/aabbccdd1122/more"))).hasSize(1);
    assertThat(validator.validate(confirmation(null))).hasSize(1);
  }
}
