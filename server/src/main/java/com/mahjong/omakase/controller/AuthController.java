package com.mahjong.omakase.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final PlayerRepository playerRepo;

  @Value("${google.client-id:123456-dummy.apps.googleusercontent.com}")
  private String googleClientId;

  public AuthController(PlayerRepository playerRepo) {
    this.playerRepo = playerRepo;
  }

  @PostMapping("/google")
  public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> request) {
    String idTokenString = request.get("credential");
    if (idTokenString == null || idTokenString.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing credential"));
    }

    String email = null;
    String name = null;
    String pictureUrl = null;

    // 1. 本地开发 Mock 模式 (以 dev_ 开头的 credential 直接认定校验成功)
    if (idTokenString.startsWith("dev_")) {
      String mockEmail = idTokenString.substring(4);
      if (mockEmail.contains("@") && mockEmail.endsWith(".com")) {
        email = mockEmail;
        name = mockEmail.split("@")[0];
        pictureUrl = "https://lh3.googleusercontent.com/a/default-user";
        log.info("Google Auth Mock Mode triggered for email={}", email);
      }
    }

    // 2. 正常校验模式 (Google Sign-In JWT Verification)
    if (email == null) {
      try {
        GoogleIdTokenVerifier verifier =
            new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(Collections.singletonList(googleClientId))
                .build();

        GoogleIdToken idToken = verifier.verify(idTokenString);
        if (idToken != null) {
          GoogleIdToken.Payload payload = idToken.getPayload();
          email = payload.getEmail();
          name = (String) payload.get("name");
          pictureUrl = (String) payload.get("picture");
          log.info("Google Auth verified successfully for email={}", email);
        } else {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Invalid ID Token"));
        }
      } catch (Exception e) {
        log.error("Failed to verify Google ID Token", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Verification failed: " + e.getMessage()));
      }
    }

    // 3. 匹配已有账号或自动创建新账号
    Optional<Player> playerOpt = playerRepo.findByEmail(email);
    Player player;

    if (playerOpt.isPresent()) {
      player = playerOpt.get();
      // 同步更新最新的 Google 个人 Profile 信息
      if (name != null) {
        String[] parts = name.split(" ", 2);
        player.setFirstName(parts[0]);
        if (parts.length > 1) {
          player.setLastName(parts[1]);
        } else {
          player.setLastName("");
        }
      }
      if (pictureUrl != null) {
        player.setPictureUrl(pictureUrl);
      }
    } else {
      // 降级防御：若已有老账号未绑定 Email，但 userName 与 Email 前缀一致，自动安全关联
      String preferredUserName = email.split("@")[0];
      Optional<Player> existingByUserName =
          playerRepo.findAll().stream()
              .filter(p -> p.getUserName().equalsIgnoreCase(preferredUserName))
              .findFirst();

      if (existingByUserName.isPresent() && existingByUserName.get().getEmail() == null) {
        player = existingByUserName.get();
        player.setEmail(email);
        if (pictureUrl != null) {
          player.setPictureUrl(pictureUrl);
        }
        log.info("Auto-bound Google login for existing player with userName={}", preferredUserName);
      } else {
        // 创建全新玩家
        String firstName = name != null ? name.split(" ", 2)[0] : preferredUserName;
        String lastName = (name != null && name.contains(" ")) ? name.split(" ", 2)[1] : "";

        // 保证唯一的唯一用户名
        String uniqueUserName = preferredUserName;
        int suffix = 1;
        while (playerRepo.existsByUserName(uniqueUserName)) {
          uniqueUserName = preferredUserName + suffix;
          suffix++;
        }

        player = new Player(uniqueUserName, firstName, lastName);
        player.setEmail(email);
        player.setPictureUrl(pictureUrl);
        log.info("Created new Google Player userName={}", uniqueUserName);
      }
    }

    // 4. 分配会话 Token 并更新数据库
    String sessionToken = "token_" + UUID.randomUUID().toString().replace("-", "");
    player.setToken(sessionToken);
    playerRepo.save(player);

    return ResponseEntity.ok(Map.of("token", sessionToken, "player", player));
  }

  @GetMapping("/me")
  public ResponseEntity<?> getMe(
      @RequestHeader(value = "Authorization", required = false) String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing token"));
    }
    String token = authHeader.substring(7);
    Optional<Player> player = playerRepo.findByToken(token);
    if (player.isPresent()) {
      return ResponseEntity.ok(player.get());
    }
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("error", "Invalid or expired token"));
  }
}
