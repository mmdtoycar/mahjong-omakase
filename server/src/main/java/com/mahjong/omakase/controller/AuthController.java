package com.mahjong.omakase.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.HashMap;
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
    return email.charAt(0) + "***" + email.substring(atIdx);
  }

  /** Holds the bits of a verified Google ID Token we actually care about. */
  private static final class GoogleProfile {
    final String email;
    final String firstName;
    final String lastName;
    final String pictureUrl;

    GoogleProfile(String email, String fullName, String pictureUrl) {
      this.email = email;
      String[] parts =
          (fullName != null && !fullName.isBlank()) ? fullName.split(" ", 2) : new String[] {""};
      this.firstName = parts[0];
      this.lastName = parts.length > 1 ? parts[1] : "";
      this.pictureUrl = pictureUrl;
    }
  }

  private GoogleIdTokenVerifier newVerifier() {
    return new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
        .setAudience(Collections.singletonList(googleClientId))
        .build();
  }

  /**
   * Verify the Google ID Token and extract the bits we care about. Returns null if the token is
   * invalid (caller should map to 401). Throws if verifier infrastructure (network / crypto) fails.
   */
  private GoogleProfile verifyCredential(String credential)
      throws GeneralSecurityException, IOException {
    GoogleIdToken idToken = newVerifier().verify(credential);
    if (idToken == null) return null;
    GoogleIdToken.Payload payload = idToken.getPayload();
    return new GoogleProfile(
        payload.getEmail(), (String) payload.get("name"), (String) payload.get("picture"));
  }

  private static String newSessionToken() {
    return "token_" + UUID.randomUUID().toString().replace("-", "");
  }

  /**
   * Google sign-in entry point.
   *
   * <p>Verifies the Google credential and routes by what we already know about this email:
   *
   * <ul>
   *   <li>If a fully bound Player exists (merged=true) — rotate session token and return {token,
   *       player}.
   *   <li>Otherwise (no Player at all) — do NOT touch the database. Return {pendingAuth: true,
   *       profile} so the frontend can route to setup-profile. The Player record is created (or a
   *       legacy unbound row is claimed) only when the user commits to a
   *       userName/firstName/lastName in setupProfile.
   * </ul>
   */
  @PostMapping("/google")
  public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> request) {
    String idTokenString = request.get("credential");
    if (idTokenString == null || idTokenString.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing credential"));
    }

    GoogleProfile profile;
    try {
      profile = verifyCredential(idTokenString);
    } catch (GeneralSecurityException | IOException e) {
      log.error("Failed to verify Google ID Token", e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Verification failed: " + e.getMessage()));
    }
    if (profile == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Invalid ID Token"));
    }
    log.info("Google Auth verified successfully for email={}", redactEmail(profile.email));

    Optional<Player> playerOpt = playerRepo.findByEmail(profile.email);

    if (playerOpt.isPresent() && playerOpt.get().isMerged()) {
      // Fully bound returning user — rotate token, sync Google profile fields, done.
      Player player = playerOpt.get();
      player.setFirstName(profile.firstName);
      player.setLastName(profile.lastName);
      if (profile.pictureUrl != null) {
        player.setPictureUrl(profile.pictureUrl);
      }
      String sessionToken = newSessionToken();
      player.setToken(sessionToken);
      playerRepo.save(player);
      return ResponseEntity.ok(Map.of("token", sessionToken, "player", player));
    }

    // No bound Player. Do NOT write anything; frontend keeps the credential and calls setupProfile.
    Map<String, Object> profileMap = new HashMap<>();
    profileMap.put("email", profile.email);
    profileMap.put("firstName", profile.firstName);
    profileMap.put("lastName", profile.lastName);
    profileMap.put("picture", profile.pictureUrl);
    return ResponseEntity.ok(Map.of("pendingAuth", true, "profile", profileMap));
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
   * Atomic profile finalization. The frontend resends the Google credential alongside the desired
   * userName/firstName/lastName; we re-verify it here so the server is the sole authority on
   * email/picture. Two cases:
   *
   * <ul>
   *   <li><b>register</b>: no claimable legacy match → INSERT a brand-new Player carrying the
   *       Google identity.
   *   <li><b>claim</b>: a legacy unbound Player matches the form → UPDATE that row with
   *       email/picture/token, mark merged.
   * </ul>
   *
   * <p>Pre-condition: no merged-or-unmerged Player already exists for this Google email. The
   * preceding {@link #googleLogin} path lets fully-merged users in directly, so this endpoint
   * should only ever see emails that don't yet have a Player row. As a safety net, we reject with
   * 400 if an unmerged Player for this email is somehow still around (would only happen for users
   * created by the pre-#136 auto-create code who haven't completed onboarding yet — admin monitors
   * and they finish setup on the previous code path).
   */
  @Transactional
  @PostMapping("/setup-profile")
  public ResponseEntity<?> setupProfile(@RequestBody Map<String, String> request) {
    String credential = request.get("credential");
    if (credential == null || credential.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "缺少 Google 凭证, 请重新登录"));
    }

    GoogleProfile google;
    try {
      google = verifyCredential(credential);
    } catch (GeneralSecurityException | IOException e) {
      log.error("Failed to re-verify Google ID Token in setupProfile", e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Verification failed: " + e.getMessage()));
    }
    if (google == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Google 凭证已失效, 请重新登录"));
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

    Optional<Player> existing = playerRepo.findByEmail(google.email);
    if (existing.isPresent()) {
      // merged=true should never reach here (googleLogin path handles them), but defend anyway.
      // merged=false means an unmerged holdover from the pre-#136 auto-create code — those have
      // to complete onboarding via the old token-based code path before this PR ships, or via an
      // out-of-band admin fix. Either way, /setup-profile in the new flow should not see them.
      log.warn(
          "setupProfile blocked: Player id={} already exists for email={} (merged={})",
          existing.get().getId(),
          redactEmail(google.email),
          existing.get().isMerged());
      return ResponseEntity.badRequest().body(Map.of("error", "该 Google 账号已存在历史记录, 请联系管理员"));
    }

    Player legacy =
        playerRepo
            .findClaimableLegacyPlayer(trimmedUserName, trimmedFirstName, trimmedLastName)
            .orElse(null);
    String sessionToken = newSessionToken();
    Player result;
    String mode;

    if (legacy == null) {
      // register: brand new user, no legacy match. Single INSERT.
      if (playerRepo.existsByUserNameIgnoreCase(trimmedUserName)) {
        return ResponseEntity.badRequest().body(Map.of("error", "用户名已被占用,请换一个"));
      }
      Player p = new Player(trimmedUserName, trimmedFirstName, trimmedLastName);
      p.setEmail(google.email);
      p.setPictureUrl(google.pictureUrl);
      p.setToken(sessionToken);
      p.setMerged(true);
      result = playerRepo.saveAndFlush(p);
      mode = "register";
    } else {
      // claim: attach Google identity to the matching unbound legacy row.
      legacy.setEmail(google.email);
      legacy.setPictureUrl(google.pictureUrl);
      legacy.setToken(sessionToken);
      legacy.setMerged(true);
      result = playerRepo.saveAndFlush(legacy);
      mode = "claim";
    }

    log.info(
        "Profile setup complete (mode={}) for username={}, id={}",
        mode,
        result.getUserName(),
        result.getId());

    return ResponseEntity.ok(Map.of("token", sessionToken, "player", result));
  }
}
