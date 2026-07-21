package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Tier;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Computes a "table strength" label from the players seated at one game.
 *
 * <p>Rules (priority top-down):
 *
 * <ol>
 *   <li>DA_SHENG 大圣之间 — 有斗战胜佛 (LV4_THRONE) 在桌
 *   <li>YU 狱之间 — ≥ 3 名齐天大圣 (LV3)
 *   <li>TAN 贪之间 — 2 名 LV3
 *   <li>HEN 狠之间 — 1 名 LV3
 *   <li>CHONG 铳之间 — 0 名 LV3
 * </ol>
 *
 * <p>Note: only GUOBIAO and RIICHI modes get a label. DONGBEI returns null (no tag in UI). The 斗战胜佛
 * tier already encodes the "top player, active ≥ 5 games this month" rule, so early each month
 * (before anyone qualifies) tables fall back to the LV3-count ladder.
 */
@Service
@RequiredArgsConstructor
public class TableStrengthService {

  public enum TableStrength {
    CHONG("铳之间"),
    HEN("狠之间"),
    TAN("贪之间"),
    YU("狱之间"),
    DA_SHENG("大圣之间");

    private final String displayName;

    TableStrength(String displayName) {
      this.displayName = displayName;
    }

    public String getDisplayName() {
      return displayName;
    }
  }

  private final TierService tierService;

  /**
   * Compute the table strength label for a session's seated players. Returns null for DONGBEI.
   *
   * @param sessionDate session's createdAt (UTC) — tier is resolved for THAT month, so historical
   *     sessions get the label they should have had at the time, not what they'd be under today's
   *     ratings.
   */
  public TableStrength compute(List<Player> players, GameMode mode, LocalDateTime sessionDate) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return null;
    Map<Long, Tier> tierByPlayer =
        sessionDate != null ? tierService.resolveTiersForDate(mode, sessionDate) : Map.of();
    return compute(players, mode, tierByPlayer);
  }

  /**
   * Precomputed-map overload — caller provides the per-(mode, month) tier map so a request that
   * summarizes many sessions doesn't redo {@code resolveTiersForDate} per session. {@link
   * GameService#getAllSessionSummaries} groups sessions by (mode, PT year-month) and reuses one map
   * per group.
   */
  public TableStrength compute(List<Player> players, GameMode mode, Map<Long, Tier> tierByPlayer) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return null;
    if (players == null) return TableStrength.CHONG;
    Map<Long, Tier> safeTiers = tierByPlayer != null ? tierByPlayer : Map.of();

    List<Player> humans = players.stream().filter(p -> p != null && !p.isBot()).toList();
    if (humans.size() < 2) return TableStrength.CHONG;

    boolean hasThrone = false;
    int lv3Count = 0;
    for (Player p : humans) {
      Tier t = safeTiers.getOrDefault(p.getId(), tierService.computeTier(p, mode));
      if (t == Tier.LV4_THRONE) {
        hasThrone = true;
      } else if (t == Tier.LV3) {
        lv3Count++;
      }
    }

    if (hasThrone) return TableStrength.DA_SHENG;
    if (lv3Count >= 3) return TableStrength.YU;
    if (lv3Count == 2) return TableStrength.TAN;
    if (lv3Count == 1) return TableStrength.HEN;
    return TableStrength.CHONG;
  }
}
