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
 *   <li>FENG_HUANG_TAI 凤凰台 — ≥ 2 stable顶尖 (LV3+ AND 当月 ≥ 5 场) AND 0 LV1
 *   <li>KUN_LONG_QUE 困龙阙 — ≥ 2 LV3+ AND ≥ 1 LV1 (高低混战)
 *   <li>QI_LIN_GE 麒麟阁 — ≥ 1 LV3+ (含未达月度门槛的)
 *   <li>BAI_QUE_LIN 百雀林 — 全员 LV1 / 未定段
 *   <li>TAI_JI_DIAN 太极殿 — 其他 (LV2 居多)
 * </ol>
 *
 * <p>Note: only GUOBIAO and RIICHI modes get a label. DONGBEI returns null (no tag in UI).
 */
@Service
@RequiredArgsConstructor
public class TableStrengthService {

  /** "顶尖" 月度场数门槛 — 防止"少场高分"瞎冲凤凰台. */
  public static final int STABLE_TOP_MONTHLY_GAMES = 5;

  public enum TableStrength {
    FENG_HUANG_TAI("凤凰台"),
    QI_LIN_GE("麒麟阁"),
    TAI_JI_DIAN("太极殿"),
    KUN_LONG_QUE("困龙阙"),
    BAI_QUE_LIN("百雀林");

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
   * @param sessionDate session's createdAt (UTC) — monthly game count is taken from THAT month, so
   *     historical sessions get the label they should have had at the time, not what they'd be
   *     under today's monthly count.
   */
  public TableStrength compute(List<Player> players, GameMode mode, LocalDateTime sessionDate) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return null;
    Map<Long, Tier> tierByPlayer =
        sessionDate != null ? tierService.resolveTiersForDate(mode, sessionDate) : Map.of();
    Map<Long, Integer> monthlyByPlayer =
        sessionDate != null
            ? tierService.monthlyGamesByPlayerForReferenceDate(mode, sessionDate)
            : Map.of();
    return compute(players, mode, tierByPlayer, monthlyByPlayer);
  }

  /**
   * Precomputed-map overload — caller provides the per-(mode, month) tier and monthly-games maps so
   * a request that summarizes 150 sessions doesn't redo {@code resolveTiersForDate} + {@code
   * monthlyGamesByPlayer} 150 times. {@link GameService#getAllSessionSummaries} groups sessions by
   * (mode, PT year-month) and reuses one map per group.
   */
  public TableStrength compute(
      List<Player> players,
      GameMode mode,
      Map<Long, Tier> tierByPlayer,
      Map<Long, Integer> monthlyByPlayer) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return null;
    if (players == null) return TableStrength.BAI_QUE_LIN;

    List<Player> humans = players.stream().filter(p -> p != null && !p.isBot()).toList();
    if (humans.size() < 2) return TableStrength.BAI_QUE_LIN;

    int stableTop = 0;
    int lv3Count = 0;
    int lv1Count = 0;

    for (Player p : humans) {
      Tier t = tierByPlayer.getOrDefault(p.getId(), tierService.computeTier(p, mode));
      if (t == Tier.LV3 || t == Tier.LV4_THRONE) {
        lv3Count++;
        int monthlyGames = monthlyByPlayer.getOrDefault(p.getId(), 0);
        if (monthlyGames >= STABLE_TOP_MONTHLY_GAMES) {
          stableTop++;
        }
      }
      if (t == Tier.LV1 || t == Tier.UNRANKED) {
        lv1Count++;
      }
    }

    if (stableTop >= 2 && lv1Count == 0) return TableStrength.FENG_HUANG_TAI;
    if (lv3Count >= 2 && lv1Count >= 1) return TableStrength.KUN_LONG_QUE;
    if (lv3Count >= 1) return TableStrength.QI_LIN_GE;
    if (lv1Count == humans.size()) return TableStrength.BAI_QUE_LIN;
    return TableStrength.TAI_JI_DIAN;
  }
}
