package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.Round;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoundRepository extends JpaRepository<Round, Long> {
  int countByGameSessionId(Long gameSessionId);

  @org.springframework.data.jpa.repository.Query("SELECT MAX(r.fanCount) FROM Round r")
  Integer findMaxFanCount();

  java.util.List<Round> findByFanCount(Integer fanCount);

  @org.springframework.data.jpa.repository.Query(
      "SELECT MAX(r.fanCount) FROM Round r JOIN r.gameSession s WHERE s.createdAt >= :start AND s.createdAt < :end")
  Integer findMaxFanCountByDateRange(
      @org.springframework.data.repository.query.Param("start") java.time.LocalDateTime start,
      @org.springframework.data.repository.query.Param("end") java.time.LocalDateTime end);

  @org.springframework.data.jpa.repository.Query(
      "SELECT r FROM Round r JOIN r.gameSession s WHERE r.fanCount = :fanCount AND s.createdAt >= :start AND s.createdAt < :end")
  java.util.List<Round> findByFanCountAndDateRange(
      @org.springframework.data.repository.query.Param("fanCount") Integer fanCount,
      @org.springframework.data.repository.query.Param("start") java.time.LocalDateTime start,
      @org.springframework.data.repository.query.Param("end") java.time.LocalDateTime end);
}
