package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameSessionPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface GameSessionPlayerRepository extends JpaRepository<GameSessionPlayer, Long> {
  @Modifying(clearAutomatically = true)
  @Query("DELETE FROM GameSessionPlayer gsp WHERE gsp.player.id = :playerId")
  void deleteByPlayerId(Long playerId);

  @Modifying(clearAutomatically = true)
  @Query("UPDATE GameSessionPlayer gsp SET gsp.player.id = :toId WHERE gsp.player.id = :fromId")
  void reassignPlayer(Long fromId, Long toId);
}
