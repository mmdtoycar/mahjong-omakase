package com.mahjong.omakase.config;

import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class SecurityInterceptor implements HandlerInterceptor {

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

    // 1. 放行 Google 认证接口、静态资源、Spa路由转发、以及错误信息
    if (path.startsWith("/api/auth/google") || "/error".equals(path) || !path.startsWith("/api")) {
      return true;
    }

    // 2. 检查 Authorization 请求头 "Bearer <token>"
    String authHeader = request.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      String token = authHeader.substring(7);
      Optional<Player> player = playerRepo.findByToken(token);
      if (player.isPresent()) {
        // 将登录的当前用户注入请求属性，供后续业务提取
        request.setAttribute("currentUser", player.get());
        return true;
      }
    }

    // 3. 未登录或 Token 无效，拦截并返回 401 Unauthorized
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.getWriter().write("{\"error\": \"Unauthorized. Please login first.\"}");
    return false;
  }
}
