package com.mahjong.omakase.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.dto.TileRecognitionRequest;
import com.mahjong.omakase.service.TileRecognitionService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class TileRecognitionControllerTest {

  private final TileRecognitionService service = mock(TileRecognitionService.class);
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
    when(service.recognize(anyString(), anyString()))
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
    when(service.recognize(anyString(), anyString()))
        .thenThrow(new IllegalStateException("服务端未配置 Gemini API Key，请联系管理员"));

    assertThat(controller.recognize(request()).getStatusCode())
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }

  @Test
  void returnsTheModelJsonOnSuccess() {
    when(service.recognize(anyString(), anyString())).thenReturn("{\"concealed\":[\"1m\"]}");

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody())
        .hasToString("TileRecognitionResponse(rawJson={\"concealed\":[\"1m\"]})");
  }
}
