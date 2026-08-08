package com.mahjong.omakase.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.NoSuchElementException;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<Map<String, String>> handleNoResource(NoResourceFoundException e) {
    // resourcePath is a final field set from the request path, so it is never null.
    String path = e.getResourcePath();
    // Match the segment boundary: a bare startsWith("/api") also claims /apix/logo.svg, whose 404
    // must stay an empty static-resource response.
    if ("/api".equals(path) || path.startsWith("/api/")) {
      log.warn("No handler for API path: {}", path);
      // Log the path, don't echo it: reflecting a caller-controlled string is a needless risk.
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "接口不存在"));
    }
    return ResponseEntity.notFound().build();
  }

  /**
   * Only reached when the 405 comes from a {@code @Controller} path, where the exception is thrown
   * by handler mapping and leaves the handler null. A 405 on a static resource keeps a non-null,
   * non-{@code HandlerMethod} handler, and {@code AbstractHandlerMethodExceptionResolver} skips
   * {@code @ControllerAdvice} entirely in that case — those land on Spring's default resolver and
   * log without a path. That is the scanner traffic (POST/PROPFIND against {@code /}), and leaving
   * it as an empty 405 is correct; this handler exists to give our own frontend a JSON body.
   */
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<Map<String, String>> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException e, HttpServletRequest request) {
    log.warn("Method {} not supported for {}", e.getMethod(), request.getRequestURI());
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .body(Map.of("message", "该地址不支持此请求方式"));
  }

  @ExceptionHandler(NoSuchElementException.class)
  public ResponseEntity<Map<String, String>> handleNotFound(NoSuchElementException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Map<String, String>> handleConflict(IllegalStateException e) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
    String message =
        e.getBindingResult().getFieldErrors().stream()
            .map(err -> err.getField() + ": " + err.getDefaultMessage())
            .findFirst()
            .orElse("Validation failed");
    log.warn("Request validation failed: {}", message);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }

  @ExceptionHandler({ClientAbortException.class, AsyncRequestNotUsableException.class})
  public void handleClientDisconnect(Exception e) {
    log.debug("Client disconnected before the response was written: {}", e.getMessage());
  }

  /**
   * Controllers throw this to pick their own status — 403 from the admin guard, 400 for a bad
   * year/month, 404 for a missing player. Without this handler they all fell through to
   * handleGeneral, which reported "An unexpected error occurred" with a 500 and logged a full stack
   * trace, hiding both the real status and the reason.
   */
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
    String reason = e.getReason();
    log.warn("Rejected with {}: {}", e.getStatusCode(), reason);
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("message", reason != null ? reason : "请求被拒绝"));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleGeneral(Exception e) {
    log.error("Unexpected error", e);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("message", "An unexpected error occurred"));
  }
}
