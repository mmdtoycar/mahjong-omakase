package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameSession;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
  List<GameSession> findAllByOrderByCreatedAtDesc();

  List<GameSession> findByPlayersPlayerIdOrderByCreatedAtDesc(Long playerId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT s FROM GameSession s WHERE s.id = :id")
  Optional<GameSession> findByIdForUpdate(@Param("id") Long id);

  @Query(
      "SELECT DISTINCT YEAR(s.createdAt) AS y, MONTH(s.createdAt) AS m"
          + " FROM GameSession s WHERE s.rounds IS NOT EMPTY ORDER BY y DESC, m DESC")
  List<Object[]> findDistinctSeasons();

  @Query("SELECT s.createdAt FROM GameSession s WHERE s.rounds IS NOT EMPTY")
  List<java.time.LocalDateTime> findSessionCreationTimesWithRounds();
}
