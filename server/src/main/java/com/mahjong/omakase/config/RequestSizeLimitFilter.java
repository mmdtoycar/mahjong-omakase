package com.mahjong.omakase.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rejects oversized request bodies before anything reads them.
 *
 * <p>Bean Validation cannot do this job: {@code @Size} on a DTO field only runs once Jackson has
 * already deserialized the whole body into the heap. With {@code -Xmx512m}, a single
 * multi-hundred-MB POST would exhaust memory before validation ever executed.
 *
 * <p>Two ways in, both closed: an oversized declared {@code Content-Length} is refused with 413,
 * and a chunked body — which declares no length at all and would otherwise stream straight into
 * Jackson — is refused with 411. Nothing in this app sends chunked requests; {@code fetch} and
 * {@code curl} both set a length. A missing length without chunked encoding is left alone, because
 * a bodyless {@code PUT}/{@code DELETE} (completing a session, deleting a round) legitimately has
 * neither.
 */
@Slf4j
@Component
public class RequestSizeLimitFilter extends OncePerRequestFilter {

  /**
   * Generous next to the real payload: the recognition DTO caps base64 at 8MB, and JSON overhead on
   * top of that is small.
   */
  static final long MAX_REQUEST_BYTES = 12L * 1024 * 1024;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    long declared = request.getContentLengthLong();
    if (declared > MAX_REQUEST_BYTES) {
      log.warn(
          "Rejected {} byte body on {} (limit {})",
          declared,
          request.getRequestURI(),
          MAX_REQUEST_BYTES);
      reject(response, HttpStatus.PAYLOAD_TOO_LARGE, "请求内容过大");
      return;
    }

    if (isChunked(request)) {
      log.warn("Rejected chunked body on {}: length must be declared", request.getRequestURI());
      reject(response, HttpStatus.LENGTH_REQUIRED, "请求需要声明内容长度");
      return;
    }

    chain.doFilter(request, response);
  }

  private static boolean isChunked(HttpServletRequest request) {
    String encoding = request.getHeader("Transfer-Encoding");
    return encoding != null && encoding.toLowerCase(Locale.ROOT).contains("chunked");
  }

  private void reject(HttpServletResponse response, HttpStatus status, String message)
      throws IOException {
    response.setStatus(status.value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write("{\"message\":\"" + message + "\"}");
  }
}
