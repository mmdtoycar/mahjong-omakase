package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameSessionPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface GameSessionPlayerRepository extends JpaRepository<GameSessionPlayer, Long> {
  @Modifying
  @Query("DELETE FROM GameSessionPlayer gsp WHERE gsp.player.id = :playerId")
  void deleteByPlayerId(Long playerId);
}
