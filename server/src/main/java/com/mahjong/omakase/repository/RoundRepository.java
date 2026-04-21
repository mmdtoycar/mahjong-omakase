package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Round;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoundRepository extends JpaRepository<Round, Long> {
  int countByGameSessionId(Long gameSessionId);
}
