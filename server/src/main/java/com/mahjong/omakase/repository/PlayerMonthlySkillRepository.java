package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.PlayerMonthlySkill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerMonthlySkillRepository extends JpaRepository<PlayerMonthlySkill, Long> {

  List<PlayerMonthlySkill> findByModeAndYearAndMonth(GameMode mode, int year, int month);

  Optional<PlayerMonthlySkill> findByPlayerIdAndModeAndYearAndMonth(
      Long playerId, GameMode mode, int year, int month);
}
