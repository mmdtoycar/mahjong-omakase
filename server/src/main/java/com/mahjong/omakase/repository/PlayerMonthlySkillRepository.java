package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.PlayerMonthlySkill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerMonthlySkillRepository extends JpaRepository<PlayerMonthlySkill, Long> {

  List<PlayerMonthlySkill> findByModeAndYearAndMonth(GameMode mode, int year, int month);

  Optional<PlayerMonthlySkill> findByPlayerIdAndModeAndYearAndMonth(
      Long playerId, GameMode mode, int year, int month);

  @Modifying
  @Query("DELETE FROM PlayerMonthlySkill p WHERE p.player.id = :playerId")
  void deleteByPlayerId(@Param("playerId") Long playerId);
}
