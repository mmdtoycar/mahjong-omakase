package com.mahjong.omakase.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahjong.omakase.service.LocalReaderService.ReaderUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Covers the one thing this class exists to decide: which failures mean "the photo" and which mean
 * "the wiring". Getting that wrong shows a user a message about JSON fields and calls it a photo
 * problem.
 */
class LocalReaderServiceTest {

  private static final String READER = "http://reader:8000";

  private record Fixture(LocalReaderService service, MockRestServiceServer server) {}

  private Fixture build() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    return new Fixture(new LocalReaderService(new ObjectMapper(), builder.build(), READER), server);
  }

  private void answer(MockRestServiceServer server, HttpStatus status, String body) {
    server
        .expect(requestTo(READER + "/recognize"))
        .andRespond(
            status.is2xxSuccessful()
                ? withSuccess(body, MediaType.APPLICATION_JSON)
                : withStatus(status).contentType(MediaType.APPLICATION_JSON).body(body));
  }

  @Test
  void returnsTheReaderJsonUntouched() {
    Fixture f = build();
    answer(f.server(), HttpStatus.OK, "{\"concealed\":[\"1m\"]}");

    assertThat(f.service().recognize("BASE64", "image/jpeg")).isEqualTo("{\"concealed\":[\"1m\"]}");
    f.server().verify();
  }

  /** 422 is the reader saying it looked and found no hand. That belongs in front of the user. */
  @Test
  void treats422AsThePhotoBeingUnreadable() {
    Fixture f = build();
    answer(f.server(), HttpStatus.UNPROCESSABLE_ENTITY, "{\"message\":\"no line of tiles found\"}");

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("no line of tiles found");
  }

  /** 415 likewise: it looked at the bytes and could not decode them. */
  @Test
  void treats415AsThePhotoBeingUnreadable() {
    Fixture f = build();
    answer(f.server(), HttpStatus.UNSUPPORTED_MEDIA_TYPE, "{\"message\":\"could not decode\"}");

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("could not decode");
  }

  /**
   * A 400 means this side sent something the reader would not parse, and a 404 means it was sent to
   * the wrong path. Neither is anything to do with the photo, and reporting them as one would put
   * "expected a JSON body with an imageBase64 field" in front of a user while a wiring bug went
   * unnoticed.
   */
  @Test
  void treatsAMalformedRequestAsTheReaderBeingUnusable() {
    Fixture f = build();
    answer(f.server(), HttpStatus.BAD_REQUEST, "{\"message\":\"expected a JSON body\"}");

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(ReaderUnavailableException.class);
  }

  @Test
  void treatsAWrongPathAsTheReaderBeingUnusable() {
    Fixture f = build();
    answer(f.server(), HttpStatus.NOT_FOUND, "{\"message\":\"not found\"}");

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(ReaderUnavailableException.class);
  }

  @Test
  void treatsAReaderCrashAsTheReaderBeingUnusable() {
    Fixture f = build();
    answer(f.server(), HttpStatus.INTERNAL_SERVER_ERROR, "");

    assertThatThrownBy(() -> f.service().recognize("BASE64", "image/jpeg"))
        .isInstanceOf(ReaderUnavailableException.class);
  }

  /**
   * A reader.url with a trailing slash would build ".../recognize" with a double slash, which the
   * reader answers 404 — and a 404 is reported as the reader being unusable, so the whole local
   * path would fall back to Gemini forever over one character of configuration.
   */
  @Test
  void toleratesATrailingSlashInTheConfiguredUrl() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    LocalReaderService service =
        new LocalReaderService(new ObjectMapper(), builder.build(), READER + "/");
    server
        .expect(requestTo(READER + "/recognize"))
        .andRespond(withSuccess("{\"concealed\":[\"1m\"]}", MediaType.APPLICATION_JSON));

    service.recognize("BASE64", "image/jpeg");

    server.verify();
  }

  @Test
  void isNotConfiguredWithoutAUrl() {
    assertThat(
            new LocalReaderService(new ObjectMapper(), RestClient.builder().build(), "  ")
                .isConfigured())
        .isFalse();
    assertThat(
            new LocalReaderService(new ObjectMapper(), RestClient.builder().build(), null)
                .isConfigured())
        .isFalse();
    assertThat(
            new LocalReaderService(new ObjectMapper(), RestClient.builder().build(), READER)
                .isConfigured())
        .isTrue();
  }
}
