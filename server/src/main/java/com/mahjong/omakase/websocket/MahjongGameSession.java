package com.mahjong.omakase.websocket;

import com.mahjong.omakase.model.Player;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public class MahjongGameSession {
  // Singleton global active session
  public static final MahjongGameSession INSTANCE = new MahjongGameSession();

  // Observer listener interface for push notifications
  public interface Listener {
    void onSessionUpdated();
  }

  private static final List<Listener> listeners = new ArrayList<>();

  public static synchronized void registerListener(Listener l) {
    listeners.add(l);
  }

  private static synchronized void notifyListeners() {
    for (Listener l : listeners) {
      l.onSessionUpdated();
    }
  }

  private final List<String> tilePool = new ArrayList<>();
  private final List<String> wall = new ArrayList<>();

  // 4 positions: 0=East, 1=South, 2=West, 3=North
  private final Player[] players = new Player[4];
  private final List<String>[] hands = new List[4];
  private final List<String>[] discards = new List[4];
  private final String[] melds = new String[4];

  private int activeTurn = 0; // index of active player (0-3)
  private String lastDrawnTile = null;
  private boolean gameInProgress = false;

  private MahjongGameSession() {
    // Initialize standard 136 mahjong tiles
    // Wan: 1-9m * 4
    for (int i = 1; i <= 9; i++) {
      for (int j = 0; j < 4; j++) {
        tilePool.add(i + "m");
      }
    }
    // Pin: 1-9p * 4
    for (int i = 1; i <= 9; i++) {
      for (int j = 0; j < 4; j++) {
        tilePool.add(i + "p");
      }
    }
    // Sou: 1-9s * 4
    for (int i = 1; i <= 9; i++) {
      for (int j = 0; j < 4; j++) {
        tilePool.add(i + "s");
      }
    }
    // Wind & Dragon: 1-7z * 4 (1z=East, 2z=South, 3z=West, 4z=North, 5z=Zhong, 6z=Fa, 7z=Bai)
    for (int i = 1; i <= 7; i++) {
      for (int j = 0; j < 4; j++) {
        tilePool.add(i + "z");
      }
    }

    resetGame();
  }

  public synchronized void resetGame() {
    wall.clear();
    wall.addAll(tilePool);
    Collections.shuffle(wall);

    // Initialize virtual bots for empty seats
    for (int i = 0; i < 4; i++) {
      if (players[i] == null || players[i].isBot()) {
        Player botPlayer = new Player("bot_" + i, "机器人", getWindName(i));
        botPlayer.setBot(true);
        botPlayer.setId(-10L - i); // negative IDs for virtual bots
        players[i] = botPlayer;
      }
    }

    for (int i = 0; i < 4; i++) {
      hands[i] = new ArrayList<>();
      discards[i] = new ArrayList<>();
      melds[i] = "";
    }

    // Deal 13 tiles to each sitting player
    for (int round = 0; round < 13; round++) {
      for (int i = 0; i < 4; i++) {
        if (!wall.isEmpty()) {
          hands[i].add(wall.remove(0));
        }
      }
    }

    // Sort hands for clean initial display
    for (int i = 0; i < 4; i++) {
      sortHand(hands[i]);
    }

    activeTurn = 0;
    lastDrawnTile = null;
    gameInProgress = true;

    // Trigger initial bot turn if East is a bot
    triggerBotTurnIfActive();
  }

  private String getWindName(int pos) {
    String[] winds = {"东风", "南风", "西风", "北风"};
    return winds[pos];
  }

  private void sortHand(List<String> hand) {
    hand.sort(
        (a, b) -> {
          char suiteA = a.charAt(a.length() - 1);
          char suiteB = b.charAt(b.length() - 1);
          if (suiteA != suiteB) {
            return suiteA - suiteB;
          }
          return a.compareTo(b);
        });
  }

  public synchronized boolean sitPlayer(Player player, int position) {
    if (position < 0 || position >= 4) return false;
    // Check if player already seated elsewhere (and clear old seat)
    for (int i = 0; i < 4; i++) {
      if (players[i] != null && !players[i].isBot() && players[i].getId().equals(player.getId())) {
        players[i] = null; // Unseat from old position
      }
    }
    players[position] = player;
    return true;
  }

  public synchronized boolean sitPlayerAuto(Player player) {
    // Seating logic: if already seated (non-bot), keep seat.
    for (int i = 0; i < 4; i++) {
      if (players[i] != null && !players[i].isBot() && players[i].getId().equals(player.getId())) {
        return true;
      }
    }
    // Replace the first bot seat with this human player
    for (int i = 0; i < 4; i++) {
      if (players[i] == null || players[i].isBot()) {
        players[i] = player;
        return true;
      }
    }
    return false;
  }

  public synchronized int getPlayerPosition(Long playerId) {
    for (int i = 0; i < 4; i++) {
      if (players[i] != null && players[i].getId().equals(playerId)) {
        return i;
      }
    }
    return -1;
  }

  public synchronized boolean drawTile(int position) {
    if (!gameInProgress || wall.isEmpty() || position != activeTurn) return false;
    String tile = wall.remove(0);
    hands[position].add(tile);
    lastDrawnTile = tile;
    return true;
  }

  public synchronized boolean discardTile(int position, String tile) {
    if (!gameInProgress || position != activeTurn) return false;
    List<String> hand = hands[position];
    if (hand.remove(tile)) {
      discards[position].add(tile);
      sortHand(hand);

      // Advance turn to next player
      activeTurn = (activeTurn + 1) % 4;
      lastDrawnTile = null;

      // Auto-draw for the next player if wall is not empty
      if (!wall.isEmpty()) {
        String nextTile = wall.remove(0);
        hands[activeTurn].add(nextTile);
        lastDrawnTile = nextTile;
      }

      // Async trigger the next bot turn if active
      triggerBotTurnIfActive();
      return true;
    }
    return false;
  }

  public void triggerBotTurnIfActive() {
    if (!gameInProgress) return;

    final Player activePlayer;
    synchronized (this) {
      activePlayer = players[activeTurn];
    }

    if (activePlayer != null && activePlayer.isBot()) {
      CompletableFuture.runAsync(
          () -> {
            try {
              Thread.sleep(1200); // 1.2-second thinking delay to feel natural
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }

            synchronized (this) {
              if (!gameInProgress || activeTurn != getPlayerPosition(activePlayer.getId())) {
                return;
              }

              // 1. Draw a tile if needed
              if (lastDrawnTile == null && !wall.isEmpty()) {
                drawTile(activeTurn);
                notifyListeners();

                // Wait another short delay before discarding
                try {
                  Thread.sleep(800);
                } catch (InterruptedException e2) {
                  Thread.currentThread().interrupt();
                }
              }
            }

            synchronized (this) {
              if (!gameInProgress || activeTurn != getPlayerPosition(activePlayer.getId())) {
                return;
              }

              // 2. Discard a random tile from hand
              List<String> hand = hands[activeTurn];
              if (hand != null && !hand.isEmpty()) {
                String randomTile = hand.get(new Random().nextInt(hand.size()));
                discardTile(activeTurn, randomTile);
                notifyListeners();
              }
            }
          });
    }
  }

  // Generate filtered snapshot for a specific player (position 0-3, or -1 for guests)
  public synchronized Map<String, Object> getSnapshot(int forPosition) {
    Map<String, Object> snapshot = new HashMap<>();
    snapshot.put("activeTurn", activeTurn);
    snapshot.put("wallCount", wall.size());
    snapshot.put("lastDrawnTile", lastDrawnTile);
    snapshot.put("gameInProgress", gameInProgress);

    List<Map<String, Object>> playersList = new ArrayList<>();
    for (int i = 0; i < 4; i++) {
      Map<String, Object> pInfo = new HashMap<>();
      if (players[i] != null) {
        pInfo.put("id", players[i].getId());
        pInfo.put("userName", players[i].getUserName());
        pInfo.put("displayName", players[i].getDisplayName());
        pInfo.put("pictureUrl", players[i].getPictureUrl());
      } else {
        pInfo.put("id", null);
        pInfo.put("userName", "Empty");
        pInfo.put("displayName", "等待加入...");
        pInfo.put("pictureUrl", null);
      }
      pInfo.put("position", i);
      pInfo.put("handCount", hands[i] != null ? hands[i].size() : 0);
      pInfo.put("discards", discards[i] != null ? discards[i] : new ArrayList<>());

      // Security/anti-cheat filtering: only show the actual tiles to the seat owner!
      if (i == forPosition && hands[i] != null) {
        pInfo.put("hand", hands[i]);
      } else {
        pInfo.put("hand", null); // Hidden for other players
      }
      playersList.add(pInfo);
    }
    snapshot.put("players", playersList);
    snapshot.put("myPosition", forPosition);
    return snapshot;
  }
}
