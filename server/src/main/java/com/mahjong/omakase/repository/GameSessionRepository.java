package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.SessionStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
  List<GameSession> findAllByOrderByCreatedAtDesc();

  List<GameSession> findByStatusOrderByCreatedAtDesc(SessionStatus status);

  List<GameSession> findByPlayersPlayerIdOrderByCreatedAtDesc(Long playerId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT s FROM GameSession s WHERE s.id = :id")
  Optional<GameSession> findByIdForUpdate(@Param("id") Long id);

  @Query(
      "SELECT DISTINCT YEAR(s.createdAt) AS y, MONTH(s.createdAt) AS m"
          + " FROM GameSession s WHERE s.rounds IS NOT EMPTY ORDER BY y DESC, m DESC")
  List<Object[]> findDistinctSeasons();

  @Query("SELECT s.createdAt FROM GameSession s WHERE s.rounds IS NOT EMPTY")
  List<LocalDateTime> findSessionCreationTimesWithRounds();

  /**
   * Bulk: how many completed sessions in [start, end) each player participated in for a given mode.
   * Used by tier/throne logic — replaces per-player {@code findAll}+filter scans that were O(P × S)
   * with N+1 lazy collection loads.
   */
  @Query(
      "SELECT gsp.player.id, COUNT(DISTINCT s.id) "
          + "FROM GameSession s JOIN s.players gsp "
          + "WHERE s.status = com.mahjong.omakase.model.SessionStatus.COMPLETED "
          + "AND s.gameMode = :mode "
          + "AND s.createdAt >= :start AND s.createdAt < :end "
          + "AND gsp.player IS NOT NULL "
          + "GROUP BY gsp.player.id")
  List<Object[]> countMonthlyGamesByPlayer(
      @Param("mode") GameMode mode,
      @Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);
}
