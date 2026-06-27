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

  /**
   * Bulk version: one row per (sessionId, playerId, totalScore) across the given session ids.
   * Replaces N separate {@link #getTotalScoresBySession} calls in stats / player-detail loops.
   */
  @Query(
      "SELECT rs.round.gameSession.id, rs.player.id, SUM(rs.score) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.id IN :sessionIds "
          + "GROUP BY rs.round.gameSession.id, rs.player.id")
  List<Object[]> getTotalScoresBySessions(List<Long> sessionIds);

  @Query(
      "SELECT rs.player.id, COUNT(DISTINCT rs.round.gameSession.id) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.id IN :sessionIds GROUP BY rs.player.id")
  List<Object[]> getGamesPlayedPerPlayerInSessions(List<Long> sessionIds);

  /**
   * Returns one row per (round × scoring player) across the given sessions: [sessionId, roundId,
   * winnerId, dealInPlayerId, scoringPlayerId, score]. Used to compute Riichi round-level metrics
   * (和牌率/放铳率/平均打点/平均铳点) without N+1 lazy loads. Excludes rows whose player has been nulled out by
   * account deletion.
   */
  @Query(
      "SELECT r.gameSession.id, r.id, r.winnerId, r.dealInPlayerId, rs.player.id, rs.score "
          + "FROM RoundScore rs JOIN rs.round r "
          + "WHERE r.gameSession.id IN :sessionIds AND rs.player IS NOT NULL")
  List<Object[]> getRoundDetailsBySessions(List<Long> sessionIds);

  @Modifying(clearAutomatically = true)
  @Query("UPDATE RoundScore rs SET rs.player = null WHERE rs.player.id = :playerId")
  void nullifyPlayerScores(Long playerId);
}
