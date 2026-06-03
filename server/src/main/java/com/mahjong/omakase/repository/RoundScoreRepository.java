package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.RoundScore;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RoundScoreRepository extends JpaRepository<RoundScore, Long> {
  @Query(
      "SELECT rs.player.id, SUM(rs.score) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.id = :sessionId GROUP BY rs.player.id")
  List<Object[]> getTotalScoresBySession(Long sessionId);

  @Query(
      "SELECT rs.player.id, COUNT(DISTINCT rs.round.gameSession.id) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.id IN :sessionIds GROUP BY rs.player.id")
  List<Object[]> getGamesPlayedPerPlayerInSessions(List<Long> sessionIds);

  @Modifying
  @Query("UPDATE RoundScore rs SET rs.player = null WHERE rs.player.id = :playerId")
  void nullifyPlayerScores(Long playerId);
}
