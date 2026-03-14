---
title: 'Java WebSocket Guide: Spring Boot, Virtual Threads'
description:
  'Build WebSocket servers in Java with Spring Boot and Jakarta EE. Covers
  virtual threads (Java 21+), thread pool sizing, reconnection, and
  production gotchas.'
sidebar:
  order: 5
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-14
category: guide
keywords:
  - java websocket
  - spring boot websocket
  - jakarta ee websocket
  - java websocket server
  - java websocket client
seo:
  keywords:
    - java websocket
    - spring boot websocket
    - jakarta ee websocket
    - java websocket server
    - java websocket client
    - java 21 virtual threads websocket
    - stomp websocket java
    - tyrus websocket
faq:
  - q: 'How do I add WebSockets to a Spring Boot application?'
    a:
      'Add spring-boot-starter-websocket, create a WebSocketConfigurer
      that registers a TextWebSocketHandler, and set allowed origins.
      Spring handles the HTTP upgrade and connection lifecycle. For
      pub/sub, add @EnableWebSocketMessageBroker with STOMP.'
  - q: 'Should I use virtual threads for Java WebSocket servers?'
    a:
      'Yes, if you are on Java 21+. Set spring.threads.virtual.enabled=true
      in Spring Boot 3.2+. Virtual threads cost a few KB each versus 1 MB
      for platform threads, letting a single server hold tens of thousands
      of concurrent connections without thread pool tuning.'
  - q: 'What is the difference between Spring WebSocket and Jakarta EE?'
    a:
      'Spring WebSocket adds handler abstractions, STOMP support, and
      integration with Spring Security on top of the Jakarta WebSocket
      API. Jakarta EE @ServerEndpoint works on any servlet container
      without framework dependencies. Use Spring if you already run
      Spring Boot; use Jakarta EE for standalone deployments.'
  - q: 'How do I handle WebSocket authentication in Java?'
    a:
      'Authenticate during the HTTP upgrade handshake, before the
      connection opens. In Spring, use a HandshakeInterceptor to validate
      JWTs or session cookies. In Jakarta EE, override
      ServerEndpointConfig.Configurator.modifyHandshake(). Never defer
      auth to the first WebSocket message.'
tags:
  - websocket
  - java
  - spring
  - websocket-java
  - jakarta
  - programming
  - tutorial
  - implementation
  - guide
  - how-to
---

:::note[Quick Answer]
Use **Spring Boot** with `spring-boot-starter-websocket`. If you are on
Java 21+, enable virtual threads for massive concurrency. For standalone
containers without Spring, use Jakarta EE `@ServerEndpoint`. Both
approaches handle the WebSocket lifecycle through annotations.
:::

Most Java teams already run Spring Boot. If that is you, Spring's
WebSocket support is the obvious choice -- you get handler
abstractions, STOMP pub/sub, and Spring Security integration for
free. Jakarta EE's `@ServerEndpoint` is the right pick when you
want zero framework dependencies and direct protocol control.

## Spring Boot WebSocket server

Add the dependency:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

Register a handler with explicit origin restrictions. Leaving
`setAllowedOrigins("*")` in production is an open door for
cross-site WebSocket hijacking:

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler(), "/ws")
            .setAllowedOrigins("https://yourdomain.com");
    }

    @Bean
    public ChatHandler chatHandler() {
        return new ChatHandler();
    }
}
```

The handler tracks sessions and cleans them up on close and
error. Leaked sessions are the most common source of connection
exhaustion in Java WebSocket servers -- every unclosed session
holds a thread (or virtual thread) and a TCP connection:

```java
@Component
public class ChatHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions =
        ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session, TextMessage message)
            throws Exception {
        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.equals(session)) {
                s.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    @Override
    public void handleTransportError(
            WebSocketSession session, Throwable error) {
        sessions.remove(session);
        try { session.close(); } catch (Exception ignored) {}
    }
}
```

Spring also offers STOMP via `@EnableWebSocketMessageBroker` --
a pub/sub layer that adds topic routing and message
acknowledgment. Use it when you need fan-out to many subscribers.
For point-to-point messaging or simple broadcast, raw handlers
are simpler and faster. STOMP adds framing overhead and a second
protocol to debug.

## Jakarta EE @ServerEndpoint

If you are not using Spring, Jakarta EE's annotation API works
on Tomcat, Jetty, and WildFly without any framework:

```java
@ServerEndpoint("/chat")
public class ChatEndpoint {

    private static final Set<Session> sessions =
        ConcurrentHashMap.newKeySet();

    @OnOpen
    public void onOpen(Session session) {
        sessions.add(session);
        session.setMaxIdleTimeout(300_000); // 5 min
    }

    @OnMessage
    public void onMessage(String message, Session sender) {
        for (Session s : sessions) {
            if (s.isOpen()) {
                s.getAsyncRemote().sendText(message);
            }
        }
    }

    @OnClose
    public void onClose(Session session) {
        sessions.remove(session);
    }

    @OnError
    public void onError(Session session, Throwable error) {
        sessions.remove(session);
        try { session.close(); } catch (Exception ignored) {}
    }
}
```

Always use `getAsyncRemote()`, not `getBasicRemote()`. The basic
variant blocks the calling thread until the send completes. Under
load, that backs up your container's entire thread pool.

## Virtual threads change everything (Java 21+)

Before Java 21, each WebSocket connection consumed a platform
thread. Tomcat defaults to 200 worker threads -- that is 200
concurrent connections before requests queue. You could increase
the pool, but each platform thread costs roughly 1 MB of stack
memory. At 10,000 connections, that is 10 GB of stack alone.

Virtual threads fix this. They cost a few KB each, yield
automatically on blocking I/O, and let a single server hold
hundreds of thousands of concurrent WebSocket connections:

```java
// Spring Boot 3.2+ — one line in application.properties:
// spring.threads.virtual.enabled=true

// Or configure Tomcat directly:
@Bean
public TomcatProtocolHandlerCustomizer<?> virtualThreads() {
    return handler -> handler.setExecutor(
        Executors.newVirtualThreadPerTaskExecutor()
    );
}
```

With virtual threads, blocking in `@OnMessage` handlers is no
longer a scalability problem. The virtual thread yields and the
carrier thread picks up other work. This eliminates the main
argument for reactive WebSocket stacks in Java. If you are
starting a new project on Java 21+, skip Project Reactor and
WebFlux for WebSockets. Virtual threads give you the same
concurrency with straightforward blocking code.

If you are stuck on Java 17, size your thread pool to match your
expected connection count. Tomcat's `maxConnections` defaults to
8,192, but `maxThreads` defaults to 200. That mismatch means
connection refusals at 200 WebSocket clients while the connection
limit is barely touched.

## Client with reconnection

The Jakarta WebSocket client works anywhere:

```java
public void connectWithRetry(URI uri) {
    WebSocketContainer container =
        ContainerProvider.getWebSocketContainer();
    int attempt = 0;

    while (true) {
        try {
            Session session = container.connectToServer(
                endpoint, uri);
            attempt = 0;
            awaitClose(session); // blocks until disconnect
        } catch (Exception e) {
            attempt++;
            long delay = Math.min(
                1000L * (1 << attempt), 30_000L);
            Thread.sleep(delay); // backoff with 30s cap
        }
    }
}
```

Without reconnection logic, your client silently goes dead after
any network hiccup, server restart, or load balancer recycle.
Always reconnect with exponential backoff. Fixed-interval retries
cause connection storms -- a thousand clients reconnecting at the
same instant will bring the server right back down.

For production clients that need automatic reconnection, presence
tracking, and message history, the [Ably Java SDK][ably-java]
handles these over WebSockets without manual retry logic.

## Java-specific gotchas

**Thread pool exhaustion from leaked connections.** Every
unclosed `WebSocketSession` holds a thread (pre-Java 21) or a
virtual thread. If `@OnClose` or `handleTransportError` does not
remove the session from your tracking set, the session stays
open, the thread stays allocated, and new connections get
refused. Always clean up in both close _and_ error handlers.

**Tomcat maxConnections vs. maxThreads.** Tomcat accepts up to
8,192 connections by default but only has 200 worker threads.
WebSocket connections are long-lived, so 200 concurrent
WebSockets exhaust the thread pool while the connection limit
is barely touched. Either increase `maxThreads`, switch to
virtual threads, or use NIO-based async handling.

**Blocking inside @OnMessage.** Any blocking call -- database
query, HTTP request, slow computation -- inside `@OnMessage`
ties up the container thread. Under load, threads block, the
pool fills, messages queue, and latency spikes. Offload slow
work to a separate executor, or move to virtual threads where
blocking is cheap.

**GC pressure under high fan-out.** Broadcasting to thousands of
sessions creates thousands of short-lived `TextMessage` objects.
With G1's defaults, this triggers long young-gen pauses. Use ZGC
(Java 17+) or Shenandoah for sub-millisecond pause times on
high-throughput WebSocket servers. In our experience running
millions of WebSocket connections, GC tuning is the difference
between smooth operation and periodic latency spikes.

**Memory per connection.** Platform threads use ~1 MB of stack
each. At 5,000 connections, that is 5 GB before session buffers
or application state. Virtual threads drop this to a few KB. If
you cannot upgrade to Java 21, profile heap and thread usage
under realistic connection counts before deploying.

## Beyond raw WebSockets

A raw WebSocket gives you a bidirectional byte pipe. For a demo,
that is enough. In production you quickly need reconnection with
state recovery, message ordering across reconnects, presence,
and per-channel permissions. Spring STOMP adds pub/sub semantics,
but you still own reconnection, ordering, and scaling across
servers.

For Java teams that need these guarantees without building them,
[Ably's Pub/Sub Messaging][ably-pubsub] handles connection
management, message integrity, and global edge delivery over
WebSockets. There is a [Java client library][ably-java] and
a [Spring integration example][ably-tutorials].

## Frequently Asked Questions

### How do I add WebSockets to a Spring Boot application?

Add `spring-boot-starter-websocket` to your dependencies, create
a `WebSocketConfigurer` that registers a `TextWebSocketHandler`
at a path, and set allowed origins explicitly. Spring handles the
HTTP upgrade and session lifecycle. For pub/sub patterns, add
`@EnableWebSocketMessageBroker` with STOMP -- but only if you
need topic routing. Raw handlers are simpler and faster for
broadcast or point-to-point messaging.

### Should I use virtual threads for Java WebSocket servers?

If you are on Java 21+, yes. One property change in Spring Boot
3.2+ (`spring.threads.virtual.enabled=true`) switches the
entire server to virtual threads. Each connection costs a few KB
instead of 1 MB. You no longer need to calculate thread pool
sizes or worry about blocking in message handlers. The only
caveat: if your code uses `synchronized` blocks heavily, virtual
threads can pin to carrier threads and reduce throughput. Prefer
`ReentrantLock` in hot paths.

### What is the difference between Spring WebSocket and Jakarta EE?

Jakarta EE (the `@ServerEndpoint` API) is the standard that
every servlet container implements. Spring WebSocket builds on
it, adding its own handler abstraction, STOMP support, and
integration with Spring Security. If you already run Spring Boot,
use Spring WebSocket -- you get dependency injection, security
filters, and configuration through annotations. If you run a
standalone Tomcat or Jetty, Jakarta EE works without pulling in
Spring's dependency tree.

### How do I handle WebSocket authentication in Java?

Authenticate during the HTTP upgrade handshake, before the
WebSocket opens. In Spring, implement `HandshakeInterceptor` and
check the JWT or session cookie. Return `false` to reject with
a 403. In Jakarta EE, use a
`ServerEndpointConfig.Configurator` and override
`modifyHandshake()`. Do not defer auth to the first WebSocket
message -- by then the connection is open and consuming server
resources.

## Related Content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) -
  The protocol underlying Java WebSocket implementations
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Browser-side API for connecting to your Java server
- [WebSocket Security](/guides/security/) - Authentication, TLS,
  and rate limiting for WebSocket servers
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Curated list including Java libraries like Tyrus and Jetty
- [WebSockets at Scale](/guides/websockets-at-scale/) - Scaling
  patterns applicable to Java deployments

[ably-java]:
  https://ably.com/docs/getting-started/setup?lang=java&utm_source=websocket-org&utm_medium=java-websocket
[ably-pubsub]:
  https://ably.com/docs/products/channels?utm_source=websocket-org&utm_medium=java-websocket
[ably-tutorials]:
  https://ably.com/tutorials?utm_source=websocket-org&utm_medium=java-websocket
