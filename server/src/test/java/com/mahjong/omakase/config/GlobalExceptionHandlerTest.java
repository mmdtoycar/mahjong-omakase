package com.mahjong.omakase.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  /** The admin guard's 403 used to surface as a 500 "An unexpected error occurred". */
  @Test
  void keepsTheStatusAndReasonOfAnAdminRejection() {
    ResponseEntity<Map<String, String>> response =
        handler.handleResponseStatus(
            new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin authorization required"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(response.getBody()).containsEntry("message", "Admin authorization required");
  }

  @Test
  void keepsA400FromRequestParsing() {
    ResponseEntity<Map<String, String>> response =
        handler.handleResponseStatus(
            new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must be between 1 and 12"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody()).containsEntry("message", "Month must be between 1 and 12");
  }

  @Test
  void keepsA404ForAMissingPlayer() {
    ResponseEntity<Map<String, String>> response =
        handler.handleResponseStatus(
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(response.getBody()).containsEntry("message", "Player not found");
  }

  @Test
  void fallsBackToAGenericMessageWhenNoReasonWasGiven() {
    ResponseEntity<Map<String, String>> response =
        handler.handleResponseStatus(new ResponseStatusException(HttpStatus.CONFLICT));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).containsEntry("message", "请求被拒绝");
  }

  /** Anything genuinely unexpected still answers 500 without leaking internals. */
  @Test
  void stillHidesTrulyUnexpectedFailures() {
    ResponseEntity<Map<String, String>> response =
        handler.handleGeneral(new NullPointerException("some internal detail"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(response.getBody()).containsEntry("message", "An unexpected error occurred");
    assertThat(response.getBody().get("message")).doesNotContain("some internal detail");
  }
}
