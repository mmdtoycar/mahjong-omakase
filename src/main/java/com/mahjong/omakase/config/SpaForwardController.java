package com.mahjong.omakase.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaForwardController {
  @RequestMapping(
      value = {"/home", "/game", "/signup", "/new-session", "/session/**", "/stats"})
  public String forward() {
    return "forward:/index.html";
  }
}
