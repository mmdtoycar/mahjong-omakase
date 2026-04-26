package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Round;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoundRepository extends JpaRepository<Round, Long> {
  int countByGameSessionId(Long gameSessionId);

  @org.springframework.data.jpa.repository.Query("SELECT MAX(r.fanCount) FROM Round r")
  Integer findMaxFanCount();

  java.util.List<Round> findByFanCount(Integer fanCount);
}

