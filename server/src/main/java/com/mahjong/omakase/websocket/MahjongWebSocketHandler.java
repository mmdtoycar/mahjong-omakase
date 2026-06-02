package com.mahjong.omakase.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahjong.omakase.model.Player;
import com.mahjong.omakase.repository.PlayerRepository;
import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class MahjongWebSocketHandler extends TextWebSocketHandler {

  private final PlayerRepository playerRepo;
  private final ObjectMapper objectMapper = new ObjectMapper();

  // Maps WebSocket Session ID -> Player
  private final Map<String, Player> sessionPlayerMap = new ConcurrentHashMap<>();
  // Maps WebSocket Session ID -> WebSocketSession
  private final Map<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();

  public MahjongWebSocketHandler(PlayerRepository playerRepo) {
    this.playerRepo = playerRepo;
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    URI uri = session.getUri();
    if (uri == null) {
      session.close(CloseStatus.BAD_DATA);
      return;
    }

    // Extract token from query params: ?token=xxx
    String query = uri.getQuery();
    String token = null;
    if (query != null) {
      for (String param : query.split("&")) {
        String[] pair = param.split("=");
        if (pair.length == 2 && pair[0].equals("token")) {
          token = pair[1];
          break;
        }
      }
    }

    if (token == null) {
      session.close(new CloseStatus(4001, "Token required"));
      return;
    }

    Optional<Player> playerOpt = playerRepo.findByToken(token);
    if (playerOpt.isEmpty()) {
      session.close(new CloseStatus(4002, "Invalid token"));
      return;
    }

    Player player = playerOpt.get();
    sessionPlayerMap.put(session.getId(), player);
    activeSessions.put(session.getId(), session);

    // Auto sit player at first available table seat
    MahjongGameSession.INSTANCE.sitPlayerAuto(player);

    // Broadcast updated game room state to everyone
    broadcastSnapshot();
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    Player player = sessionPlayerMap.get(session.getId());
    if (player == null) return;

    Map<String, Object> payload;
    try {
      payload = objectMapper.readValue(message.getPayload(), Map.class);
    } catch (Exception e) {
      sendError(session, "Invalid message format");
      return;
    }

    String action = (String) payload.get("action");
    if (action == null) {
      sendError(session, "Action required");
      return;
    }

    MahjongGameSession game = MahjongGameSession.INSTANCE;
    int position = game.getPlayerPosition(player.getId());

    switch (action) {
      case "JOIN":
        Integer targetPos = (Integer) payload.get("position");
        if (targetPos != null && targetPos >= 0 && targetPos < 4) {
          game.sitPlayer(player, targetPos);
        } else {
          game.sitPlayerAuto(player);
        }
        break;

      case "DRAW":
        if (position == -1) {
          sendError(session, "You must be seated to draw");
          break;
        }
        if (!game.drawTile(position)) {
          sendError(session, "Cannot draw (not your turn or wall empty)");
        }
        break;

      case "DISCARD":
        if (position == -1) {
          sendError(session, "You must be seated to discard");
          break;
        }
        String tile = (String) payload.get("tile");
        if (tile == null) {
          sendError(session, "Tile required to discard");
          break;
        }
        if (!game.discardTile(position, tile)) {
          sendError(session, "Cannot discard tile (not in hand or not your turn)");
        }
        break;

      case "RESET":
        game.resetGame();
        break;

      default:
        sendError(session, "Unknown action: " + action);
        return;
    }

    broadcastSnapshot();
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
    sessionPlayerMap.remove(session.getId());
    activeSessions.remove(session.getId());
    // Note: in a friendly game, we DO NOT auto-unseat players on disconnect so they can easily
    // refresh and resume!
    broadcastSnapshot();
  }

  private void broadcastSnapshot() {
    MahjongGameSession game = MahjongGameSession.INSTANCE;
    for (Map.Entry<String, WebSocketSession> entry : activeSessions.entrySet()) {
      WebSocketSession session = entry.getValue();
      if (!session.isOpen()) continue;

      Player player = sessionPlayerMap.get(session.getId());
      if (player == null) continue;

      int position = game.getPlayerPosition(player.getId());
      Map<String, Object> snapshot = game.getSnapshot(position);

      try {
        String json = objectMapper.writeValueAsString(snapshot);
        session.sendMessage(new TextMessage(json));
      } catch (IOException e) {
        // Silently ignore or log connection send errors
      }
    }
  }

  private void sendError(WebSocketSession session, String errorMsg) {
    try {
      Map<String, String> err = new HashMap<>();
      err.put("error", errorMsg);
      session.sendMessage(new TextMessage(objectMapper.writeValueAsString(err)));
    } catch (IOException e) {
      // Ignore
    }
  }
}
