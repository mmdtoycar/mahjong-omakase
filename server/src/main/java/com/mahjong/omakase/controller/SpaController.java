package com.mahjong.omakase.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

  @GetMapping(
      value = {
        "/login",
        "/profile",
        "/game",
        "/stats",
        "/calculator",
        "/fan-table",
        "/signup",
        "/new-session",
        "/session/**",
        "/player/**",
        "/admin"
      })
  public String forwardToRoute() {
    // 允许将 SPA 的所有前端路由兜底转发到根目录 index.html
    // 保证用户在此类路由下刷新或输入路由名时绝对不会 404
    return "forward:/index.html";
  }
}
