package com.mahjong.omakase.service;

import com.mahjong.omakase.model.GameMode;
import com.mahjong.omakase.model.Player;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Computes a "table strength" label from the players seated at one game.
 *
 * <p>Five labels (matching桌力命名 in the design doc):
 *
 * <ul>
 *   <li>FENG_HUANG_TAI 凤凰台 — top tier (avg ≥ 1500 AND every player ranked LV3 or above)
 *   <li>QI_LIN_GE 麒麟阁 — at least one LV3+ player AND avg ≥ 1450
 *   <li>TAI_JI_DIAN 太极殿 —均势 (rating spread ≤ 80)
 *   <li>KUN_LONG_QUE 困龙阙 — 悬殊 (rating spread ≥ 200)
 *   <li>BAI_QUE_LIN 百雀林 — everyone LV1 or unranked, default fallback
 * </ul>
 *
 * <p>Note: only GUOBIAO and RIICHI ratings are used (per-mode). For unranked players (< 10 games)
 * we treat their rating as 1500 for purposes of computing 桌力 — they don't get a tier yet but they
 * still count toward the table's average/spread.
 */
@Service
@RequiredArgsConstructor
public class TableStrengthService {

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

  /** Compute the table strength label for a session's seated players. */
  public TableStrength compute(List<Player> players, GameMode mode) {
    if (players == null || players.size() < 2) return TableStrength.BAI_QUE_LIN;
    if (mode != GameMode.GUOBIAO && mode != GameMode.RIICHI) return TableStrength.TAI_JI_DIAN;

    double[] ratings =
        players.stream()
            .filter(p -> p != null && !p.isBot())
            .mapToDouble(p -> ratingFor(p, mode))
            .toArray();
    if (ratings.length < 2) return TableStrength.BAI_QUE_LIN;

    double sum = 0;
    double min = ratings[0];
    double max = ratings[0];
    int countLv3OrAbove = 0;
    int countLv1OrUnranked = 0;
    for (double r : ratings) {
      sum += r;
      if (r < min) min = r;
      if (r > max) max = r;
      if (r >= TierService.LV3_CUTOFF) countLv3OrAbove++;
      if (r < TierService.LV2_CUTOFF) countLv1OrUnranked++;
    }
    double avg = sum / ratings.length;
    double spread = max - min;

    // 凤凰台: every player is LV3+ (skill ≥ 1500) and average is high.
    if (countLv3OrAbove == ratings.length && avg >= TierService.LV3_CUTOFF) {
      return TableStrength.FENG_HUANG_TAI;
    }
    // 困龙阙: huge skill gap (≥ 200), high-low mixed
    if (spread >= 200) {
      return TableStrength.KUN_LONG_QUE;
    }
    // 麒麟阁: at least one LV3+ and avg respectable
    if (countLv3OrAbove >= 1 && avg >= 1450) {
      return TableStrength.QI_LIN_GE;
    }
    // 太极殿: 均势 (small spread)
    if (spread <= 80) {
      return TableStrength.TAI_JI_DIAN;
    }
    // 百雀林: everyone bottom-tier
    if (countLv1OrUnranked == ratings.length) {
      return TableStrength.BAI_QUE_LIN;
    }
    // Default fallback to 太极殿 (a "regular" mid-skill table)
    return TableStrength.TAI_JI_DIAN;
  }

  private double ratingFor(Player p, GameMode mode) {
    return mode == GameMode.GUOBIAO ? p.getSkillGuobiao() : p.getSkillRiichi();
  }
}
