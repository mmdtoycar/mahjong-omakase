package com.mahjong.omakase.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestSizeLimitFilterTest {

  private final RequestSizeLimitFilter filter = new RequestSizeLimitFilter();

  private MockHttpServletResponse run(long contentLength) throws Exception {
    // Override the getter the filter actually reads: MockHttpServletRequest derives its content
    // length from setContent(), which cannot express a body larger than the heap.
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/api/recognize") {
          @Override
          public long getContentLengthLong() {
            return contentLength;
          }
        };
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    return response;
  }

  @Test
  void passesABodyUnderTheLimit() throws Exception {
    assertThat(run(1_000_000).getStatus()).isEqualTo(200);
  }

  @Test
  void passesABodyExactlyAtTheLimit() throws Exception {
    assertThat(run(RequestSizeLimitFilter.MAX_REQUEST_BYTES).getStatus()).isEqualTo(200);
  }

  @Test
  void rejectsABodyOverTheLimit() throws Exception {
    MockHttpServletResponse response = run(RequestSizeLimitFilter.MAX_REQUEST_BYTES + 1);
    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getContentAsString()).contains("请求内容过大");
    assertThat(response.getContentType()).contains("application/json");
  }

  /**
   * The realistic OOM case: a body far larger than the 512MB heap, rejected before Jackson reads.
   */
  @Test
  void rejectsABodyLargerThanTheHeap() throws Exception {
    assertThat(run(1024L * 1024 * 1024).getStatus()).isEqualTo(413);
  }

  /** No Content-Length (chunked) is documented as passing through — pin the behaviour. */
  @Test
  void allowsRequestsWithNoDeclaredLength() throws Exception {
    assertThat(run(-1).getStatus()).isEqualTo(200);
  }

  @Test
  void leavesNormalGetRequestsAlone() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/sessions");
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    assertThat(response.getStatus()).isEqualTo(200);
  }
}
