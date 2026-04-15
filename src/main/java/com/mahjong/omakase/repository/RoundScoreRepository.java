package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.RoundScore;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RoundScoreRepository extends JpaRepository<RoundScore, Long> {
  @Query(
      "SELECT rs.player.id, SUM(rs.score) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.id = :sessionId GROUP BY rs.player.id")
  List<Object[]> getTotalScoresBySession(Long sessionId);

  @Query("SELECT rs.player.id, SUM(rs.score) FROM RoundScore rs GROUP BY rs.player.id")
  List<Object[]> getTotalScoresAllTime();

  @Query(
      "SELECT rs.player.id, SUM(rs.score) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.gameMode = :gameMode GROUP BY rs.player.id")
  List<Object[]> getTotalScoresByGameMode(GameMode gameMode);

  @Query(
      "SELECT rs.player.id, SUM(rs.score) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.gameMode = :gameMode "
          + "AND rs.round.gameSession.createdAt >= :start "
          + "AND rs.round.gameSession.createdAt < :end "
          + "GROUP BY rs.player.id")
  List<Object[]> getTotalScoresByGameModeAndDateRange(
      GameMode gameMode, LocalDateTime start, LocalDateTime end);

  @Query(
      "SELECT rs.player.id, COUNT(DISTINCT rs.round.gameSession.id) FROM RoundScore rs "
          + "GROUP BY rs.player.id")
  List<Object[]> getGamesPlayedPerPlayer();

  @Query(
      "SELECT rs.player.id, COUNT(DISTINCT rs.round.gameSession.id) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.gameMode = :gameMode GROUP BY rs.player.id")
  List<Object[]> getGamesPlayedPerPlayerByGameMode(GameMode gameMode);

  @Query(
      "SELECT rs.player.id, COUNT(DISTINCT rs.round.gameSession.id) FROM RoundScore rs "
          + "WHERE rs.round.gameSession.gameMode = :gameMode "
          + "AND rs.round.gameSession.createdAt >= :start "
          + "AND rs.round.gameSession.createdAt < :end "
          + "GROUP BY rs.player.id")
  List<Object[]> getGamesPlayedPerPlayerByGameModeAndDateRange(
      GameMode gameMode, LocalDateTime start, LocalDateTime end);

  @Modifying
  @Query("UPDATE RoundScore rs SET rs.player = null WHERE rs.player.id = :playerId")
  void nullifyPlayerScores(Long playerId);
}
