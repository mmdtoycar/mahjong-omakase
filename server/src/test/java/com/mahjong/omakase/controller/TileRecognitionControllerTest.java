package com.mahjong.omakase.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.dto.TileRecognitionRequest;
import com.mahjong.omakase.service.HandRecognitionService;
import com.mahjong.omakase.service.HandRecognitionService.Recognition;
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
    when(service.recognize(anyString(), anyString(), any()))
        .thenThrow(new IllegalStateException("This model is currently experiencing high demand."));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(response.getStatusCode()).isNotEqualTo(HttpStatus.BAD_GATEWAY);
    assertThat(response.getBody())
        .isEqualTo(Map.of("message", "This model is currently experiencing high demand."));
  }

  /** Any unexpected IllegalStateException out of the service still degrades to 503, not 500. */
  @Test
  void answers503OnAnyUnexpectedFailure() {
    when(service.recognize(anyString(), anyString(), any()))
        .thenThrow(new IllegalStateException("something the service did not expect"));

    assertThat(controller.recognize(request()).getStatusCode())
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }

  @Test
  void returnsTheModelJsonOnSuccess() {
    when(service.recognize(anyString(), anyString(), any()))
        .thenReturn(new Recognition("{\"concealed\":[\"1m\"]}", null, "2026-08-09/aabbccdd1122"));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody())
        .hasToString(
            "TileRecognitionResponse(rawJson={\"concealed\":[\"1m\"]}, warning=null,"
                + " sampleId=2026-08-09/aabbccdd1122)");
  }

  /**
   * A miss is a success with a note attached, not an error: the hand is empty, and the note is the
   * only thing standing between "the local reader is broken" and nobody noticing for weeks.
   */
  @Test
  void carriesTheMissWarningAlongsideTheEmptyHand() {
    when(service.recognize(anyString(), anyString(), any()))
        .thenReturn(new Recognition("{\"concealed\":[]}", "本地识别服务连不上，请直接输入", null));

    ResponseEntity<Object> response = controller.recognize(request());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().toString()).contains("请直接输入");
  }
}
