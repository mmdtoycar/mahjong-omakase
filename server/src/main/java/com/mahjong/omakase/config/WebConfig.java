package com.mahjong.omakase.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  private final SecurityInterceptor securityInterceptor;

  @NonNull
  @Value("${app.cors.allowed-origins:http://localhost:5173}")
  private String[] allowedOrigins = new String[0];

  public WebConfig(SecurityInterceptor securityInterceptor) {
    this.securityInterceptor = securityInterceptor;
  }

  @Override
  public void addCorsMappings(@NonNull CorsRegistry registry) {
    registry
        .addMapping("/api/**")
        .allowedOrigins(allowedOrigins)
        .allowedMethods("GET", "POST", "PUT", "DELETE")
        .allowedHeaders("Content-Type", "X-Admin-Password", "Authorization");
  }

  @Override
  public void addInterceptors(@NonNull InterceptorRegistry registry) {
    registry.addInterceptor(securityInterceptor).addPathPatterns("/api/**");
  }
}
