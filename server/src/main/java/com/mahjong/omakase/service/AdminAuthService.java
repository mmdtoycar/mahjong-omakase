package com.mahjong.omakase.service;

import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Admin authorization. Admin status is keyed off the verified Google email on the user's Player
 * row; the whitelist itself comes from the {@code app.admin-emails} config (CSV, env var {@code
 * ADMIN_EMAILS}). Empty whitelist means no admin (admin UI is unreachable until configured).
 */
@Service
public class AdminAuthService {

  private final Set<String> adminEmails;
  private final PlayerRepository playerRepo;

  public AdminAuthService(
      @Value("${app.admin-emails:}") String adminEmailsCsv, PlayerRepository playerRepo) {
    this.adminEmails =
        adminEmailsCsv == null || adminEmailsCsv.isBlank()
            ? Set.of()
            : java.util.Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    this.playerRepo = playerRepo;
  }

  public boolean isAdminEmail(String email) {
    return email != null && adminEmails.contains(email.toLowerCase(Locale.ROOT));
  }

  public boolean isAdmin(Player player) {
    return player != null && isAdminEmail(player.getEmail());
  }

  /**
   * Resolve a Bearer token to its Player iff that Player is in the admin whitelist. Returns empty
   * for missing/invalid token, unknown token, or non-admin email.
   */
  public Optional<Player> resolveAdmin(String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) return Optional.empty();
    String token = authHeader.substring(7);
    return playerRepo.findByToken(token).filter(this::isAdmin);
  }
}
