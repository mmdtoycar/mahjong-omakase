package com.mahjong.omakase.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.FanDiscoveryRepository;
import com.mahjong.omakase.repository.GameSessionPlayerRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import com.mahjong.omakase.repository.RoundRepository;
import com.mahjong.omakase.repository.RoundScoreRepository;
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
  private final GameSessionPlayerRepository gameSessionPlayerRepo;
  private final RoundRepository roundRepo;
  private final RoundScoreRepository roundScoreRepo;
  private final FanDiscoveryRepository fanDiscoveryRepo;
  private final PlayerMonthlySkillRepository monthlySkillRepo;

  @Value("${google.client-id:123456-dummy.apps.googleusercontent.com}")
  private String googleClientId;

  public AuthController(
      PlayerRepository playerRepo,
      GameSessionPlayerRepository gameSessionPlayerRepo,
      RoundRepository roundRepo,
      RoundScoreRepository roundScoreRepo,
      FanDiscoveryRepository fanDiscoveryRepo,
      PlayerMonthlySkillRepository monthlySkillRepo) {
    this.playerRepo = playerRepo;
    this.gameSessionPlayerRepo = gameSessionPlayerRepo;
    this.roundRepo = roundRepo;
    this.roundScoreRepo = roundScoreRepo;
    this.fanDiscoveryRepo = fanDiscoveryRepo;
    this.monthlySkillRepo = monthlySkillRepo;
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
   *   <li>Otherwise (no Player, or a legacy unmerged Player from the old auto-create flow) — do NOT
   *       touch the database. Return {pendingAuth: true, profile} so the frontend can route to
   *       setup-profile. The Player record will be created or claimed only when the user commits to
   *       a userName/firstName/lastName in setupProfile.
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

    // No bound Player yet (either first time, or a legacy unmerged Player from the old code).
    // Do NOT write anything. Frontend will keep the credential and call setupProfile.
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
   * email/picture. Four cases:
   *
   * <ol>
   *   <li><b>register (clean)</b>: no Player for this email and no matching legacy → INSERT new.
   *   <li><b>claim (clean)</b>: no Player for this email, matching legacy unbound player exists →
   *       attach email/token/picture to that legacy row.
   *   <li><b>legacy-register</b>: an unmerged Player already exists for this email (created by the
   *       old auto-create code), no matching legacy → rename in place, mark merged.
   *   <li><b>legacy-claim</b>: an unmerged Player + matching legacy → reassign all FK references
   *       from the temp to legacy, then delete temp. Same migration logic as before.
   * </ol>
   *
   * Once the database stops accumulating new unmerged Players (this PR removes the auto-create
   * branch from googleLogin), the legacy-* cases naturally drain and can be removed.
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

    Player existing = playerRepo.findByEmail(google.email).orElse(null);
    if (existing != null && existing.isMerged()) {
      return ResponseEntity.badRequest().body(Map.of("error", "该账户已经完成绑定，无法再次设置"));
    }

    Player legacy =
        playerRepo
            .findClaimableLegacyPlayer(trimmedUserName, trimmedFirstName, trimmedLastName)
            .orElse(null);

    String sessionToken = newSessionToken();
    Player result;
    String mode;

    if (existing == null && legacy == null) {
      // Clean register: brand new user, no legacy to inherit. Single INSERT.
      // Reject username collisions against bound accounts (case-insensitive).
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

    } else if (existing == null) {
      // Clean claim: legacy != null here (previous branch ruled out both-null).
      // No temp Player to clean up, just attach identity to the legacy row.
      legacy.setEmail(google.email);
      legacy.setPictureUrl(google.pictureUrl);
      legacy.setToken(sessionToken);
      legacy.setMerged(true);
      result = playerRepo.saveAndFlush(legacy);
      mode = "claim";

    } else if (legacy == null) {
      // Legacy holdover, register path: an unmerged Player already exists (old auto-create code)
      // and no claimable legacy matches the form. Rename in place — preserves all FK references.
      if (playerRepo.existsByUserNameIgnoreCase(trimmedUserName)
          && !trimmedUserName.equalsIgnoreCase(existing.getUserName())) {
        return ResponseEntity.badRequest().body(Map.of("error", "用户名已被占用,请换一个"));
      }
      existing.setUserName(trimmedUserName);
      existing.setFirstName(trimmedFirstName);
      existing.setLastName(trimmedLastName);
      if (google.pictureUrl != null) {
        existing.setPictureUrl(google.pictureUrl);
      }
      existing.setToken(sessionToken);
      existing.setMerged(true);
      result = playerRepo.saveAndFlush(existing);
      mode = "legacy-register";

    } else {
      // Legacy holdover, claim path: unmerged Player + claimable legacy match. Migrate all FK
      // references from existing → legacy, then delete existing. See repository methods for the
      // four tables involved (game_session_players, round_scores, fan_discoveries, rounds.winner_id
      // / deal_in_player_id) and the monthly_skill snapshot invalidation on both sides.
      gameSessionPlayerRepo.reassignPlayer(existing.getId(), legacy.getId());
      roundScoreRepo.reassignPlayer(existing.getId(), legacy.getId());
      fanDiscoveryRepo.reassignPlayer(existing.getId(), legacy.getId());
      roundRepo.reassignWinner(existing.getId(), legacy.getId());
      roundRepo.reassignDealInPlayer(existing.getId(), legacy.getId());
      monthlySkillRepo.deleteByPlayerId(existing.getId());
      monthlySkillRepo.deleteByPlayerId(legacy.getId());

      existing.setEmail(null);
      existing.setToken(null);
      playerRepo.saveAndFlush(existing);

      legacy.setEmail(google.email);
      legacy.setPictureUrl(google.pictureUrl);
      legacy.setToken(sessionToken);
      legacy.setMerged(true);
      result = playerRepo.saveAndFlush(legacy);

      playerRepo.delete(existing);
      mode = "legacy-claim";
    }

    log.info(
        "Profile setup complete (mode={}) for username={}, id={}",
        mode,
        result.getUserName(),
        result.getId());

    return ResponseEntity.ok(Map.of("token", sessionToken, "player", result));
  }
}
