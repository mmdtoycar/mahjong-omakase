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
import org.springframework.transaction.annotation.Transactional;
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

  private String redactEmail(String email) {
    if (email == null) return null;
    int atIdx = email.indexOf('@');
    if (atIdx <= 1) return "***";
    return email.substring(0, 1) + "***" + email.substring(atIdx);
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

    // 正常校验模式 (Google Sign-In JWT Verification)
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
        log.info("Google Auth verified successfully for email={}", redactEmail(email));
      } else {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Invalid ID Token"));
      }
    } catch (Exception e) {
      log.error("Failed to verify Google ID Token", e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Verification failed: " + e.getMessage()));
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
      String preferredUserName = email.split("@")[0];
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

  /**
   * Read-only check: does a claimable legacy player (matching userName/firstName/lastName, with no
   * bound email) exist? Used by the profile setup form to show the right confirmation copy (绑定 vs
   * 注册) before submitting.
   */
  @GetMapping("/lookup-claimable")
  public ResponseEntity<?> lookupClaimable(
      @RequestParam String userName,
      @RequestParam String firstName,
      @RequestParam String lastName) {
    if (userName == null
        || userName.isBlank()
        || firstName == null
        || firstName.isBlank()
        || lastName == null
        || lastName.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "All fields are required"));
    }
    boolean exists =
        playerRepo
            .findClaimableLegacyPlayer(userName.trim(), firstName.trim(), lastName.trim())
            .isPresent();
    return ResponseEntity.ok(Map.of("exists", exists));
  }

  /**
   * Atomic profile finalization: claim a matching legacy player if one exists, otherwise create a
   * brand-new player with the supplied name fields. Either path ends with the current Google
   * identity merged into the target player and the auto-created Google player deleted. The whole
   * thing runs in a single transaction so a failure can't leave a half-created player record
   * behind.
   */
  @Transactional
  @PostMapping("/setup-profile")
  public ResponseEntity<?> setupProfile(
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
      return ResponseEntity.badRequest().body(Map.of("error", "该账户已经完成绑定，无法再次设置"));
    }

    String userName = request.get("userName");
    String firstName = request.get("firstName");
    String lastName = request.get("lastName");

    if (userName == null
        || userName.isBlank()
        || firstName == null
        || firstName.isBlank()
        || lastName == null
        || lastName.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "请完整填写用户名、名、姓信息"));
    }

    String trimmedUserName = userName.trim();
    String trimmedFirstName = firstName.trim();
    String trimmedLastName = lastName.trim();

    // 1. Try to find a matching unbound legacy player.
    Player target =
        playerRepo
            .findClaimableLegacyPlayer(trimmedUserName, trimmedFirstName, trimmedLastName)
            .orElse(null);

    boolean claimedExisting = target != null;

    // 2. Fall back to creating a fresh player record.
    if (target == null) {
      // Reject if the userName collides with someone else's bound (email != null) account.
      // Case-insensitive to match the lookup above and the typical DB collation.
      if (playerRepo.existsByUserNameIgnoreCase(trimmedUserName)) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", "用户名「" + trimmedUserName + "」已被占用,请换一个"));
      }
      target = playerRepo.save(new Player(trimmedUserName, trimmedFirstName, trimmedLastName));
    }

    // 3. Merge current Google identity (email/picture/token) into target, mark merged, delete temp.
    String currentEmail = current.getEmail();
    String currentPicture = current.getPictureUrl();

    // Release current's email/token first so the unique-index constraint doesn't trip on flush.
    current.setEmail(null);
    current.setToken(null);
    playerRepo.saveAndFlush(current);

    target.setEmail(currentEmail);
    target.setPictureUrl(currentPicture);
    target.setToken(token);
    target.setMerged(true);
    playerRepo.saveAndFlush(target);

    playerRepo.delete(current);

    log.info(
        "Profile setup complete (mode={}) for username={}, id={}",
        claimedExisting ? "claim" : "register",
        target.getUserName(),
        target.getId());

    return ResponseEntity.ok(target);
  }
}
