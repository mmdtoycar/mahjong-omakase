package com.mahjong.omakase.config;

import jakarta.annotation.PostConstruct;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Drops columns whose entity fields were removed when the RP (积分) system was deleted.
 *
 * <p>Needed because {@code ddl-auto: update} only ever ADDS columns. {@code
 * fan_discoveries_v2.bonus_rp} was {@code NOT NULL}, so leaving it behind would make every new 番种发现
 * INSERT fail. {@code @DependsOn("entityManagerFactory")} guarantees Hibernate has finished its
 * schema update before this runs.
 *
 * <p>Safe to re-run, and safe to delete once every deployed database has booted this version at
 * least once.
 */
@Slf4j
@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class LegacySchemaCleanup {

  private static final List<String> DROP_STATEMENTS =
      List.of(
          "ALTER TABLE fan_discoveries_v2 DROP COLUMN IF EXISTS bonus_rp",
          "ALTER TABLE game_sessions DROP COLUMN IF EXISTS participation_bonus");

  private final JdbcTemplate jdbc;

  @PostConstruct
  public void dropRemovedColumns() {
    for (String sql : DROP_STATEMENTS) {
      try {
        jdbc.execute(sql);
      } catch (DataAccessException e) {
        log.warn("Legacy column cleanup failed for [{}]: {}", sql, e.getMessage());
      }
    }
  }
}
