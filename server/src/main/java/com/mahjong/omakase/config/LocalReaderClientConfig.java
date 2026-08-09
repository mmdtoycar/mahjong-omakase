package com.mahjong.omakase.config;

import java.time.Duration;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * HTTP client used to call the local tile reader running beside this app.
 *
 * <p>Timeouts are an order of magnitude tighter than the Gemini client's, because the thing on the
 * other end is a sidecar on the same Docker network that answers in about half a second. Generous
 * timeouts would only turn "the reader is down" into a user staring at a spinner, when the useful
 * response to that is to fall back to Gemini quickly.
 */
@Configuration
public class LocalReaderClientConfig {

  @Bean
  public RestClient localReaderRestClient(RestClient.Builder builder) {
    return builder
        .requestFactory(
            ClientHttpRequestFactories.get(
                ClientHttpRequestFactorySettings.DEFAULTS
                    .withConnectTimeout(Duration.ofSeconds(2))
                    // A read of a 2048px photo measures ~0.5s. Ten seconds is room for a cold
                    // container and a loaded droplet, and still short enough that falling back to
                    // Gemini afterwards stays inside the gateway's 100s ceiling.
                    .withReadTimeout(Duration.ofSeconds(10))))
        .build();
  }
}
