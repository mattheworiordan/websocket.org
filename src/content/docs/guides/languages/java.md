---
title: 'Java WebSocket: Spring Boot & Jakarta EE Guide'
description:
  'Build Java WebSocket apps with Spring Boot and Jakarta EE (JSR 356). Covers
  server endpoints, STOMP messaging, client connections, security, testing, and
  production deployment.'
sidebar:
  order: 5
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
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
    - jsr 356 websocket
    - stomp websocket java
    - tyrus websocket
faq:
  - q: 'How do I add WebSockets to a Spring Boot application?'
    a:
      'Add the spring-boot-starter-websocket dependency. Create a class
      annotated with @ServerEndpoint or use Spring STOMP support with
      @EnableWebSocketMessageBroker. Spring handles the upgrade handshake and
      connection lifecycle automatically.'
  - q: 'What is JSR 356 and how does it relate to Java WebSockets?'
    a:
      'JSR 356 (Jakarta WebSocket) is the standard Java API for WebSockets. It
      defines annotations like @ServerEndpoint and @ClientEndpoint for building
      WebSocket applications. Tyrus is the reference implementation, and all
      major Java servers support it.'
  - q: 'Can I use WebSockets with Jakarta EE?'
    a:
      'Yes. Jakarta WebSocket (formerly JSR 356) is part of Jakarta EE. Annotate
      a class with @ServerEndpoint, implement @OnOpen, @OnMessage, @OnClose, and
      @OnError methods, and deploy to any Jakarta EE-compatible server like
      Tomcat, Jetty, or WildFly.'
  - q: 'How do I handle WebSocket authentication in Java?'
    a:
      'Use a HandshakeInterceptor in Spring or a Configurator in Jakarta EE to
      validate tokens during the HTTP upgrade. Check JWT tokens, session
      cookies, or custom headers before accepting the WebSocket connection.'
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
Use **Spring Boot** with `spring-boot-starter-websocket`
for the fastest setup. For Jakarta EE, annotate a class with
`@ServerEndpoint("/path")` and implement `@OnOpen`, `@OnMessage`, `@OnClose`
methods. Both approaches support the standard JSR 356 WebSocket API.
:::

Java has two main paths for WebSocket servers: Spring Boot (what most
teams already run) and Jakarta EE's `@ServerEndpoint` (when you need
protocol-level control). Most teams should start with Spring. If you are
on Java 21+, virtual threads change the scalability story entirely.

## Spring Boot WebSocket server

Add the dependency:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

Register a handler and configure allowed origins:

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

Implement the handler. Track sessions explicitly so you can clean
them up — leaked sessions are the most common source of connection
exhaustion in Java WebSocket servers:

```java
@Component
public class ChatHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions =
        ConcurrentHashMap.newKeySet();
    private final ObjectMapper json = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session, TextMessage message)
            throws Exception {
        JsonNode node = json.readTree(message.getPayload());
        String type = node.path("type").asText();

        if ("broadcast".equals(type)) {
            String payload = message.getPayload();
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    s.sendMessage(new TextMessage(payload));
                }
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

Spring also supports STOMP (a pub/sub layer on top of WebSockets) via
`@EnableWebSocketMessageBroker`. STOMP adds topic routing and message
acknowledgment, which is useful if you need fan-out to many subscribers.
For point-to-point messaging or simple broadcast, raw WebSocket handlers
are simpler and perform better — STOMP adds framing overhead and another
protocol to debug.

## Jakarta EE @ServerEndpoint

If you are not using Spring — or you want direct control over the
WebSocket lifecycle — Jakarta EE's annotation-based API works on
Tomcat, Jetty, and WildFly without framework dependencies:

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

Use `getAsyncRemote()` instead of `getBasicRemote()`. The basic
variant blocks the calling thread until the message is sent. Under
load, that blocks `@OnMessage` and backs up the container's thread
pool.

## Java 21 virtual threads

Before Java 21, every WebSocket connection consumed a platform thread.
Tomcat defaults to a pool of 200 threads, meaning 200 concurrent
connections before requests start queuing. You could increase the pool,
but each platform thread costs roughly 1 MB of stack memory, so 10,000
connections means 10 GB of stack space alone.

Virtual threads change this. They are managed by the JVM, cost a few
KB each, and yield automatically on blocking I/O. A single server can
hold hundreds of thousands of concurrent WebSocket connections without
thread pool tuning:

```java
// Spring Boot 3.2+ — enable in application.properties:
// spring.threads.virtual.enabled=true

// Or configure Tomcat directly:
@Bean
public TomcatProtocolHandlerCustomizer<?> virtualThreads() {
    return handler -> handler.setExecutor(
        Executors.newVirtualThreadPerTaskExecutor()
    );
}
```

With virtual threads enabled, blocking in `@OnMessage` handlers is no
longer a scalability risk — the virtual thread yields and the carrier
thread picks up other work. This removes the main argument for
reactive/async WebSocket stacks in Java.

If you are still on Java 17 or earlier, size your thread pool
carefully. Tomcat's `maxConnections` defaults to 8,192, but
`maxThreads` defaults to 200. Long-lived WebSocket connections hold
threads, so a mismatch between these two values leads to connection
refusals even when `maxConnections` has not been reached.

## Client connections

The standard Jakarta WebSocket client works anywhere:

```java
WebSocketContainer container =
    ContainerProvider.getWebSocketContainer();
Session session = container.connectToServer(
    new Endpoint() {
        @Override
        public void onOpen(Session s, EndpointConfig config) {
            s.addMessageHandler(String.class,
                msg -> System.out.println("Received: " + msg));
            try {
                s.getBasicRemote().sendText("hello");
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
    },
    URI.create("wss://echo.websocket.org")
);
```

For production clients, add reconnection with exponential backoff. The
connection _will_ drop — networks fail, servers restart, load
balancers recycle. Without reconnection logic, your client silently
goes dead:

```java
public void connectWithRetry(URI uri) {
    int attempt = 0;
    while (true) {
        try {
            Session session = container.connectToServer(
                endpoint, uri);
            attempt = 0; // reset on success
            awaitClose(session);
        } catch (Exception e) {
            attempt++;
            long delay = Math.min(1000L * (1 << attempt),
                30_000L);
            Thread.sleep(delay);
        }
    }
}
```

For richer client features — automatic reconnection, presence,
message history — the
[Ably Java SDK][ably-java]
provides these out of the box over WebSockets.

## Beyond raw WebSockets

A raw WebSocket gives you a bidirectional byte pipe. That is enough
for a demo. In production you quickly need:

- **Reconnection and state recovery** — the client must reconnect and
  pick up where it left off, not miss messages during the disconnect.
- **Message ordering and delivery guarantees** — TCP ordering applies
  per connection, but across reconnects, messages can be lost or
  duplicated without an application-level protocol.
- **Presence** — knowing which users are online requires heartbeats,
  timeouts, and fan-out to every other connected client.
- **Authentication and per-channel permissions** — the upgrade
  handshake is your one chance to validate a token, but capabilities
  need to be enforced per message.

Spring STOMP adds pub/sub semantics and a simple broker, but you still
own reconnection, ordering, and scaling the broker across multiple
servers. For Java teams that need these guarantees without building
them, [Ably's Pub/Sub Messaging][ably-pubsub] handles connection
management, message integrity, and global edge delivery over
WebSockets. There is a
[Java client library][ably-java] and
a [Spring integration example][ably-tutorials].

## Java-specific gotchas

**Thread pool exhaustion from leaked connections.** Every unclosed
`WebSocketSession` or `Session` holds a thread (pre-Java 21) or a
virtual thread. If your `@OnClose` or `handleTransportError` does not
remove the session from your tracking set, the session stays open,
the thread stays allocated, and eventually new connections are
refused. Always clean up in both close _and_ error handlers.

**Tomcat maxConnections vs maxThreads.** Tomcat accepts up to 8,192
connections by default but only has 200 worker threads. WebSocket
connections are long-lived, so 200 concurrent WebSockets can exhaust
the thread pool while the connection limit is barely touched. Either
increase `maxThreads`, switch to virtual threads (Java 21+), or use
NIO-based async handling.

**Blocking inside @OnMessage.** With platform threads, any blocking
call (database query, HTTP request, slow computation) inside an
`@OnMessage` handler ties up the container thread for the duration.
Under load, this cascades: threads block, the pool fills, new
messages queue, and latency spikes. Offload slow work to a separate
executor, or move to virtual threads where blocking is cheap.

**Memory per connection.** Platform threads use ~1 MB of stack each.
At 5,000 connections that is 5 GB of stack memory before you account
for session buffers, message queues, or application state. Virtual
threads reduce this to a few KB per connection. If you cannot upgrade
to Java 21, profile heap and thread usage under realistic connection
counts before going to production.

**GC pauses under high fan-out.** Broadcasting to thousands of
sessions creates thousands of short-lived `TextMessage` objects. With
default G1 settings this can trigger long young-gen pauses. Use
ZGC (Java 17+) or Shenandoah for sub-millisecond pause times on
high-throughput WebSocket servers.

## Frequently Asked Questions

### How do I add WebSockets to a Spring Boot application?

Add `spring-boot-starter-websocket` to your dependencies. Create a
`WebSocketConfigurer` that registers a `TextWebSocketHandler` at a
path. Spring handles the HTTP upgrade, connection lifecycle, and
session management. For pub/sub patterns, add
`@EnableWebSocketMessageBroker` and configure STOMP endpoints — but
only if you need topic routing. Raw handlers are simpler for
point-to-point or broadcast.

### What is JSR 356 and how does it relate to Java WebSockets?

JSR 356, now called Jakarta WebSocket, is the standard API for
WebSockets in Java. It defines `@ServerEndpoint`, `@ClientEndpoint`,
and lifecycle annotations (`@OnOpen`, `@OnMessage`, `@OnClose`,
`@OnError`). Every major servlet container implements it — Tomcat,
Jetty, WildFly, GlassFish. Spring's WebSocket support builds on top
of it but adds its own handler abstraction.

### Can I use WebSockets with Jakarta EE?

Yes. Annotate a POJO with `@ServerEndpoint("/path")`, implement the
lifecycle methods, and deploy to any Jakarta EE container. No
additional dependencies are needed — the API is part of the platform.
Tomcat and Jetty both support it in standalone mode too, outside a
full Jakarta EE server.

### How do I handle WebSocket authentication in Java?

Authenticate during the HTTP upgrade handshake, before the WebSocket
connection is established. In Spring, implement a
`HandshakeInterceptor` that checks a JWT or session cookie and rejects
the upgrade with a 403 if invalid. In Jakarta EE, use a
`ServerEndpointConfig.Configurator` to inspect headers in
`modifyHandshake()`. Do not defer authentication to the first
WebSocket message — by then the connection is open and consuming
resources.

## Related Content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) -
  The protocol underlying Java WebSocket implementations
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Browser-side API for connecting to your Java server
- [WebSocket Security](/guides/security/) - Authentication, TLS, and
  rate limiting for WebSocket servers
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Curated list including Java libraries like Tyrus and Jetty
- [WebSockets at Scale](/guides/websockets-at-scale/) - Scaling
  patterns applicable to Java WebSocket deployments

[ably-java]:
  https://ably.com/docs/getting-started/setup?lang=java&utm_source=websocket-org&utm_medium=java-websocket
[ably-pubsub]:
  https://ably.com/docs/products/channels?utm_source=websocket-org&utm_medium=java-websocket
[ably-tutorials]:
  https://ably.com/tutorials?utm_source=websocket-org&utm_medium=java-websocket
