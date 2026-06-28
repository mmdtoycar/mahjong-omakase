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
   * Read-only check: does any player record exist matching userName/firstName/lastName exactly
   * (case-insensitive)? Used by the profile setup form to show the right confirmation copy (绑定 vs
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
        playerRepo.findByExactName(userName.trim(), firstName.trim(), lastName.trim()).isPresent();
    return ResponseEntity.ok(Map.of("exists", exists));
  }

  /**
   * Atomic profile finalization. The frontend resends the Google credential alongside the desired
   * userName/firstName/lastName; we re-verify it here so the server is the sole authority on
   * email/picture. Two branches based on whether the typed (userName, firstName, lastName) exactly
   * matches an existing row:
   *
   * <ul>
   *   <li><b>claim</b>: exact-name match exists. Allowed only if the row's email is unset OR the
   *       row's email equals the verified Google email; otherwise rejected (would let anyone with a
   *       guessed name overwrite someone else's bound account). The row gets email/picture/token
   *       attached and merged flipped to true.
   *   <li><b>register</b>: no exact-name match. INSERT a brand-new Player. A defensive findByEmail
   *       check first catches "user mistyped their name but their email is already bound" — would
   *       otherwise crash on the email UNIQUE constraint with a 500.
   * </ul>
   *
   * <p>All security-relevant rejections use generic "请联系管理员" text — we deliberately do not leak the
   * other row's stored userName/firstName/lastName back to the caller.
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

    Player match =
        playerRepo.findByExactName(trimmedUserName, trimmedFirstName, trimmedLastName).orElse(null);
    String sessionToken = newSessionToken();
    Player result;
    String mode;

    if (match != null) {
      // claim/rename branch — name matched an existing row.
      if (match.getEmail() != null && !match.getEmail().equals(google.email)) {
        log.warn(
            "setupProfile claim blocked (email mismatch): match.id={} for credential email={}",
            match.getId(),
            redactEmail(google.email));
        return ResponseEntity.badRequest().body(Map.of("error", "无法完成绑定, 请联系管理员"));
      }
      if (match.isMerged()) {
        log.warn("setupProfile claim blocked (already merged): match.id={}", match.getId());
        return ResponseEntity.badRequest().body(Map.of("error", "该账号已完成绑定, 请联系管理员"));
      }
      mode = match.getEmail() == null ? "claim" : "rebind";
      match.setEmail(google.email);
      if (google.pictureUrl != null) {
        match.setPictureUrl(google.pictureUrl);
      }
      match.setToken(sessionToken);
      match.setMerged(true);
      result = playerRepo.saveAndFlush(match);
    } else {
      // register branch — no exact-name match.
      // Defensive: if this Google email is already bound to a different (name-mismatching) row,
      // the INSERT below would crash on the email UNIQUE constraint with a 500. Friendly 400
      // instead. Typical trigger: user mistyped their old account's name during setup.
      if (playerRepo.findByEmail(google.email).isPresent()) {
        log.warn(
            "setupProfile register blocked (email already bound, name mismatch): email={}",
            redactEmail(google.email));
        return ResponseEntity.badRequest().body(Map.of("error", "无法完成绑定, 请联系管理员"));
      }
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
    }

    log.info(
        "Profile setup complete (mode={}) for username={}, id={}",
        mode,
        result.getUserName(),
        result.getId());

    return ResponseEntity.ok(Map.of("token", sessionToken, "player", result));
  }
}
