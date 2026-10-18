package com.mahjong.omakase.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

import com.mahjong.omakase.service.SessionEvents;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class EventsControllerTest {

  private final SessionEvents events = new SessionEvents();
  private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new EventsController(events)).build();

  @Test
  void aPageThatIsListeningIsToldWhenAGameChanges() throws Exception {
    MvcResult stream =
        mvc.perform(get("/api/events")).andExpect(request().asyncStarted()).andReturn();

    events.changed();
    events.changed();

    String body = stream.getResponse().getContentAsString();
    assertThat(body).contains("event:hello");
    assertThat(body.split("event:changed", -1)).hasSize(3);
    assertThat(stream.getResponse().getHeader("X-Accel-Buffering")).isEqualTo("no");
  }

  @Test
  void aHeartbeatKeepsTheConnectionAlive() throws Exception {
    MvcResult stream =
        mvc.perform(get("/api/events")).andExpect(request().asyncStarted()).andReturn();

    events.heartbeat();

    assertThat(stream.getResponse().getContentAsString()).contains(":ping");
  }
}
