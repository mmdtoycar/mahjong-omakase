package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.model.Tier;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Computes a "table strength" label from the players seated at one game.
 *
 * <p>Five labels:
 *
 * <ul>
 *   <li>FENG_HUANG_TAI 凤凰台 — ≥ 2 齐天大圣/斗战圣佛
 *   <li>QI_LIN_GE 麒麟阁 — 恰 1 位齐天大圣/斗战圣佛
 *   <li>BAI_QUE_LIN 百雀林 — 全员灵明石猴或未定段
 *   <li>KUN_LONG_QUE 困龙阙 — 0 顶尖, 段位差 ≥ 200
 *   <li>TAI_JI_DIAN 太极殿 — 0 顶尖, 段位差 &lt; 200
 * </ul>
 *
 * <p>Note: only GUOBIAO and RIICHI modes get a label. DONGBEI returns null (no tag in UI).
 */
@Service
@RequiredArgsConstructor
public class TableStrengthService {

  public static final double KUN_LONG_SPREAD = 200.0;

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

  /** Compute the table strength label for a session's seated players. Returns null for DONGBEI. */
  public TableStrength compute(List<Player> players, GameMode mode) {
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return null;
    if (players == null) return TableStrength.BAI_QUE_LIN;

    List<Player> humans = players.stream().filter(p -> p != null && !p.isBot()).toList();
    if (humans.size() < 2) return TableStrength.BAI_QUE_LIN;

    List<Tier> tiers = new ArrayList<>();
    double min = Double.POSITIVE_INFINITY;
    double max = Double.NEGATIVE_INFINITY;
    for (Player p : humans) {
      tiers.add(tierService.computeTier(p, mode));
      double r = mode == GameMode.GUOBIAO ? p.getSkillGuobiao() : p.getSkillRiichi();
      if (r < min) min = r;
      if (r > max) max = r;
    }

    int countTop = (int) tiers.stream().filter(t -> t == Tier.LV3 || t == Tier.LV4_THRONE).count();
    int countLowOrUnranked =
        (int) tiers.stream().filter(t -> t == Tier.LV1 || t == Tier.UNRANKED).count();

    if (countTop >= 2) return TableStrength.FENG_HUANG_TAI;
    if (countTop == 1) return TableStrength.QI_LIN_GE;
    if (countLowOrUnranked == tiers.size()) return TableStrength.BAI_QUE_LIN;
    if (max - min >= KUN_LONG_SPREAD) return TableStrength.KUN_LONG_QUE;
    return TableStrength.TAI_JI_DIAN;
  }
}
