package com.mahjong.omakase.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * The whole API was unauthenticated while this interceptor sat commented out, so pin the allowlist
 * down: every entry that opens up is a route anyone on the internet can call.
 */
class SecurityInterceptorTest {

  private static final String VALID_TOKEN = "token_abc123";

  private final PlayerRepository repo = mock(PlayerRepository.class);
  private final SecurityInterceptor interceptor = new SecurityInterceptor(repo);

  private boolean handle(String method, String path, String token) throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest(method, path);
    if (token != null) {
      request.addHeader("Authorization", "Bearer " + token);
    }
    return interceptor.preHandle(request, new MockHttpServletResponse(), new Object());
  }

  private MockHttpServletResponse responseFor(String path, String token) throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
    if (token != null) {
      request.addHeader("Authorization", "Bearer " + token);
    }
    MockHttpServletResponse response = new MockHttpServletResponse();
    interceptor.preHandle(request, response, new Object());
    return response;
  }

  // ── public: reachable before a token exists ────────────────────────────────

  @Test
  void allowsTheRegistrationPathWithoutAToken() throws Exception {
    assertThat(handle("POST", "/api/auth/google", null)).isTrue();
    assertThat(handle("POST", "/api/auth/setup-profile", null)).isTrue();
    assertThat(handle("GET", "/api/auth/lookup-claimable", null)).isTrue();
  }

  @Test
  void allowsStaticAssetsAndSpaRoutes() throws Exception {
    assertThat(handle("GET", "/index.html", null)).isTrue();
    assertThat(handle("GET", "/session/193", null)).isTrue();
    assertThat(handle("GET", "/assets/index-abc.js", null)).isTrue();
    assertThat(handle("GET", "/error", null)).isTrue();
  }

  /** A bare startsWith("/api") would have refused these as API calls and broken the SPA. */
  @Test
  void treatsOnlyWholeApiSegmentsAsApiPaths() throws Exception {
    assertThat(handle("GET", "/apix/logo.svg", null)).isTrue();
    assertThat(handle("GET", "/api-docs", null)).isTrue();
    assertThat(handle("GET", "/apis", null)).isTrue();
    assertThat(handle("GET", "/api", null)).isFalse();
  }

  // ── protected ──────────────────────────────────────────────────────────────

  @Test
  void rejectsApiCallsWithoutAToken() throws Exception {
    for (String path :
        new String[] {
          "/api/sessions",
          "/api/players",
          "/api/stats",
          "/api/auth/me",
          "/api/recognize",
          "/api/admin/sessions",
          "/api/players/check-username"
        }) {
      assertThat(handle("GET", path, null)).as(path).isFalse();
    }
  }

  @Test
  void rejectsAnInvalidToken() throws Exception {
    when(repo.findByToken(anyString())).thenReturn(Optional.empty());
    assertThat(handle("GET", "/api/sessions", "bogus")).isFalse();
  }

  /** A prefix check would have accepted this; the allowlist matches exact paths. */
  @Test
  void rejectsPathsThatMerelyStartWithAPublicOne() throws Exception {
    assertThat(handle("POST", "/api/auth/googleAnything", null)).isFalse();
    assertThat(handle("GET", "/api/auth/google/../me", null)).isFalse();
  }

  @Test
  void answers401WithJson() throws Exception {
    MockHttpServletResponse response = responseFor("/api/sessions", null);
    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentType()).contains("application/json");
    assertThat(response.getContentAsString()).contains("请先登录");
  }

  // ── authenticated ──────────────────────────────────────────────────────────

  @Test
  void allowsAValidTokenAndExposesTheCurrentUser() throws Exception {
    Player player = new Player();
    player.setId(7L);
    when(repo.findByToken(VALID_TOKEN)).thenReturn(Optional.of(player));

    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/sessions");
    request.addHeader("Authorization", "Bearer " + VALID_TOKEN);
    assertThat(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()))
        .isTrue();
    assertThat(request.getAttribute("currentUser")).isSameAs(player);
  }

  @Test
  void ignoresAnAuthorizationHeaderThatIsNotBearer() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/sessions");
    request.addHeader("Authorization", "Basic dXNlcjpwYXNz");
    assertThat(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()))
        .isFalse();
  }
}
