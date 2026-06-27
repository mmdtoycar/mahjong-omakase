package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Round;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoundRepository extends JpaRepository<Round, Long> {
  int countByGameSessionId(Long gameSessionId);

  /**
   * Reassign the loose-FK player references stored directly on {@code Round} (winnerId and
   * dealInPlayerId — scalar Longs, not JPA associations). Used by the auth merge flow so that
   * Riichi round-level stats (and 牌率/放铳率, accumulated via getRoundDetailsBySessions) keep resolving
   * to the surviving player after a temp Player is merged away.
   */
  @Modifying(clearAutomatically = true)
  @Query("UPDATE Round r SET r.winnerId = :toId WHERE r.winnerId = :fromId")
  void reassignWinner(@Param("fromId") Long fromId, @Param("toId") Long toId);

  @Modifying(clearAutomatically = true)
  @Query("UPDATE Round r SET r.dealInPlayerId = :toId WHERE r.dealInPlayerId = :fromId")
  void reassignDealInPlayer(@Param("fromId") Long fromId, @Param("toId") Long toId);

  @Query("SELECT MAX(r.fanCount) FROM Round r")
  Integer findMaxFanCount();

  @Query("SELECT MAX(r.fanCount) FROM Round r WHERE r.gameSession.gameMode = :mode")
  Integer findMaxFanCountByMode(@Param("mode") GameMode mode);

  List<Round> findByFanCount(Integer fanCount);

  @Query("SELECT r FROM Round r WHERE r.fanCount = :fanCount AND r.gameSession.gameMode = :mode")
  List<Round> findByFanCountAndMode(
      @Param("fanCount") Integer fanCount, @Param("mode") GameMode mode);

  @Query(
      "SELECT MAX(r.fanCount) FROM Round r JOIN r.gameSession s"
          + " WHERE s.createdAt >= :start AND s.createdAt < :end")
  Integer findMaxFanCountByDateRange(
      @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

  @Query(
      "SELECT MAX(r.fanCount) FROM Round r JOIN r.gameSession s"
          + " WHERE s.gameMode = :mode AND s.createdAt >= :start AND s.createdAt < :end")
  Integer findMaxFanCountByModeAndDateRange(
      @Param("mode") GameMode mode,
      @Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);

  @Query(
      "SELECT r FROM Round r JOIN r.gameSession s"
          + " WHERE r.fanCount = :fanCount AND s.createdAt >= :start AND s.createdAt < :end")
  List<Round> findByFanCountAndDateRange(
      @Param("fanCount") Integer fanCount,
      @Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);

  @Query(
      "SELECT r FROM Round r JOIN r.gameSession s"
          + " WHERE r.fanCount = :fanCount AND s.gameMode = :mode"
          + " AND s.createdAt >= :start AND s.createdAt < :end")
  List<Round> findByFanCountAndModeAndDateRange(
      @Param("fanCount") Integer fanCount,
      @Param("mode") GameMode mode,
      @Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);

  @Query(
      value =
          "SELECT r FROM Round r JOIN FETCH r.gameSession s ORDER BY s.createdAt ASC, r.roundNumber ASC",
      countQuery = "SELECT count(r) FROM Round r")
  Page<Round> findAllOrderByTime(Pageable pageable);

  @Query(
      "SELECT r FROM Round r JOIN FETCH r.gameSession s"
          + " WHERE s.gameMode = :mode AND s.createdAt >= :start AND s.createdAt < :end"
          + " ORDER BY s.createdAt ASC, r.roundNumber ASC")
  List<Round> findByGameModeAndSessionDateRangeOrderByTime(
      @Param("mode") GameMode mode,
      @Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);
}
