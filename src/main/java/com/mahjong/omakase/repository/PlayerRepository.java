package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, Long> {
  boolean existsByUserName(String userName);
}
