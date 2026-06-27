package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameSessionPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface GameSessionPlayerRepository extends JpaRepository<GameSessionPlayer, Long> {
  @Modifying(clearAutomatically = true)
  @Query("DELETE FROM GameSessionPlayer gsp WHERE gsp.player.id = :playerId")
  void deleteByPlayerId(Long playerId);

  /**
   * Native bulk FK reassign. JPQL "SET gsp.player.id = :toId" is not portably supported by
   * Hibernate for path expressions in the SET clause, so we update the FK column directly.
   */
  @Modifying(clearAutomatically = true)
  @Query(
      value = "UPDATE game_session_players SET player_id = :toId WHERE player_id = :fromId",
      nativeQuery = true)
  void reassignPlayer(Long fromId, Long toId);
}
