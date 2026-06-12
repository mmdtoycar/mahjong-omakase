package com.mahjong.omakase.scheduled;

import com.mahjong.omakase.service.TierService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Runs the monthly skill rating soft-reset on the 1st of each month at 00:00 PT. */
@Slf4j
@Component
@RequiredArgsConstructor
public class MonthlyResetJob {

  private final TierService tierService;

  /** Cron: minute=0 hour=0 day=1 month=* dayOfWeek=*, in America/Los_Angeles. */
  @Scheduled(cron = "0 0 0 1 * *", zone = "America/Los_Angeles")
  public void runMonthlyReset() {
    log.info("Monthly skill rating reset starting");
    tierService.monthlyReset();
    log.info("Monthly skill rating reset done");
  }
}
