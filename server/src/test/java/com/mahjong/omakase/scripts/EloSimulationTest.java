package com.mahjong.omakase.scripts;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * One-off ELO simulation against the production DB snapshot at data-prod/.
 *
 * <p>Run with: ./gradlew test --tests EloSimulationTest --rerun-tasks
 *
 * <p>This is intentionally NOT a regular test — it reads from a local DB file copy and prints
 * results to stdout. It does not assert anything and does not modify the DB.
 */
public class EloSimulationTest {

  // Aggressive K for faster convergence given small monthly volume (~100-200 games)
  private static final double INITIAL_RATING = 1500.0;
  private static final double K_NEW = 48.0; // first 10 games
  private static final double K_STABLE = 24.0; // standard
  private static final int NEW_PLAYER_GAMES = 10;
  private static final double TANH_SCALE = 2.0; // less softening → bigger swings

  private static final List<String> MODES = Arrays.asList("GUOBIAO", "RIICHI");

  @Test
  public void runSimulation() throws Exception {
    String cwd = System.getProperty("user.dir");
    String dbPath =
        cwd.endsWith("/server")
            ? cwd + "/../data-prod/mahjong-omakase"
            : cwd + "/data-prod/mahjong-omakase";
    java.io.File dbFile = new java.io.File(dbPath + ".mv.db");
    if (!dbFile.exists()) {
      System.out.println(
          "[EloSimulationTest] "
              + dbFile.getAbsolutePath()
              + " not found — skipping (local-only design tool).");
      return;
    }
    String dbUrl = "jdbc:h2:file:" + dbPath + ";ACCESS_MODE_DATA=r;IFEXISTS=TRUE";

    Class.forName("org.h2.Driver");
    try (Connection conn = DriverManager.getConnection(dbUrl, "sa", "")) {
      // Load players (mirror Player.isBot(): bot column OR username == "BOT")
      Map<Long, String> playerNames = new HashMap<>();
      Set<Long> bots = new HashSet<>();
      try (Statement st = conn.createStatement();
          ResultSet rs = st.executeQuery("SELECT id, user_name, bot FROM players")) {
        while (rs.next()) {
          long id = rs.getLong("id");
          String userName = rs.getString("user_name");
          playerNames.put(id, userName);
          if (rs.getBoolean("bot") || (userName != null && userName.equalsIgnoreCase("BOT"))) {
            bots.add(id);
          }
        }
      }

      System.out.println();
      System.out.println(
          "Tunables: K_NEW=" + K_NEW + " K_STABLE=" + K_STABLE + " tanh_scale=" + TANH_SCALE);
      System.out.println("=============================================");

      for (String mode : MODES) {
        System.out.println();
        System.out.println("########  " + mode + "  ########");
        runForMode(conn, mode, playerNames, bots);
      }
    }
  }

  private void runForMode(
      Connection conn, String mode, Map<Long, String> playerNames, Set<Long> bots)
      throws Exception {
    // Load completed sessions for this mode chronologically
    List<Long> sessionIds = new ArrayList<>();
    try (PreparedStatement ps =
        conn.prepareStatement(
            "SELECT id FROM game_sessions WHERE status='COMPLETED' AND game_mode=? ORDER BY created_at ASC")) {
      ps.setString(1, mode);
      try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) sessionIds.add(rs.getLong("id"));
      }
    }

    Map<Long, Double> skill = new HashMap<>();
    Map<Long, Integer> gameCount = new HashMap<>();
    int processed = 0;
    int skipped = 0;

    for (long sid : sessionIds) {
      Map<Long, Integer> sessionScores = new HashMap<>();
      try (PreparedStatement ps =
          conn.prepareStatement(
              "SELECT rs.player_id, SUM(rs.score) "
                  + "FROM round_scores rs JOIN rounds r ON rs.round_id = r.id "
                  + "WHERE r.game_session_id = ? AND rs.player_id IS NOT NULL "
                  + "GROUP BY rs.player_id")) {
        ps.setLong(1, sid);
        try (ResultSet rs = ps.executeQuery()) {
          while (rs.next()) sessionScores.put(rs.getLong(1), rs.getInt(2));
        }
      }

      List<Map.Entry<Long, Integer>> ranked =
          sessionScores.entrySet().stream()
              .filter(e -> !bots.contains(e.getKey()))
              .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
              .collect(Collectors.toList());

      if (ranked.size() < 2) {
        skipped++;
        continue;
      }
      processed++;

      for (int i = 0; i < ranked.size(); i++) {
        for (int j = i + 1; j < ranked.size(); j++) {
          long pi = ranked.get(i).getKey();
          long pj = ranked.get(j).getKey();
          double si = skill.getOrDefault(pi, INITIAL_RATING);
          double sj = skill.getOrDefault(pj, INITIAL_RATING);
          int gi = gameCount.getOrDefault(pi, 0);
          int gj = gameCount.getOrDefault(pj, 0);

          double actual = ranked.get(i).getValue().equals(ranked.get(j).getValue()) ? 0.5 : 1.0;
          double expected = 1.0 / (1.0 + Math.pow(10, (sj - si) / 400.0));
          double rawDelta = actual - expected;
          double softDelta = Math.tanh(rawDelta * TANH_SCALE);

          double kI = (gi < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;
          double kJ = (gj < NEW_PLAYER_GAMES) ? K_NEW : K_STABLE;

          skill.put(pi, si + kI * softDelta);
          skill.put(pj, sj - kJ * softDelta);
        }
      }

      for (Map.Entry<Long, Integer> e : ranked) {
        gameCount.merge(e.getKey(), 1, Integer::sum);
      }
    }

    System.out.println(
        "  Sessions: " + sessionIds.size() + " (used " + processed + ", skipped " + skipped + ")");
    System.out.println();

    if (skill.isEmpty()) {
      System.out.println("  (no data)");
      return;
    }

    List<Long> sorted =
        skill.keySet().stream()
            .sorted(Comparator.comparingDouble(skill::get).reversed())
            .collect(Collectors.toList());

    System.out.printf("  %-20s %6s %8s%n", "Player", "Games", "Skill");
    System.out.println("  --------------------------------------");
    for (Long pid : sorted) {
      System.out.printf(
          "  %-20s %6d %8.0f%n",
          playerNames.get(pid), gameCount.getOrDefault(pid, 0), skill.get(pid));
    }

    DoubleSummaryStatistics stats =
        skill.values().stream().mapToDouble(Double::doubleValue).summaryStatistics();
    double mean = stats.getAverage();
    double[] arr = skill.values().stream().mapToDouble(Double::doubleValue).sorted().toArray();
    double median =
        arr.length % 2 == 0
            ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2.0
            : arr[arr.length / 2];
    double variance = Arrays.stream(arr).map(v -> (v - mean) * (v - mean)).sum() / arr.length;
    double stddev = Math.sqrt(variance);

    System.out.println();
    System.out.printf(
        "  Range: %.0f - %.0f (%.0f wide)%n",
        stats.getMin(), stats.getMax(), stats.getMax() - stats.getMin());
    System.out.printf("  Mean: %.0f   Median: %.0f   Std dev: %.0f%n", mean, median, stddev);

    System.out.println();
    System.out.println("  Histogram (50-pt buckets):");
    int low = ((int) stats.getMin() / 50) * 50;
    int high = ((int) stats.getMax() / 50 + 1) * 50;
    for (int b = low; b <= high; b += 50) {
      final int lo = b;
      long count = Arrays.stream(arr).filter(v -> v >= lo && v < lo + 50).count();
      System.out.printf("  %4d-%4d: %s%n", lo, lo + 50, "*".repeat((int) count));
    }
  }
}
