package com.mahjong.omakase.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.GameSession;
import com.mahjong.omakase.model.SessionStatus;
import com.mahjong.omakase.repository.FanDiscoveryRepository;
import com.mahjong.omakase.repository.GameSessionPlayerRepository;
import com.mahjong.omakase.repository.GameSessionRepository;
import com.mahjong.omakase.repository.PlayerMonthlySkillRepository;
import com.mahjong.omakase.repository.PlayerRepository;
import com.mahjong.omakase.repository.RoundRepository;
import com.mahjong.omakase.repository.RoundScoreRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

/** A finished game moved everyone's ladder and game count, so deleting it must take that back. */
class GameServiceDeleteSessionTest {

  private final GameSessionRepository sessionRepo = mock(GameSessionRepository.class);
  private final TierService tierService = mock(TierService.class);
  private final GameService service =
      new GameService(
          mock(PlayerRepository.class),
          sessionRepo,
          mock(RoundRepository.class),
          mock(RoundScoreRepository.class),
          mock(GameSessionPlayerRepository.class),
          mock(FanDiscoveryRepository.class),
          tierService,
          mock(PlayerMonthlySkillRepository.class),
          mock(CacheManager.class),
          mock(RecognitionSampleStore.class),
          mock(SessionEvents.class),
          List.of());

  private GameSession session(SessionStatus status) {
    GameSession s = new GameSession();
    s.setId(366L);
    s.setGameMode(GameMode.RIICHI);
    s.setStatus(status);
    s.setCreatedAt(LocalDateTime.of(2026, 10, 8, 3, 0));
    when(sessionRepo.findById(366L)).thenReturn(Optional.of(s));
    return s;
  }

  @Test
  void deletingAFinishedGameReplaysTheLadder() {
    GameSession s = session(SessionStatus.COMPLETED);

    service.deleteSession(366L);

    verify(sessionRepo).delete(s);
    verify(tierService).backfillLadder();
  }

  @Test
  void deletingAGameStillInProgressLeavesTheLadderAlone() {
    session(SessionStatus.IN_PROGRESS);

    service.deleteSession(366L);

    verify(sessionRepo).delete(any(GameSession.class));
    verify(tierService, never()).backfillLadder();
  }
}
