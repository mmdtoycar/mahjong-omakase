package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.GameSession;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
  List<GameSession> findAllByOrderByCreatedAtDesc();
}
