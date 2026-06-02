package com.mahjong.omakase.config;

import com.mahjong.omakase.websocket.MahjongWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private final MahjongWebSocketHandler mahjongWebSocketHandler;

  public WebSocketConfig(MahjongWebSocketHandler mahjongWebSocketHandler) {
    this.mahjongWebSocketHandler = mahjongWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(mahjongWebSocketHandler, "/ws-mahjong").setAllowedOrigins("*");
  }
}
