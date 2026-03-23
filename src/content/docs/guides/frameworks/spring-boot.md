---
title: 'Spring Boot WebSocket: STOMP, Raw Handlers, Scaling'
description:
  'Build WebSocket servers in Spring Boot with STOMP messaging
  and raw WebSocketHandler. Covers security, virtual threads,
  broker relay, and multi-instance scaling.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2026-03-23'
lastUpdated: 2026-03-23
category: guide
keywords:
  - spring boot websocket
  - stomp websocket
  - spring websocket configuration
  - spring boot websocket example
  - spring websocket security
seo:
  keywords:
    - spring boot websocket
    - stomp websocket spring
    - spring websocket configuration
    - spring boot websocket example
    - spring websocket security
    - spring boot websocket scaling
    - spring boot virtual threads websocket
faq:
  - q: 'Should I use STOMP or raw WebSocket in Spring Boot?'
    a:
      'Use raw WebSocketHandler for simple bidirectional messaging
      where you control the protocol. Use STOMP when you need pub/sub
      topic routing, message broadcasting to subscribers, or broker
      relay for multi-instance scaling. STOMP adds overhead and
      complexity you may not need.'
  - q: 'Do I still need SockJS fallback in 2026?'
    a:
      'Usually not. Every modern browser supports WebSockets natively.
      The exception is corporate environments with HTTP-only proxies
      that strip Upgrade headers. If your users sit behind such
      proxies, enable SockJS. Otherwise skip it -- it adds client
      weight and complicates debugging.'
  - q: 'How do I scale Spring Boot WebSockets across multiple servers?'
    a:
      'Use STOMP broker relay with RabbitMQ or ActiveMQ. Spring
      forwards messages to the external broker, which fans out to all
      connected instances. Without a relay, messages sent on one
      server never reach clients on another.'
  - q: 'How do virtual threads improve Spring Boot WebSocket handling?'
    a:
      'Virtual threads (Java 21+, Spring Boot 3.2+) cost a few KB
      each instead of 1 MB for platform threads. Set
      spring.threads.virtual.enabled=true and each WebSocket
      connection gets its own virtual thread without exhausting the
      thread pool. Blocking in handlers becomes safe.'
  - q: 'How do I authenticate WebSocket connections in Spring Boot?'
    a:
      'Authenticate during the HTTP upgrade handshake using a
      HandshakeInterceptor or Spring Security filter chain. Extract
      the JWT or session cookie before the connection opens. Never
      defer authentication to the first WebSocket message -- the
      connection is already consuming resources.'
tags:
  - websocket
  - spring-boot
  - java
  - stomp
  - spring
  - guide
  - implementation
---

:::note[Quick Answer]
Use **raw `WebSocketHandler`** for simple bidirectional messaging.
Use **STOMP** (`@EnableWebSocketMessageBroker`) when you need
pub/sub topic routing or multi-instance scaling via broker relay.
Enable virtual threads on Java 21+ (`spring.threads.virtual.enabled=true`)
for massive concurrency without async code or thread pool tuning.
:::

Spring Boot gives you two ways to handle WebSockets: a raw
`WebSocketHandler` that gives you direct control over frames, and
STOMP over WebSocket that adds a messaging layer with topic
routing. Most tutorials jump straight to STOMP because it is
Spring's default recommendation. That is not always the right
call.

## Two approaches, different trade-offs

**Raw WebSocketHandler** maps a handler to a URL path. You receive
text or binary frames, you send frames back. No protocol on top,
no abstraction layer. You control serialization, routing, and
session management yourself.

**STOMP over WebSocket** layers the STOMP messaging protocol on
top of the WebSocket connection. Spring gives you
`@MessageMapping` annotations, a `SimpMessagingTemplate` for
sending, and topic/queue destination routing. It feels like
writing a REST controller, but for WebSocket messages.

The trade-off: STOMP adds a framing protocol, destination
parsing, and an in-memory message broker. For a chat app with
rooms and broadcast, that structure saves you weeks. For a binary
streaming service or a protocol where you already define the
message format, STOMP is overhead with no benefit.

**My recommendation:** Start with raw `WebSocketHandler` unless
you specifically need pub/sub topics or multi-instance message
fan-out through a broker relay. You can always add STOMP later.
Going the other direction -- stripping STOMP out -- is painful.

## Raw WebSocket: WebSocketConfigurer

Register a handler, set allowed origins, done. This is the
minimal setup:

```java
@Configuration
@EnableWebSocket
public class WsConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry) {
        registry.addHandler(new MyHandler(), "/ws")
                .setAllowedOrigins("https://yourdomain.com");
    }
}
```

Never use `setAllowedOrigins("*")` in production. It disables
CORS protection entirely. List your actual domains.

The handler itself:

```java
public class MyHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions =
        ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message) throws Exception {
        String payload = message.getPayload();
        // Process and respond
        session.sendMessage(
            new TextMessage("echo: " + payload));
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status) {
        sessions.remove(session);
    }
}
```

Two things to notice: the `sessions` set uses
`ConcurrentHashMap.newKeySet()` because handler methods are
called from different threads. And `afterConnectionClosed` always
fires, even on abnormal closure, so cleanup is reliable.

## STOMP: @MessageMapping and SimpMessagingTemplate

STOMP is Spring's answer to "I want pub/sub over WebSocket
without building a message router." Enable it:

```java
@Configuration
@EnableWebSocketMessageBroker
public class StompConfig
        implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(
            MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(
            StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-stomp")
                .setAllowedOrigins("https://yourdomain.com");
    }
}
```

The `enableSimpleBroker` line creates an in-memory broker that
routes messages to subscribers. `/topic` is for broadcast (one
sender, many receivers). `/queue` is for point-to-point. The
`/app` prefix routes messages to your `@MessageMapping` methods
first, so you can process before forwarding.

Handle incoming messages like REST controllers:

```java
@Controller
public class ChatController {

    private final SimpMessagingTemplate messaging;

    public ChatController(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    @MessageMapping("/chat.send")
    @SendTo("/topic/messages")
    public ChatMessage send(ChatMessage message) {
        return message; // Broadcast to /topic/messages
    }

    // Send to specific user from anywhere
    public void notifyUser(String userId, Object payload) {
        messaging.convertAndSendToUser(
            userId, "/queue/notifications", payload);
    }
}
```

The common mistake here: forgetting `@EnableWebSocketMessageBroker`
on the config class and wondering why `@MessageMapping` methods
never fire. Spring silently ignores them without the annotation.

## SockJS fallback: do you still need it?

In 2026, every modern browser supports WebSockets natively. The
WebSocket protocol has been universally supported since 2012. So
why does Spring still offer SockJS?

Corporate proxies. Some enterprise HTTP proxies strip the
`Upgrade` header, killing the WebSocket handshake. The connection
falls back to HTTP long-polling through SockJS transparently. If
your users include enterprise employees behind corporate firewalls,
enable it:

```java
registry.addEndpoint("/ws-stomp")
        .setAllowedOrigins("https://yourdomain.com")
        .withSockJS();
```

If your users are on modern networks -- consumer apps, mobile,
internal tools on a network you control -- skip SockJS. It adds
a JavaScript client library (~50 KB), complicates debugging
(you cannot tell if the connection is WebSocket or polling
without checking), and introduces its own session timeout
behavior.

## Security: authenticate at the handshake

WebSocket security in Spring Boot comes down to one principle:
authenticate during the HTTP upgrade, before the connection
opens.

A `HandshakeInterceptor` runs during the upgrade request, where
you still have access to HTTP headers and cookies:

```java
public class AuthHandshakeInterceptor
        implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Map<String, Object> attrs) {
        String token = extractToken(request);
        if (token == null || !validateJwt(token)) {
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }
        attrs.put("userId", extractUserId(token));
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Exception ex) {}
}
```

Register it on your handler:

```java
registry.addHandler(handler, "/ws")
        .addInterceptors(new AuthHandshakeInterceptor())
        .setAllowedOrigins("https://yourdomain.com");
```

For STOMP, Spring Security's `@MessageMapping` security works
too, but it validates after the connection is open. That means
unauthenticated clients hold a connection and consume resources
until the first message. Validate at the handshake to reject
early.

## Session handling: WebSocket vs HTTP

WebSocket sessions and HTTP sessions are separate objects.
Spring creates an `HttpSession` during the upgrade and passes
its attributes into the `WebSocketSession` attributes map. After
the upgrade, the `HttpSession` may expire based on its own
timeout while the WebSocket connection stays alive.

This causes a subtle bug: if your application reads from the
`HttpSession` during WebSocket message handling, it will get
stale or null data after the HTTP session expires. Store
everything you need in the `WebSocketSession` attributes during
the handshake. Do not reach back to the HTTP session.

## Scaling: STOMP broker relay

The in-memory simple broker works on a single instance. The
moment you deploy two instances behind a load balancer, messages
sent on server A never reach clients connected to server B.

The fix is STOMP broker relay. Spring forwards STOMP messages to
an external message broker (RabbitMQ or ActiveMQ) that handles
fan-out across all instances:

```java
@Override
public void configureMessageBroker(
        MessageBrokerRegistry config) {
    config.enableStompBrokerRelay("/topic", "/queue")
          .setRelayHost("rabbitmq.internal")
          .setRelayPort(61613)
          .setClientLogin("guest")
          .setClientPasscode("guest");
    config.setApplicationDestinationPrefixes("/app");
}
```

This switches from `enableSimpleBroker` to
`enableStompBrokerRelay`. RabbitMQ needs the STOMP plugin
enabled (`rabbitmq-plugins enable rabbitmq_stomp`). ActiveMQ
supports STOMP natively.

The trade-off: you now depend on an external broker. If RabbitMQ
goes down, message routing stops. Run your broker in a cluster,
monitor the STOMP relay connection, and handle reconnection to
the broker (Spring does this automatically with configurable
retry).

If you are not using STOMP, scaling raw WebSocket handlers
requires your own solution -- Redis Pub/Sub, a shared message
queue, or a service like
[Ably's Pub/Sub Messaging][ably-pubsub] that handles fan-out
and connection management across regions. Competitors like
Pusher and PubNub offer similar managed messaging, though with
different protocol and scaling approaches.

## Virtual threads (Java 21+)

Virtual threads change the economics of WebSocket handling in
Spring Boot 3.2+. One property:

```properties
spring.threads.virtual.enabled=true
```

Before virtual threads, each WebSocket connection consumed a
platform thread from Tomcat's pool (default 200). At 200
concurrent connections, the pool is full. New connections queue.
You either increase the pool (more memory -- each thread uses
~1 MB of stack) or rewrite handlers to be fully async.

Virtual threads cost a few KB each. A single server can hold
tens of thousands of concurrent WebSocket connections without
thread pool tuning. Blocking in message handlers -- a database
query, an HTTP call to another service -- is no longer a
throughput problem because the virtual thread yields its carrier
thread during blocking operations.

The caveat: `synchronized` blocks pin virtual threads to their
carrier thread. If your handler code or a library you use has
contended `synchronized` blocks, you lose the benefits. Replace
`synchronized` with `ReentrantLock` in hot paths. Spring Boot
3.2+ and most Spring libraries have already made this change
internally.

## Connection limits and thread pool sizing

Without virtual threads, you need to size thread pools:

- **Tomcat's `maxThreads`** (default 200): the ceiling for
  concurrent WebSocket connections plus HTTP requests. Increase
  it for WebSocket-heavy workloads, but each thread costs ~1 MB.
- **`maxConnections`** (default 8192 with NIO): the total
  connections Tomcat accepts. This is separate from threads --
  NIO multiplexes connections across fewer threads, but message
  handling still dispatches to the thread pool.
- **Send buffer size**: `WebSocketSession.setTextMessageSizeLimit`
  and `setBinaryMessageSizeLimit` control max frame sizes.
  Defaults are 64 KB. Large messages fragment into multiple
  frames.

With virtual threads, ignore `maxThreads` entirely. Set
`maxConnections` to your target concurrency and monitor memory
instead of thread counts.

## Common mistakes

**Blocking in WebSocket handlers.** Without virtual threads,
calling a database or external API inside `handleTextMessage`
blocks a platform thread. Under load, threads exhaust, and the
server stops accepting connections. Either use virtual threads,
offload to a separate `@Async` executor, or go fully reactive
with WebFlux.

**Missing `@EnableWebSocketMessageBroker`.** You add
`@MessageMapping` controllers but messages never arrive. Without
the broker annotation, Spring does not set up the STOMP
infrastructure. No error, no warning -- it just silently does
nothing.

**Using `setAllowedOrigins("*")`.** Every tutorial does this for
simplicity. In production, it means any website can open a
WebSocket to your server and send authenticated requests using
your users' cookies. List specific origins.

**Ignoring session cleanup.** If `afterConnectionClosed` throws
an exception, your session tracking leaks. Wrap cleanup in
try/catch. Also handle `handleTransportError` -- it fires on
network errors before the close frame arrives.

**Broadcasting with a simple broker across instances.** The
in-memory broker only knows about connections on the local JVM.
If you deploy two instances and wonder why half your users miss
messages, this is why. Switch to broker relay or externalize
message routing.

## Deployment: Tomcat vs Netty

Spring Boot's default embedded server is Tomcat, which handles
WebSockets through its NIO connector. This works well for most
applications. The alternative is Netty via Spring WebFlux, which
is fully non-blocking and handles more connections per server at
the cost of a different programming model.

**Use Tomcat (default)** when:

- Your app is mostly traditional Spring MVC with some WebSocket
  endpoints
- You are on Java 21+ with virtual threads (Tomcat + virtual
  threads matches Netty's concurrency without rewriting code)
- Your team knows servlet-based Spring

**Use Netty (WebFlux)** when:

- Your entire application is reactive
- You need the absolute maximum connections per instance
- You are already using `Mono` and `Flux` throughout

For cloud deployment, two things matter: sticky sessions and
connection draining. Load balancers must route all requests from
the same client to the same server instance (sticky sessions or
session affinity). During deploys, drain WebSocket connections
gracefully -- send a close frame, wait for clients to reconnect,
then shut down the instance. Kubernetes `preStop` hooks with a
grace period handle this:

```yaml
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 15"]
terminationGracePeriodSeconds: 30
```

The `sleep 15` gives the load balancer time to stop routing new
connections while existing connections close naturally.

## Frequently Asked Questions

### Should I use STOMP or raw WebSocket in Spring Boot?

Raw `WebSocketHandler` gives you a bidirectional byte pipe with
no protocol overhead. You parse messages, route them, and manage
subscriptions yourself. This is the right choice for binary
protocols, custom message formats, or applications where you
want full control.

STOMP adds a messaging layer: destinations (`/topic/chat`,
`/queue/notifications`), message types (SUBSCRIBE, SEND,
MESSAGE), and a header format. Spring maps this to
`@MessageMapping` methods that feel like REST controllers.
The real win is broker relay -- STOMP lets you plug in
RabbitMQ and scale to multiple instances without building
your own message fan-out.

If you are building a single-instance prototype, raw
WebSocket is simpler. If you are building a multi-instance
production system with pub/sub, STOMP saves significant work.

### Do I still need SockJS fallback in 2026?

For consumer-facing applications, no. WebSocket support in
browsers has been universal since IE10 in 2012. Mobile
browsers, Node.js, and every modern HTTP client support the
upgrade handshake.

The remaining edge case: corporate networks running
HTTP-inspecting proxies that intercept and strip `Upgrade`
headers. If your application targets enterprise users behind
such proxies, SockJS provides transparent fallback to HTTP
long-polling. Test by deploying behind your customers' network
before deciding.

### How do I scale Spring Boot WebSockets across servers?

The in-memory simple broker only knows about local connections.
Switch to `enableStompBrokerRelay` with RabbitMQ or ActiveMQ.
Spring forwards all STOMP messages to the external broker,
which routes them to every connected instance. Each instance
maintains a STOMP connection to the broker and receives
messages for its local subscribers.

For raw WebSocket (non-STOMP), you need your own pub/sub layer.
Redis Pub/Sub is the most common choice. Publish messages to
a Redis channel, subscribe from each server instance, and
forward to local WebSocket sessions.

### How do virtual threads improve WebSocket handling?

Traditional thread-per-connection models hit a wall at a few
hundred connections because each platform thread reserves ~1 MB
of stack memory. Virtual threads (Java 21+) use a few KB each
and yield their carrier thread during blocking I/O.

In practice: set `spring.threads.virtual.enabled=true` in
Spring Boot 3.2+. Each WebSocket connection gets its own
virtual thread. Blocking calls in handlers -- database reads,
HTTP calls, waiting on locks -- no longer starve the thread
pool. A single server handles tens of thousands of connections
without async code or reactive frameworks.

### How do I authenticate WebSocket connections?

Authenticate during the HTTP upgrade handshake, not after.
Implement a `HandshakeInterceptor` that extracts and validates
a JWT from the query string or a session cookie from the
`Cookie` header. Return `false` from `beforeHandshake` to
reject with a 403.

For STOMP, you can also intercept the CONNECT frame using a
`ChannelInterceptor` on the inbound channel. But the connection
is already open at that point. Prefer handshake-level auth to
reject unauthenticated clients before they consume server
resources.

## Related Content

- [Java WebSocket Guide](/guides/languages/java/) - Jakarta EE,
  Tyrus, and Java WebSocket fundamentals
- [WebSocket Security](/guides/security/) - Authentication, TLS,
  and rate limiting patterns
- [WebSockets at Scale](/guides/websockets-at-scale/) - Scaling
  patterns for high-connection-count deployments
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) -
  The RFC 6455 protocol that Spring Boot implements
- [Kubernetes WebSocket Configuration](/guides/infrastructure/kubernetes/) -
  Deploying WebSocket servers on Kubernetes

[ably-pubsub]:
  https://ably.com/docs/products/channels?utm_source=websocket-org&utm_medium=spring-boot
