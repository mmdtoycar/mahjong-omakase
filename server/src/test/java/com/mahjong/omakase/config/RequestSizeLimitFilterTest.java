package com.mahjong.omakase.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestSizeLimitFilterTest {

  private final RequestSizeLimitFilter filter = new RequestSizeLimitFilter();

  /**
   * A 200 status alone proves nothing — a filter that returned early without calling {@code
   * doFilter} would leave the same default status. {@code MockFilterChain} only records a request
   * once it has actually been invoked, so that is what tells the two apart.
   */
  private record Result(MockHttpServletResponse response, MockFilterChain chain) {
    boolean reachedTheChain() {
      return chain.getRequest() != null;
    }
  }

  private Result run(long contentLength) throws Exception {
    return run("POST", contentLength, null);
  }

  private Result run(String method, long contentLength, String transferEncoding) throws Exception {
    // Override the getter the filter actually reads: MockHttpServletRequest derives its content
    // length from setContent(), which cannot express a body larger than the heap.
    MockHttpServletRequest request =
        new MockHttpServletRequest(method, "/api/recognize") {
          @Override
          public long getContentLengthLong() {
            return contentLength;
          }
        };
    if (transferEncoding != null) {
      request.addHeader("Transfer-Encoding", transferEncoding);
    }
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain chain = new MockFilterChain();
    filter.doFilter(request, response, chain);
    return new Result(response, chain);
  }

  @Test
  void passesABodyUnderTheLimit() throws Exception {
    Result result = run(1_000_000);
    assertThat(result.response().getStatus()).isEqualTo(200);
    assertThat(result.reachedTheChain()).isTrue();
  }

  @Test
  void passesABodyExactlyAtTheLimit() throws Exception {
    Result result = run(RequestSizeLimitFilter.MAX_REQUEST_BYTES);
    assertThat(result.response().getStatus()).isEqualTo(200);
    assertThat(result.reachedTheChain()).isTrue();
  }

  @Test
  void rejectsABodyOverTheLimit() throws Exception {
    Result result = run(RequestSizeLimitFilter.MAX_REQUEST_BYTES + 1);
    assertThat(result.response().getStatus()).isEqualTo(413);
    assertThat(result.response().getContentAsString()).contains("请求内容过大");
    assertThat(result.response().getContentType()).contains("application/json");
    assertThat(result.reachedTheChain()).isFalse();
  }

  /**
   * The realistic OOM case: a body far larger than the 512MB heap, rejected before Jackson reads.
   */
  @Test
  void rejectsABodyLargerThanTheHeap() throws Exception {
    Result result = run(1024L * 1024 * 1024);
    assertThat(result.response().getStatus()).isEqualTo(413);
    assertThat(result.reachedTheChain()).isFalse();
  }

  /** A bodyless PUT/DELETE declares no length either, so this must keep passing through. */
  @Test
  void allowsRequestsWithNoDeclaredLength() throws Exception {
    Result result = run(-1);
    assertThat(result.response().getStatus()).isEqualTo(200);
    assertThat(result.reachedTheChain()).isTrue();
  }

  /**
   * Chunked is the size-limit bypass: no Content-Length to compare against, so the body would
   * stream straight into Jackson however large it is.
   */
  @Test
  void rejectsAChunkedBodyBecauseItsSizeCannotBeChecked() throws Exception {
    Result result = run("POST", -1, "chunked");
    assertThat(result.response().getStatus()).isEqualTo(411);
    assertThat(result.response().getContentAsString()).contains("请求需要声明内容长度");
    assertThat(result.reachedTheChain()).isFalse();
  }

  @Test
  void rejectsChunkedRegardlessOfHeaderCasing() throws Exception {
    Result result = run("POST", -1, "gzip, Chunked");
    assertThat(result.response().getStatus()).isEqualTo(411);
    assertThat(result.reachedTheChain()).isFalse();
  }

  @Test
  void leavesNormalGetRequestsAlone() throws Exception {
    Result result = run("GET", -1, null);
    assertThat(result.response().getStatus()).isEqualTo(200);
    assertThat(result.reachedTheChain()).isTrue();
  }
}
