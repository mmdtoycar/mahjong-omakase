package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Player;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, Long> {
  boolean existsByUserName(String userName);

  Optional<Player> findByEmail(String email);

  Optional<Player> findByToken(String token);
}
