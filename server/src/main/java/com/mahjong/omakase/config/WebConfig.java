package com.mahjong.omakase.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  // 暂时注释掉拦截器注入，等到验证通过后再启用 cutover 强鉴权
  // private final SecurityInterceptor securityInterceptor;

  @NonNull
  @Value("${app.cors.allowed-origins:http://localhost:5173}")
  private String[] allowedOrigins = new String[0];

  // public WebConfig(SecurityInterceptor securityInterceptor) {
  //   this.securityInterceptor = securityInterceptor;
  // }

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
    // 暂时不在 Spring MVC 中启用全站强鉴权拦截器，保证当前旧 API 正常提供服务
    // registry.addInterceptor(securityInterceptor).addPathPatterns("/api/**");
  }
}
