package com.mahjong.omakase.service;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

/** Tells every open page the moment a game changes, so none of them has to keep asking. */
@Slf4j
@Component
public class SessionEvents {

  private final Set<ResponseBodyEmitter> pages = ConcurrentHashMap.newKeySet();

  public ResponseBodyEmitter subscribe() {
    ResponseBodyEmitter page = new ResponseBodyEmitter(0L);
    pages.add(page);
    page.onCompletion(() -> pages.remove(page));
    page.onTimeout(() -> pages.remove(page));
    page.onError(e -> pages.remove(page));
    send(page, "event:hello\ndata:ok\n\n");
    return page;
  }

  /** Sent once the change is committed, so a page that reloads straight away sees it. */
  public void changed() {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              broadcast();
            }
          });
    } else {
      broadcast();
    }
  }

  private void broadcast() {
    for (ResponseBodyEmitter page : pages) send(page, "event:changed\ndata:1\n\n");
  }

  /** Keeps idle connections open through proxies and notices the ones that have gone. */
  @Scheduled(fixedRate = 15000)
  public void heartbeat() {
    for (ResponseBodyEmitter page : pages) send(page, ":ping\n\n");
  }

  /**
   * Each event goes out as one write: a phone's network stack holds back tiny trailing pieces, so
   * an event sent as "event:", "data:", "1", "\n\n" would only arrive with the next one.
   */
  private void send(ResponseBodyEmitter page, String event) {
    try {
      page.send(event, MediaType.TEXT_PLAIN);
    } catch (IOException | IllegalStateException e) {
      pages.remove(page);
      log.debug("Dropped a page that stopped listening: {}", e.getMessage());
    }
  }
}
