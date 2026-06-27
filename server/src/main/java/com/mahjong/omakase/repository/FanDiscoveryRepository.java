package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.FanDiscovery;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface FanDiscoveryRepository extends JpaRepository<FanDiscovery, Long> {
  Optional<FanDiscovery> findBySeasonAndFanName(String season, String fanName);

  Optional<FanDiscovery> findBySeasonAndFanNameAndPlayerBotFalse(String season, String fanName);

  List<FanDiscovery> findBySeason(String season);

  List<FanDiscovery> findByRoundGameSessionId(Long sessionId);

  /**
   * Native bulk FK reassign. JPQL "SET fd.player.id = :toId" is not portably supported by Hibernate
   * for path expressions in the SET clause, so we update the FK column directly.
   */
  @Modifying(clearAutomatically = true)
  @Query(
      value = "UPDATE fan_discoveries SET player_id = :toId WHERE player_id = :fromId",
      nativeQuery = true)
  void reassignPlayer(Long fromId, Long toId);
}
