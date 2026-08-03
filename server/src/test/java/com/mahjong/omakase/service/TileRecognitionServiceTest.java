package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Covers key rotation and error classification — the parts most likely to misbehave live. */
class TileRecognitionServiceTest {

  private static final String OK_BODY =
      "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{\\\"concealed\\\":[\\\"1m\\\"]}\"}]}}]}";

  private static String quotaBody() {
    return "{\"error\":{\"message\":\"Quota exceeded for this key\"}}";
  }

  private record Fixture(TileRecognitionService service, MockRestServiceServer server) {}

  private Fixture build(String keys) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    return new Fixture(
        new TileRecognitionService(new ObjectMapper(), builder.build(), keys, "gemini-test"),
        server);
  }

  @Test
  void returnsModelTextAndSendsKeyAsHeader() {
    Fixture f = build("key-a");
    f.server()
        .expect(header("x-goog-api-key", "key-a"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(f.service().recognize("BASE64", "image/jpeg")).contains("1m");
    f.server().verify();
  }

  @Test
  void rotatesToNextKeyOnQuotaError() {
    Fixture f = build("key-a,key-b");
    f.server()
        .expect(header("x-goog-api-key", "key-a"))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body(quotaBody()));
    f.server()
        .expect(header("x-goog-api-key", "key-b"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(f.service().recognize("BASE64", "image/jpeg")).contains("1m");
    f.server().verify();
  }

  @Test
  void failsWithUpstreamMessageWhenEveryKeyIsExhausted() {
    Fixture f = build("key-a,key-b");
    f.server()
        .expect(
            ExpectedCount.twice(), header("x-goog-api-key", org.hamcrest.Matchers.notNullValue()))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body(quotaBody()));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Quota exceeded");
    f.server().verify();
  }

  /** A bad request is our fault, not the key's — burning the whole pool on it is pointless. */
  @Test
  void doesNotRotateOnNonQuotaError() {
    Fixture f = build("key-a,key-b");
    f.server()
        .expect(ExpectedCount.once(), header("x-goog-api-key", "key-a"))
        .andRespond(
            withStatus(HttpStatus.BAD_REQUEST)
                .body("{\"error\":{\"message\":\"Invalid image payload\"}}"));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Invalid image payload");
    f.server().verify();
  }

  @Test
  void rejectsCallWhenNoKeyConfigured() {
    Fixture f = build("");
    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("未配置");
  }

  @Test
  void failsWhenModelReturnsNoUsableText() {
    Fixture f = build("key-a");
    f.server()
        .expect(header("x-goog-api-key", "key-a"))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("模型未返回有效内容");
  }
}
