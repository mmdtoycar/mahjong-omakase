package com.mahjong.omakase.config;

import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.Set;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class SecurityInterceptor implements HandlerInterceptor {

  /**
   * Endpoints reachable before a token exists. Matched exactly, never by prefix: a prefix check on
   * {@code /api/auth/} would also expose {@code /api/auth/me}, and {@code startsWith} on a single
   * path would accept {@code /api/auth/googleAnything}.
   *
   * <p>Each of these authenticates itself. {@code google} and {@code setup-profile} verify a Google
   * credential; {@code lookup-claimable} only answers whether a name is already taken. All three
   * are on the registration path, before {@code setup-profile} issues the session token.
   */
  private static final Set<String> PUBLIC_API_PATHS =
      Set.of("/api/auth/google", "/api/auth/setup-profile", "/api/auth/lookup-claimable");

  private final PlayerRepository playerRepo;

  public SecurityInterceptor(PlayerRepository playerRepo) {
    this.playerRepo = playerRepo;
  }

  @Override
  public boolean preHandle(
      @NonNull HttpServletRequest request,
      @NonNull HttpServletResponse response,
      @NonNull Object handler)
      throws Exception {

    String path = request.getRequestURI();

    // Static assets and SPA routes are not /api, so they never need a token. Match on the segment
    // boundary so a path like /apix/logo.svg is not mistaken for an API call and refused.
    boolean isApi = "/api".equals(path) || path.startsWith("/api/");
    if (!isApi || "/error".equals(path) || PUBLIC_API_PATHS.contains(path)) {
      return true;
    }

    String authHeader = request.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      String token = authHeader.substring(7);
      Optional<Player> player = playerRepo.findByToken(token);
      if (player.isPresent()) {
        request.setAttribute("currentUser", player.get());
        return true;
      }
    }

    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write("{\"error\": \"请先登录\"}");
    return false;
  }
}
