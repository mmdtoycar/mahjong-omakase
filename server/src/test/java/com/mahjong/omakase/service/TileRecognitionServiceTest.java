package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
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
    return build(keys, "gemini-test");
  }

  private Fixture build(String keys, String models) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    return new Fixture(
        new TileRecognitionService(
            new ObjectMapper(),
            builder.build(),
            new RecognitionSampleStore(new ObjectMapper(), ""),
            keys,
            models),
        server);
  }

  private static String overloadBody() {
    return "{\"error\":{\"message\":\"This model is currently experiencing high demand.\"}}";
  }

  @Test
  void returnsModelTextAndSendsKeyAsHeader() {
    Fixture f = build("key-a");
    f.server()
        .expect(header("x-goog-api-key", "key-a"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
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

    assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    f.server().verify();
  }

  /**
   * Having three keys must not mean three calls per photo. The loop is failover, not fan-out: a
   * second key is only reached once the first has failed. verify() would report the extra requests.
   */
  @Test
  void spendsOnlyOneKeyWhenTheFirstOneSucceeds() {
    Fixture f = build("key-a,key-b,key-c");
    f.server()
        .expect(ExpectedCount.once(), header("x-goog-api-key", "key-a"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    f.server().verify();
  }

  /** The other half of rotation: load is spread across requests, not just on failure. */
  @Test
  void movesToTheNextKeyOnTheFollowingRequest() {
    Fixture f = build("key-a,key-b,key-c");
    f.server()
        .expect(header("x-goog-api-key", "key-a"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));
    f.server()
        .expect(header("x-goog-api-key", "key-b"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));
    f.server()
        .expect(header("x-goog-api-key", "key-c"))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    for (int i = 0; i < 3; i++) {
      assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    }
    f.server().verify();
  }

  /** The upstream reason is surfaced verbatim — it is the most precise thing we have. */
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

  /**
   * The failure that actually happened in production: three keys, three 503s, eight seconds, all
   * doomed. A 503 is the model being over capacity, which every key sees alike, so with nothing to
   * fall back to the right move is to stop at one call rather than burn the pool.
   */
  @Test
  void doesNotRotateKeysWhenTheModelItselfIsOverCapacity() {
    Fixture f = build("key-a,key-b,key-c", "only-model");
    f.server()
        .expect(ExpectedCount.once(), header("x-goog-api-key", "key-a"))
        .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body(overloadBody()));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("experiencing high demand");
    f.server().verify();
  }

  /** The point of the fallback chain: a busy model is survivable without waiting for Google. */
  @Test
  void fallsBackToTheNextModelWhenTheFirstIsOverCapacity() {
    Fixture f = build("key-a", "busy-model,spare-model");
    f.server()
        .expect(requestTo(org.hamcrest.Matchers.containsString("models/busy-model:")))
        .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body(overloadBody()));
    f.server()
        .expect(requestTo(org.hamcrest.Matchers.containsString("models/spare-model:")))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    f.server().verify();
  }

  /** The key is fine when the model is busy, so the fallback must not waste a key rotation. */
  @Test
  void keepsTheSameKeyWhenFallingBackToAnotherModel() {
    Fixture f = build("key-a,key-b", "busy-model,spare-model");
    f.server()
        .expect(ExpectedCount.twice(), header("x-goog-api-key", "key-a"))
        .andRespond(
            request ->
                request.getURI().toString().contains("busy-model")
                    ? withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(overloadBody())
                        .createResponse(request)
                    : withSuccess(OK_BODY, MediaType.APPLICATION_JSON).createResponse(request));

    assertThat(f.service().recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    f.server().verify();
  }

  /** Every model busy means the fallback chain is spent, not that the keys are bad. */
  @Test
  void givesUpWhenEveryModelIsOverCapacity() {
    Fixture f = build("key-a", "busy-one,busy-two");
    f.server()
        .expect(ExpectedCount.twice(), header("x-goog-api-key", "key-a"))
        .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body(overloadBody()));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("experiencing high demand");
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

  /** An empty upstream body must not become {"message":""} — the status is all we have left. */
  @Test
  void reportsTheStatusWhenTheUpstreamBodyIsEmpty() {
    Fixture f = build("key-a", "only-model");
    f.server()
        .expect(ExpectedCount.once(), header("x-goog-api-key", "key-a"))
        .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("Gemini returned HTTP 503 with no message");
    f.server().verify();
  }

  /** Same for a status nothing can retry: a bare 403 still has to say what happened. */
  @Test
  void reportsTheStatusWhenARejectionHasNoBody() {
    Fixture f = build("key-a");
    f.server()
        .expect(ExpectedCount.once(), header("x-goog-api-key", "key-a"))
        .andRespond(withStatus(HttpStatus.FORBIDDEN));

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("Gemini returned HTTP 403 with no message");
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

  /** An empty GEMINI_MODEL must not produce a request URL with a blank model name. */
  @Test
  void fallsBackToDefaultModelWhenBlank() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    TileRecognitionService service =
        new TileRecognitionService(
            new ObjectMapper(),
            builder.build(),
            new RecognitionSampleStore(new ObjectMapper(), ""),
            "key-a",
            "  ");
    server
        .expect(requestTo(org.hamcrest.Matchers.containsString("models/gemini-3.6-flash:")))
        .andRespond(withSuccess(OK_BODY, MediaType.APPLICATION_JSON));

    assertThat(service.recognize("BASE64", "image/jpeg").rawJson()).contains("1m");
    server.verify();
  }
}
