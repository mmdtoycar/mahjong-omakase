package com.mahjong.omakase.config;

import java.time.Duration;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.web.client.RestClient;

/** HTTP client for Gemini, retired along with {@code TileRecognitionService}. Legacy code. */
public class GeminiClientConfig {

  public RestClient geminiRestClient(RestClient.Builder builder) {
    return builder
        .requestFactory(
            ClientHttpRequestFactories.get(
                ClientHttpRequestFactorySettings.DEFAULTS
                    // A TCP+TLS handshake to Google never legitimately needs more than this, and
                    // every second here is a second taken from the retry budget.
                    .withConnectTimeout(Duration.ofSeconds(5))
                    .withReadTimeout(Duration.ofSeconds(60))))
        .build();
  }
}
