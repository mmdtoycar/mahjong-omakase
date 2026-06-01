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

  @PostMapping("/claim")
  public ResponseEntity<?> claimAccount(
      @RequestHeader(value = "Authorization", required = false) String authHeader,
      @RequestBody Map<String, String> request) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing token"));
    }
    String token = authHeader.substring(7);
    Optional<Player> currentOpt = playerRepo.findByToken(token);
    if (currentOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
    }

    Player current = currentOpt.get();
    if (current.isMerged()) {
      return ResponseEntity.badRequest().body(Map.of("error", "该账户已经合并过老账号，无法再次合并"));
    }

    String oldUserName = request.get("userName");
    String oldFirstName = request.get("firstName");
    String oldLastName = request.get("lastName");

    if (oldUserName == null
        || oldUserName.isBlank()
        || oldFirstName == null
        || oldFirstName.isBlank()
        || oldLastName == null
        || oldLastName.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "请完整填写老账号的用户名、名、姓信息"));
    }

    // 寻找匹配且未被其他人认领过的老账号
    Optional<Player> oldPlayerOpt =
        playerRepo.findAll().stream()
            .filter(
                p ->
                    p.getUserName().equalsIgnoreCase(oldUserName.trim())
                        && p.getFirstName().equalsIgnoreCase(oldFirstName.trim())
                        && p.getLastName().equalsIgnoreCase(oldLastName.trim())
                        && p.getEmail() == null
                        && !p.getId().equals(current.getId()))
            .findFirst();

    if (oldPlayerOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(Map.of("error", "未找到符合条件且未绑定的老账号，请核对用户名与姓名"));
    }

    Player oldPlayer = oldPlayerOpt.get();

    // 转移 Google 账户的邮箱和头像，并将会话 token 移交到老账号实体
    String currentEmail = current.getEmail();
    String currentPicture = current.getPictureUrl();

    // 关键突破点：必须先释放当前临时账号占用的 email 和 token 唯一索引约束，并进行强 Flush，防范 Hibernate Commit Unique constraint 异常
    current.setEmail(null);
    current.setToken(null);
    playerRepo.saveAndFlush(current);

    oldPlayer.setEmail(currentEmail);
    oldPlayer.setPictureUrl(currentPicture);
    oldPlayer.setToken(token);
    oldPlayer.setMerged(true);

    // 保存老账号（即完成了合并，数据完美继承）
    playerRepo.saveAndFlush(oldPlayer);

    // 删除原先自动新建的 Google 临时账户（因为老账号已经绑定，以后每次用 Google 登录就会直接获取到老账号实体）
    playerRepo.delete(current);

    log.info(
        "Successfully merged current Google account with old account: username={}, id={}",
        oldPlayer.getUserName(),
        oldPlayer.getId());

    return ResponseEntity.ok(oldPlayer);
  }
}
