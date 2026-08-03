package com.mahjong.omakase.config;

import java.time.Duration;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * HTTP client used to call Gemini for photo recognition.
 *
 * <p>Kept as its own bean so the timeouts live in one place and {@link
 * com.mahjong.omakase.service.TileRecognitionService} can be handed a test double.
 */
@Configuration
public class GeminiClientConfig {

  @Bean
  public RestClient geminiRestClient(RestClient.Builder builder) {
    return builder
        .requestFactory(
            ClientHttpRequestFactories.get(
                ClientHttpRequestFactorySettings.DEFAULTS
                    .withConnectTimeout(Duration.ofSeconds(10))
                    .withReadTimeout(Duration.ofSeconds(60))))
        .build();
  }
}
