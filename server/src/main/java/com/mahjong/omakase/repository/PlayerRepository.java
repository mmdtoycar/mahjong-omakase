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
   * Finds any player whose userName/firstName/lastName all match case-insensitively, regardless of
   * email/merged state. The setup-profile flow uses this as the entry point: a match means
   * "rename/claim this row (if your Google email matches its bound email, or it is unbound)", a
   * miss means "register a new row".
   */
  @Query(
      "SELECT p FROM Player p WHERE LOWER(p.userName) = LOWER(:userName) "
          + "AND LOWER(p.firstName) = LOWER(:firstName) "
          + "AND LOWER(p.lastName) = LOWER(:lastName)")
  Optional<Player> findByExactName(
      @Param("userName") String userName,
      @Param("firstName") String firstName,
      @Param("lastName") String lastName);
}
