package com.mahjong.omakase.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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
 * <p>Scope of the guard: this checks the declared {@code Content-Length}, which covers every normal
 * client (fetch, curl, the app itself) and the realistic accident of an oversized photo. A request
 * using chunked transfer encoding declares no length and slips past — Cloudflare's own request-size
 * cap and requiring authentication are the outer layers for that case.
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
      response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      response.setCharacterEncoding("UTF-8");
      response.getWriter().write("{\"message\":\"请求内容过大\"}");
      return;
    }
    chain.doFilter(request, response);
  }
}
