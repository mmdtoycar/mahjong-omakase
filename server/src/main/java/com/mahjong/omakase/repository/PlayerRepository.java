package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Player;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerRepository extends JpaRepository<Player, Long> {
  boolean existsByUserName(String userName);

  boolean existsByUserNameIgnoreCase(String userName);

  Optional<Player> findByEmail(String email);

  Optional<Player> findByToken(String token);

  /**
   * Finds a legacy player record (no Google email bound) whose userName/firstName/lastName all
   * match case-insensitively. Used by the profile-setup flow to decide whether the user is claiming
   * an existing record or registering a fresh one.
   */
  @Query(
      "SELECT p FROM Player p WHERE LOWER(p.userName) = LOWER(:userName) "
          + "AND LOWER(p.firstName) = LOWER(:firstName) "
          + "AND LOWER(p.lastName) = LOWER(:lastName) "
          + "AND p.email IS NULL")
  Optional<Player> findClaimableLegacyPlayer(
      @Param("userName") String userName,
      @Param("firstName") String firstName,
      @Param("lastName") String lastName);
}
