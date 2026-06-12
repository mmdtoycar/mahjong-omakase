package com.mahjong.omakase.scheduled;

import com.mahjong.omakase.service.TierService;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the monthly skill rating snapshot + soft-reset on the 1st of each month at 00:00 PT.
 * Snapshot first (captures end-of-month state of the just-ended month), THEN soft-reset.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MonthlyResetJob {

  private static final ZoneId ZONE_PACIFIC = ZoneId.of("America/Los_Angeles");

  private final TierService tierService;

  /** Cron: minute=0 hour=0 day=1 month=* dayOfWeek=*, in America/Los_Angeles. */
  @Scheduled(cron = "0 0 0 1 * *", zone = "America/Los_Angeles")
  public void runMonthlyReset() {
    YearMonth justEnded = YearMonth.from(LocalDate.now(ZONE_PACIFIC)).minusMonths(1);
    log.info("Monthly skill snapshot + reset starting (snapshot for {})", justEnded);
    tierService.snapshotMonth(justEnded.getYear(), justEnded.getMonthValue());
    tierService.monthlyReset();
    log.info("Monthly skill snapshot + reset done");
  }
}
