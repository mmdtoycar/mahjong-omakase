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
 *
 * <p>The numbers are sized against the gateway in front of us, not against Gemini: Cloudflare's
 * free plan abandons a request after 100s and answers 524, and that ceiling cannot be raised. A
 * single two-image call takes tens of seconds, so the read timeout stays generous — a slow but
 * successful call must not be cut off. What stops a failed rotation from running well past the
 * ceiling is instead {@link com.mahjong.omakase.service.TileRecognitionService#RETRY_BUDGET_MS},
 * which is paired with the read timeout below so that a timed-out attempt ends the rotation.
 */
@Configuration
public class GeminiClientConfig {

  @Bean
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
