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

:::note[Quick Answer] Use **Spring Boot** with `spring-boot-starter-websocket`
for the fastest setup. For Jakarta EE, annotate a class with
`@ServerEndpoint("/path")` and implement `@OnOpen`, `@OnMessage`, `@OnClose`
methods. Both approaches support the standard JSR 356 WebSocket API. :::

WebSockets have revolutionized real-time communication in Java applications,
enabling bi-directional, low-latency communication between clients and servers.
This comprehensive guide covers everything you need to know about implementing
WebSockets in Java, from basic client-server connections to enterprise-grade
solutions.

Java's approach to WebSocket development reflects the language's enterprise
heritage, emphasizing robust error handling, comprehensive logging, and
integration with established architectural patterns. The ecosystem provides
multiple levels of abstraction, from low-level socket management to high-level
framework integration, allowing developers to choose the appropriate balance
between control and convenience based on their specific requirements.

The maturity of Java's WebSocket implementations means that common challenges
like connection management, message serialization, and scaling have
well-established solutions. This maturity is particularly valuable in enterprise
environments where reliability, maintainability, and integration with existing
systems are more important than cutting-edge features or minimal resource usage.

## Why Choose Java for WebSocket Development?

Java offers several compelling advantages for WebSocket development:

**Enterprise-Ready Ecosystem**: Java's mature ecosystem includes robust
frameworks like Spring Boot and Jakarta EE, providing enterprise-grade features
out of the box including security, scalability, and monitoring.

**Platform Independence**: Java's "write once, run anywhere" philosophy ensures
your WebSocket applications work across different operating systems and
environments.

**Strong Typing and IDE Support**: Java's static typing system catches errors at
compile time, while excellent IDE support provides intelligent code completion
and refactoring capabilities.

**Excellent Performance**: The JVM's optimization capabilities and garbage
collection make Java WebSocket applications performant and stable under high
load.

**Rich Library Ecosystem**: From Java-WebSocket for simple implementations to
sophisticated frameworks like Spring WebSocket and Jakarta WebSocket API, Java
offers solutions for every use case.

**Enterprise Integration**: Seamless integration with existing Java enterprise
applications, databases, and middleware systems.

The combination of these advantages makes Java particularly well-suited for
large-scale, mission-critical WebSocket applications. The language's emphasis on
backward compatibility means that WebSocket applications built today will
continue to work with future Java versions, providing long-term stability for
enterprise deployments. Additionally, Java's extensive monitoring and profiling
tools make it easier to diagnose performance issues and optimize WebSocket
applications in production environments.

## Setting Up Your Java WebSocket Project

Let's start by setting up a comprehensive Java WebSocket project structure that
can handle both client and server implementations.

Project setup in Java WebSocket development requires careful consideration of
dependencies and build configuration. The choice between Maven and Gradle often
depends on existing organizational preferences, but both build systems provide
excellent support for managing WebSocket library dependencies and handling the
complexities of multi-module projects that separate client and server concerns.

### Maven Project Setup

Create a new Maven project with the following `pom.xml` configuration:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>websocket-java-guide</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>

        <spring.boot.version>3.2.0</spring.boot.version>
        <jakarta.websocket.version>2.1.1</jakarta.websocket.version>
        <java-websocket.version>1.5.4</java-websocket.version>
        <gson.version>2.10.1</gson.version>
        <slf4j.version>2.0.9</slf4j.version>
        <logback.version>1.4.11</logback.version>
        <junit.version>5.10.0</junit.version>
        <mockito.version>5.6.0</mockito.version>
        <testcontainers.version>1.19.1</testcontainers.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring.boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <!-- Spring Boot WebSocket -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-websocket</artifactId>
        </dependency>

        <!-- Jakarta WebSocket API -->
        <dependency>
            <groupId>jakarta.websocket</groupId>
            <artifactId>jakarta.websocket-api</artifactId>
            <version>${jakarta.websocket.version}</version>
        </dependency>

        <!-- Jakarta WebSocket Client Implementation -->
        <dependency>
            <groupId>org.glassfish.tyrus</groupId>
            <artifactId>tyrus-client</artifactId>
            <version>2.1.4</version>
        </dependency>

        <!-- Java-WebSocket Library -->
        <dependency>
            <groupId>org.java-websocket</groupId>
            <artifactId>Java-WebSocket</artifactId>
            <version>${java-websocket.version}</version>
        </dependency>

        <!-- JSON Processing -->
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>${gson.version}</version>
        </dependency>

        <!-- Logging -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>${slf4j.version}</version>
        </dependency>

        <dependency>
            <groupId>ch.qos.logback</groupId>
            <artifactId>logback-classic</artifactId>
            <version>${logback.version}</version>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${junit.version}</version>
            <scope>test</scope>
        </dependency>

        <dependency>
            <groupId>org.mockito</groupId>
            <artifactId>mockito-core</artifactId>
            <version>${mockito.version}</version>
            <scope>test</scope>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>

        <!-- TestContainers for integration testing -->
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <version>${spring.boot.version}</version>
            </plugin>

            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.1</version>
            </plugin>
        </plugins>
    </build>
</project>
```

### Gradle Project Setup (Alternative)

For Gradle users, create a `build.gradle` file:

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
}

group = 'com.example'
version = '1.0.0'
java.sourceCompatibility = JavaVersion.VERSION_17

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-websocket'
    implementation 'org.java-websocket:Java-WebSocket:1.5.4'
    implementation 'jakarta.websocket:jakarta.websocket-api:2.1.1'
    implementation 'org.glassfish.tyrus:tyrus-client:2.1.4'
    implementation 'com.google.code.gson:gson:2.10.1'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testImplementation 'org.mockito:mockito-core:5.6.0'
    testImplementation 'org.testcontainers:junit-jupiter:1.19.1'
}

test {
    useJUnitPlatform()
}
```

This guide covers WebSocket implementation in Java, including Spring Boot,
Jakarta EE, native Java, and Android patterns.

## Java Client Implementation

### Using Java-WebSocket Library

The most popular standalone WebSocket client library:

```java
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import java.net.URI;
import java.net.URISyntaxException;

public class SimpleWebSocketClient extends WebSocketClient {

    public SimpleWebSocketClient(URI serverUri) {
        super(serverUri);
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        System.out.println("Connected to server");
        System.out.println("HTTP Status: " + handshake.getHttpStatus());
        System.out.println("HTTP Message: " + handshake.getHttpStatusMessage());

        // Send initial message
        send("Hello Server!");

        // Send JSON message
        send("{\"type\":\"subscribe\",\"channel\":\"updates\"}");
    }

    @Override
    public void onMessage(String message) {
        System.out.println("Received: " + message);

        // Parse JSON messages
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String type = json.get("type").getAsString();

            switch (type) {
                case "notification":
                    handleNotification(json);
                    break;
                case "data":
                    handleData(json);
                    break;
                default:
                    System.out.println("Unknown message type: " + type);
            }
        } catch (Exception e) {
            System.out.println("Plain text message: " + message);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        System.out.println("Connection closed: " + code + " - " + reason);
        System.out.println("Closed by " + (remote ? "server" : "client"));

        if (code != 1000) {
            // Abnormal closure, attempt reconnection
            scheduleReconnection();
        }
    }

    @Override
    public void onError(Exception ex) {
        System.err.println("WebSocket error: " + ex.getMessage());
        ex.printStackTrace();
    }

    // Binary message handling
    @Override
    public void onMessage(ByteBuffer bytes) {
        byte[] data = new byte[bytes.remaining()];
        bytes.get(data);
        System.out.println("Received binary data: " + data.length + " bytes");
        processBinaryData(data);
    }

    private void handleNotification(JsonObject json) {
        String message = json.get("message").getAsString();
        System.out.println("Notification: " + message);
    }

    private void handleData(JsonObject json) {
        JsonObject data = json.getAsJsonObject("data");
        System.out.println("Data received: " + data);
    }

    private void processBinaryData(byte[] data) {
        // Process binary data
    }

    private void scheduleReconnection() {
        // Implement reconnection logic
    }

    public static void main(String[] args) throws URISyntaxException {
        SimpleWebSocketClient client = new SimpleWebSocketClient(
            new URI("wss://echo.websocket.org")
        );

        // Connect with timeout
        client.setConnectionLostTimeout(10);
        client.connect();
    }
}
```

### Reconnecting WebSocket Client

Implement automatic reconnection with exponential backoff:

```java
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import java.net.URI;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class ReconnectingWebSocketClient {
    private final URI serverUri;
    private WebSocketClient client;
    private final AtomicBoolean shouldReconnect = new AtomicBoolean(true);
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private final ConcurrentLinkedQueue<String> messageQueue = new ConcurrentLinkedQueue<>();
    private Timer reconnectTimer;

    // Configuration
    private final int maxReconnectAttempts = 10;
    private final long minReconnectDelay = 1000; // 1 second
    private final long maxReconnectDelay = 30000; // 30 seconds
    private final double reconnectDecay = 1.5;

    public ReconnectingWebSocketClient(URI serverUri) {
        this.serverUri = serverUri;
        connect();
    }

    private void connect() {
        client = new WebSocketClient(serverUri) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                System.out.println("Connected successfully");
                reconnectAttempts.set(0);

                // Send queued messages
                String message;
                while ((message = messageQueue.poll()) != null) {
                    send(message);
                }

                onConnected();
            }

            @Override
            public void onMessage(String message) {
                onMessageReceived(message);
            }

            @Override
            public void onClose(int code, String reason, boolean remote) {
                System.out.println("Connection closed: " + code + " - " + reason);

                if (shouldReconnect.get() && !isMaxReconnectsReached()) {
                    scheduleReconnect();
                }

                onDisconnected(code, reason);
            }

            @Override
            public void onError(Exception ex) {
                System.err.println("WebSocket error: " + ex.getMessage());
                onErrorOccurred(ex);
            }
        };

        // Configure client
        client.setConnectionLostTimeout(10);
        client.setTcpNoDelay(true);
        client.setReuseAddr(true);

        try {
            client.connectBlocking();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Connection interrupted: " + e.getMessage());
        }
    }

    private void scheduleReconnect() {
        long delay = getReconnectDelay();
        int attempt = reconnectAttempts.incrementAndGet();

        System.out.println(String.format(
            "Reconnecting in %d ms (attempt #%d)",
            delay, attempt
        ));

        if (reconnectTimer != null) {
            reconnectTimer.cancel();
        }

        reconnectTimer = new Timer();
        reconnectTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                if (shouldReconnect.get()) {
                    connect();
                }
            }
        }, delay);
    }

    private long getReconnectDelay() {
        long delay = (long) (minReconnectDelay *
            Math.pow(reconnectDecay, reconnectAttempts.get()));
        return Math.min(delay, maxReconnectDelay);
    }

    private boolean isMaxReconnectsReached() {
        return reconnectAttempts.get() >= maxReconnectAttempts;
    }

    public void send(String message) {
        if (client != null && client.isOpen()) {
            client.send(message);
        } else {
            // Queue message for sending after reconnection
            messageQueue.offer(message);
        }
    }

    public void sendBinary(byte[] data) {
        if (client != null && client.isOpen()) {
            client.send(data);
        }
    }

    public void disconnect() {
        shouldReconnect.set(false);
        if (reconnectTimer != null) {
            reconnectTimer.cancel();
        }
        if (client != null) {
            client.close(1000, "Client disconnecting");
        }
    }

    // Override these methods for custom behavior
    protected void onConnected() {}
    protected void onMessageReceived(String message) {}
    protected void onDisconnected(int code, String reason) {}
    protected void onErrorOccurred(Exception ex) {}
}
```

### Jakarta EE WebSocket Client

Using the standard Jakarta EE WebSocket API:

```java
import jakarta.websocket.*;
import java.net.URI;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@ClientEndpoint(
    decoders = {MessageDecoder.class},
    encoders = {MessageEncoder.class},
    configurator = ClientConfigurator.class
)
public class JakartaWebSocketClient {
    private Session session;
    private final CountDownLatch connectionLatch = new CountDownLatch(1);
    private final Set<MessageHandler> messageHandlers =
        Collections.synchronizedSet(new HashSet<>());

    @OnOpen
    public void onOpen(Session session, EndpointConfig config) {
        System.out.println("Connected to server: " + session.getId());
        this.session = session;

        // Configure session
        session.setMaxIdleTimeout(60000); // 60 seconds
        session.setMaxTextMessageBufferSize(64 * 1024); // 64KB
        session.setMaxBinaryMessageBufferSize(64 * 1024); // 64KB

        connectionLatch.countDown();

        // Send initial message
        sendMessage(new Message("subscribe", "updates"));
    }

    @OnMessage
    public void onMessage(Message message, Session session) {
        System.out.println("Received message: " + message);

        // Notify all handlers
        synchronized (messageHandlers) {
            for (MessageHandler handler : messageHandlers) {
                handler.handleMessage(message);
            }
        }
    }

    @OnMessage
    public void onBinaryMessage(ByteBuffer buffer, Session session) {
        byte[] data = new byte[buffer.remaining()];
        buffer.get(data);
        System.out.println("Received binary: " + data.length + " bytes");
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        System.out.println("Connection closed: " + closeReason.getReasonPhrase());
        this.session = null;
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("WebSocket error: " + throwable.getMessage());
        throwable.printStackTrace();
    }

    public void connect(String endpoint) throws Exception {
        WebSocketContainer container = ContainerProvider.getWebSocketContainer();

        // Configure container
        container.setDefaultMaxSessionIdleTimeout(60000);
        container.setDefaultMaxTextMessageBufferSize(64 * 1024);
        container.setDefaultMaxBinaryMessageBufferSize(64 * 1024);

        // Connect with custom configuration
        ClientEndpointConfig config = ClientEndpointConfig.Builder.create()
            .preferredSubprotocols(Arrays.asList("chat", "superchat"))
            .extensions(Arrays.asList(
                new Extension() {
                    public String getName() { return "permessage-deflate"; }
                    public List<Parameter> getParameters() {
                        return Collections.emptyList();
                    }
                }
            ))
            .configurator(new ClientEndpointConfig.Configurator() {
                @Override
                public void beforeRequest(Map<String, List<String>> headers) {
                    headers.put("Authorization",
                        Arrays.asList("Bearer " + getAuthToken()));
                    headers.put("X-Custom-Header",
                        Arrays.asList("custom-value"));
                }
            })
            .build();

        session = container.connectToServer(this, config, URI.create(endpoint));

        // Wait for connection
        if (!connectionLatch.await(10, TimeUnit.SECONDS)) {
            throw new RuntimeException("Connection timeout");
        }
    }

    public void sendMessage(Message message) {
        if (session != null && session.isOpen()) {
            try {
                session.getBasicRemote().sendObject(message);
            } catch (Exception e) {
                System.err.println("Failed to send message: " + e.getMessage());
            }
        }
    }

    public void sendBinary(byte[] data) {
        if (session != null && session.isOpen()) {
            try {
                ByteBuffer buffer = ByteBuffer.wrap(data);
                session.getBasicRemote().sendBinary(buffer);
            } catch (Exception e) {
                System.err.println("Failed to send binary: " + e.getMessage());
            }
        }
    }

    public void sendAsync(Message message) {
        if (session != null && session.isOpen()) {
            session.getAsyncRemote().sendObject(message, new SendHandler() {
                @Override
                public void onResult(SendResult result) {
                    if (result.isOK()) {
                        System.out.println("Message sent successfully");
                    } else {
                        System.err.println("Failed to send: " +
                            result.getException().getMessage());
                    }
                }
            });
        }
    }

    public void addMessageHandler(MessageHandler handler) {
        messageHandlers.add(handler);
    }

    public void removeMessageHandler(MessageHandler handler) {
        messageHandlers.remove(handler);
    }

    public void disconnect() {
        if (session != null && session.isOpen()) {
            try {
                session.close(new CloseReason(
                    CloseReason.CloseCodes.NORMAL_CLOSURE,
                    "Client disconnecting"
                ));
            } catch (Exception e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
    }

    public interface MessageHandler {
        void handleMessage(Message message);
    }

    private String getAuthToken() {
        // Implement token retrieval
        return "your-auth-token";
    }
}
```

## Spring Boot WebSocket Server

### Basic Spring WebSocket Configuration

Configure WebSocket support in Spring Boot:

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.web.socket.server.standard.ServerEndpointExporter;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new SimpleWebSocketHandler(), "/ws")
            .setAllowedOrigins("*")
            .addInterceptors(new WebSocketHandshakeInterceptor());

        // With SockJS fallback
        registry.addHandler(new SimpleWebSocketHandler(), "/ws-sockjs")
            .setAllowedOrigins("*")
            .withSockJS();
    }

    @Bean
    public ServerEndpointExporter serverEndpointExporter() {
        return new ServerEndpointExporter();
    }
}

// STOMP Configuration
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketMessageBrokerConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-stomp")
            .setAllowedOriginPatterns("*")
            .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
            .setMessageSizeLimit(128 * 1024) // 128KB
            .setSendBufferSizeLimit(512 * 1024) // 512KB
            .setSendTimeLimit(20 * 1000); // 20 seconds
    }
}
```

### Spring WebSocket Handler

Implement a WebSocket handler:

```java
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class SimpleWebSocketHandler extends TextWebSocketHandler {

    private final CopyOnWriteArraySet<WebSocketSession> sessions =
        new CopyOnWriteArraySet<>();
    private final ConcurrentHashMap<String, UserSession> userSessions =
        new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);

        // Extract user information
        String userId = extractUserId(session);
        UserSession userSession = new UserSession(userId, session);
        userSessions.put(session.getId(), userSession);

        System.out.println("New connection: " + session.getId() +
            " from user: " + userId);

        // Send welcome message
        WebSocketMessage message = new WebSocketMessage("welcome",
            "Connected to WebSocket server");
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));

        // Notify other users
        broadcastUserJoined(userId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session,
                                   TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("Received: " + payload);

        try {
            WebSocketMessage wsMessage = objectMapper.readValue(
                payload, WebSocketMessage.class);

            switch (wsMessage.getType()) {
                case "broadcast":
                    handleBroadcast(session, wsMessage);
                    break;
                case "private":
                    handlePrivateMessage(session, wsMessage);
                    break;
                case "subscribe":
                    handleSubscribe(session, wsMessage);
                    break;
                case "unsubscribe":
                    handleUnsubscribe(session, wsMessage);
                    break;
                default:
                    handleCustomMessage(session, wsMessage);
            }
        } catch (Exception e) {
            sendError(session, "Invalid message format: " + e.getMessage());
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session,
                                      BinaryMessage message) throws Exception {
        byte[] payload = message.getPayload().array();
        System.out.println("Received binary: " + payload.length + " bytes");

        // Process binary data
        processBinaryData(session, payload);
    }

    @Override
    public void handleTransportError(WebSocketSession session,
                                    Throwable exception) throws Exception {
        System.err.println("Transport error for session " +
            session.getId() + ": " + exception.getMessage());

        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session,
                                     CloseStatus status) throws Exception {
        sessions.remove(session);
        UserSession userSession = userSessions.remove(session.getId());

        if (userSession != null) {
            System.out.println("Connection closed for user: " +
                userSession.getUserId() + " - " + status.toString());
            broadcastUserLeft(userSession.getUserId());
        }
    }

    private void handleBroadcast(WebSocketSession sender,
                                WebSocketMessage message) throws Exception {
        UserSession senderSession = userSessions.get(sender.getId());

        WebSocketMessage broadcastMessage = new WebSocketMessage(
            "broadcast",
            message.getPayload(),
            senderSession.getUserId()
        );

        String json = objectMapper.writeValueAsString(broadcastMessage);
        TextMessage textMessage = new TextMessage(json);

        for (WebSocketSession session : sessions) {
            if (session.isOpen() && !session.getId().equals(sender.getId())) {
                session.sendMessage(textMessage);
            }
        }
    }

    private void handlePrivateMessage(WebSocketSession sender,
                                     WebSocketMessage message) throws Exception {
        String targetUserId = message.getTargetUserId();
        UserSession targetSession = findUserSession(targetUserId);

        if (targetSession != null && targetSession.getSession().isOpen()) {
            UserSession senderSession = userSessions.get(sender.getId());

            WebSocketMessage privateMessage = new WebSocketMessage(
                "private",
                message.getPayload(),
                senderSession.getUserId()
            );

            targetSession.getSession().sendMessage(
                new TextMessage(objectMapper.writeValueAsString(privateMessage))
            );
        } else {
            sendError(sender, "User not found or offline: " + targetUserId);
        }
    }

    private void handleSubscribe(WebSocketSession session,
                                WebSocketMessage message) throws Exception {
        String channel = message.getChannel();
        UserSession userSession = userSessions.get(session.getId());
        userSession.subscribe(channel);

        sendSuccess(session, "Subscribed to channel: " + channel);
    }

    private void handleUnsubscribe(WebSocketSession session,
                                  WebSocketMessage message) throws Exception {
        String channel = message.getChannel();
        UserSession userSession = userSessions.get(session.getId());
        userSession.unsubscribe(channel);

        sendSuccess(session, "Unsubscribed from channel: " + channel);
    }

    private void handleCustomMessage(WebSocketSession session,
                                    WebSocketMessage message) throws Exception {
        // Implement custom message handling
    }

    private void processBinaryData(WebSocketSession session,
                                  byte[] data) throws Exception {
        // Process binary data
        // Example: Image processing, file upload, etc.
    }

    private void broadcastUserJoined(String userId) throws Exception {
        WebSocketMessage message = new WebSocketMessage(
            "user_joined", userId);
        broadcastToAll(message);
    }

    private void broadcastUserLeft(String userId) throws Exception {
        WebSocketMessage message = new WebSocketMessage(
            "user_left", userId);
        broadcastToAll(message);
    }

    private void broadcastToAll(WebSocketMessage message) throws Exception {
        String json = objectMapper.writeValueAsString(message);
        TextMessage textMessage = new TextMessage(json);

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(textMessage);
            }
        }
    }

    public void broadcastToChannel(String channel,
                                  WebSocketMessage message) throws Exception {
        String json = objectMapper.writeValueAsString(message);
        TextMessage textMessage = new TextMessage(json);

        for (UserSession userSession : userSessions.values()) {
            if (userSession.isSubscribed(channel) &&
                userSession.getSession().isOpen()) {
                userSession.getSession().sendMessage(textMessage);
            }
        }
    }

    private void sendError(WebSocketSession session,
                          String error) throws Exception {
        WebSocketMessage errorMessage = new WebSocketMessage("error", error);
        session.sendMessage(
            new TextMessage(objectMapper.writeValueAsString(errorMessage))
        );
    }

    private void sendSuccess(WebSocketSession session,
                            String message) throws Exception {
        WebSocketMessage successMessage = new WebSocketMessage("success", message);
        session.sendMessage(
            new TextMessage(objectMapper.writeValueAsString(successMessage))
        );
    }

    private String extractUserId(WebSocketSession session) {
        // Extract user ID from session attributes or headers
        return (String) session.getAttributes().get("userId");
    }

    private UserSession findUserSession(String userId) {
        return userSessions.values().stream()
            .filter(session -> session.getUserId().equals(userId))
            .findFirst()
            .orElse(null);
    }
}
```

### Spring STOMP Controller

Using STOMP protocol with Spring:

```java
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import java.security.Principal;

@Controller
public class WebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage,
                                  SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        System.out.println("Message from session: " + sessionId);
        return chatMessage;
    }

    @MessageMapping("/chat.private")
    @SendToUser("/queue/private")
    public ChatMessage sendPrivateMessage(@Payload ChatMessage chatMessage,
                                         Principal principal) {
        chatMessage.setSender(principal.getName());
        return chatMessage;
    }

    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload TypingMessage typing,
                            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String username = (String) headerAccessor.getSessionAttributes().get("username");

        typing.setUsername(username);

        // Send to all except sender
        messagingTemplate.convertAndSend("/topic/typing", typing);
    }

    @MessageMapping("/room.join")
    public void joinRoom(@Payload RoomMessage roomMessage,
                        SimpMessageHeaderAccessor headerAccessor,
                        Principal principal) {
        String roomId = roomMessage.getRoomId();
        String username = principal.getName();

        // Add user to room
        headerAccessor.getSessionAttributes().put("room", roomId);

        // Notify room members
        ChatMessage joinMessage = new ChatMessage();
        joinMessage.setType(ChatMessage.MessageType.JOIN);
        joinMessage.setSender(username);
        joinMessage.setContent(username + " joined the room");

        messagingTemplate.convertAndSend("/topic/room." + roomId, joinMessage);
    }

    @MessageMapping("/room.leave")
    public void leaveRoom(@Payload RoomMessage roomMessage,
                         SimpMessageHeaderAccessor headerAccessor,
                         Principal principal) {
        String roomId = roomMessage.getRoomId();
        String username = principal.getName();

        // Remove user from room
        headerAccessor.getSessionAttributes().remove("room");

        // Notify room members
        ChatMessage leaveMessage = new ChatMessage();
        leaveMessage.setType(ChatMessage.MessageType.LEAVE);
        leaveMessage.setSender(username);
        leaveMessage.setContent(username + " left the room");

        messagingTemplate.convertAndSend("/topic/room." + roomId, leaveMessage);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public String handleException(Throwable exception) {
        return exception.getMessage();
    }

    // Send message to specific user
    public void sendToUser(String username, ChatMessage message) {
        messagingTemplate.convertAndSendToUser(
            username,
            "/queue/private",
            message
        );
    }

    // Broadcast to all connected users
    public void broadcast(ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/public", message);
    }

    // Send to specific room
    public void sendToRoom(String roomId, ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/room." + roomId, message);
    }
}
```

## Android WebSocket Implementation

### OkHttp WebSocket Client

Using OkHttp for Android WebSocket connections:

```java
import okhttp3.*;
import okio.ByteString;
import java.util.concurrent.TimeUnit;
import android.os.Handler;
import android.os.Looper;

public class AndroidWebSocketClient {
    private OkHttpClient client;
    private WebSocket webSocket;
    private WebSocketListener listener;
    private Handler mainHandler;
    private boolean isConnected = false;
    private int reconnectAttempts = 0;
    private static final int MAX_RECONNECT_ATTEMPTS = 5;

    public AndroidWebSocketClient() {
        mainHandler = new Handler(Looper.getMainLooper());
        initializeClient();
    }

    private void initializeClient() {
        client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .pingInterval(20, TimeUnit.SECONDS) // Keep-alive ping
            .retryOnConnectionFailure(true)
            .build();

        listener = new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                isConnected = true;
                reconnectAttempts = 0;

                runOnMainThread(() -> {
                    onConnected();

                    // Send initial message
                    sendMessage("{\"type\":\"authenticate\",\"token\":\"" +
                        getAuthToken() + "\"}");
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                runOnMainThread(() -> onTextMessage(text));
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                runOnMainThread(() -> onBinaryMessage(bytes.toByteArray()));
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                webSocket.close(1000, null);
                isConnected = false;
                runOnMainThread(() -> onClosing(code, reason));
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                isConnected = false;
                runOnMainThread(() -> {
                    onDisconnected(code, reason);

                    if (shouldReconnect(code)) {
                        scheduleReconnect();
                    }
                });
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                isConnected = false;
                runOnMainThread(() -> {
                    onError(t);

                    if (shouldReconnect(0)) {
                        scheduleReconnect();
                    }
                });
            }
        };
    }

    public void connect(String url) {
        Request request = new Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer " + getAuthToken())
            .addHeader("X-Device-Id", getDeviceId())
            .build();

        webSocket = client.newWebSocket(request, listener);
    }

    public void sendMessage(String message) {
        if (isConnected && webSocket != null) {
            webSocket.send(message);
        } else {
            // Queue message or handle offline state
            queueMessage(message);
        }
    }

    public void sendBinary(byte[] data) {
        if (isConnected && webSocket != null) {
            webSocket.send(ByteString.of(data));
        }
    }

    public void disconnect() {
        if (webSocket != null) {
            webSocket.close(1000, "User disconnect");
        }

        // Clean up
        client.dispatcher().executorService().shutdown();
    }

    private void scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            onReconnectFailed();
            return;
        }

        reconnectAttempts++;
        long delay = getReconnectDelay();

        mainHandler.postDelayed(() -> {
            if (!isConnected) {
                connect(getCurrentUrl());
            }
        }, delay);
    }

    private long getReconnectDelay() {
        // Exponential backoff
        return (long) Math.min(30000, Math.pow(2, reconnectAttempts) * 1000);
    }

    private boolean shouldReconnect(int code) {
        // Don't reconnect for normal closure or going away
        return code != 1000 && code != 1001;
    }

    private void runOnMainThread(Runnable runnable) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            runnable.run();
        } else {
            mainHandler.post(runnable);
        }
    }

    private void queueMessage(String message) {
        // Implement message queuing for offline support
    }

    private String getAuthToken() {
        // Retrieve auth token from SharedPreferences or secure storage
        return "auth-token";
    }

    private String getDeviceId() {
        // Get unique device identifier
        return "device-id";
    }

    private String getCurrentUrl() {
        // Return current WebSocket URL
        return "wss://your-server.com/ws";
    }

    // Override these methods in your implementation
    protected void onConnected() {}
    protected void onTextMessage(String message) {}
    protected void onBinaryMessage(byte[] data) {}
    protected void onClosing(int code, String reason) {}
    protected void onDisconnected(int code, String reason) {}
    protected void onError(Throwable throwable) {}
    protected void onReconnectFailed() {}
}
```

## Testing WebSocket Applications

### JUnit Testing with Mock WebSocket

```java
import org.junit.jupiter.api.*;
import org.mockito.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class WebSocketClientTest {

    @Mock
    private WebSocketClient mockClient;

    @InjectMocks
    private ReconnectingWebSocketClient client;

    private CountDownLatch connectionLatch;
    private CountDownLatch messageLatch;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        connectionLatch = new CountDownLatch(1);
        messageLatch = new CountDownLatch(1);
    }

    @Test
    public void testConnection() throws Exception {
        // Arrange
        URI serverUri = new URI("ws://localhost:8080/ws");
        TestWebSocketClient client = new TestWebSocketClient(serverUri);

        // Act
        client.connect();
        boolean connected = connectionLatch.await(5, TimeUnit.SECONDS);

        // Assert
        assertTrue(connected, "Should connect within 5 seconds");
        assertTrue(client.isOpen(), "Connection should be open");
    }

    @Test
    public void testMessageSending() throws Exception {
        // Arrange
        String testMessage = "{\"type\":\"test\",\"data\":\"hello\"}";
        when(mockClient.isOpen()).thenReturn(true);

        // Act
        client.send(testMessage);

        // Assert
        verify(mockClient, times(1)).send(testMessage);
    }

    @Test
    public void testReconnection() throws Exception {
        // Arrange
        AtomicInteger reconnectCount = new AtomicInteger(0);

        ReconnectingWebSocketClient client = new ReconnectingWebSocketClient(
            new URI("ws://localhost:8080/ws")
        ) {
            @Override
            protected void onConnected() {
                reconnectCount.incrementAndGet();
            }
        };

        // Act - Simulate disconnect
        client.getClient().close(1006, "Network error");
        Thread.sleep(2000); // Wait for reconnection

        // Assert
        assertTrue(reconnectCount.get() > 1,
            "Should have reconnected at least once");
    }

    @Test
    public void testMessageQueuing() {
        // Arrange
        when(mockClient.isOpen()).thenReturn(false);

        // Act
        client.send("message1");
        client.send("message2");
        client.send("message3");

        // Assert
        assertEquals(3, client.getQueuedMessageCount(),
            "Should have 3 queued messages");

        // Simulate connection
        when(mockClient.isOpen()).thenReturn(true);
        client.flushMessageQueue();

        verify(mockClient, times(3)).send(anyString());
    }

    @Test
    public void testBinaryMessage() throws Exception {
        // Arrange
        byte[] testData = "binary data".getBytes();
        when(mockClient.isOpen()).thenReturn(true);

        // Act
        client.sendBinary(testData);

        // Assert
        verify(mockClient, times(1)).send(testData);
    }

    @Test
    public void testErrorHandling() {
        // Arrange
        Exception testException = new IOException("Connection failed");
        AtomicBoolean errorHandled = new AtomicBoolean(false);

        ReconnectingWebSocketClient client = new ReconnectingWebSocketClient(
            new URI("ws://localhost:8080/ws")
        ) {
            @Override
            protected void onErrorOccurred(Exception ex) {
                errorHandled.set(true);
                assertEquals(testException.getMessage(), ex.getMessage());
            }
        };

        // Act
        client.handleError(testException);

        // Assert
        assertTrue(errorHandled.get(), "Error should be handled");
    }

    private class TestWebSocketClient extends WebSocketClient {
        public TestWebSocketClient(URI serverUri) {
            super(serverUri);
        }

        @Override
        public void onOpen(ServerHandshake handshake) {
            connectionLatch.countDown();
        }

        @Override
        public void onMessage(String message) {
            messageLatch.countDown();
        }

        @Override
        public void onClose(int code, String reason, boolean remote) {}

        @Override
        public void onError(Exception ex) {}
    }
}
```

## Performance Optimization

Performance optimization in Java WebSocket applications involves multiple
layers, from JVM tuning to application-level optimizations. Java's mature
ecosystem provides sophisticated tools for profiling and monitoring WebSocket
applications, making it easier to identify bottlenecks and optimize performance
systematically.

The JVM's just-in-time compilation means that WebSocket applications typically
exhibit improved performance over time as the JIT compiler optimizes frequently
executed code paths. This characteristic makes Java particularly well-suited for
long-running WebSocket servers where the initial startup cost is amortized over
extended periods of operation.

### Connection Pooling

Managing multiple WebSocket connections efficiently is crucial for
high-performance applications. Connection pooling in Java WebSocket applications
involves not just managing the connections themselves, but also optimizing
thread usage, memory allocation patterns, and resource cleanup to maintain
optimal performance under varying load conditions:

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

public class WebSocketConnectionPool {
    private final ConcurrentHashMap<String, WebSocketConnection> activeConnections;
    private final BlockingQueue<String> availableConnections;
    private final ExecutorService executorService;
    private final int maxConnections;
    private final String serverUrl;

    public WebSocketConnectionPool(String serverUrl, int maxConnections) {
        this.serverUrl = serverUrl;
        this.maxConnections = maxConnections;
        this.activeConnections = new ConcurrentHashMap<>();
        this.availableConnections = new LinkedBlockingQueue<>();
        this.executorService = Executors.newCachedThreadPool();

        initializePool();
    }

    private void initializePool() {
        for (int i = 0; i < maxConnections; i++) {
            String connectionId = createConnection();
            availableConnections.offer(connectionId);
        }
    }

    private String createConnection() {
        String connectionId = UUID.randomUUID().toString();

        try {
            WebSocketConnection connection = new WebSocketConnection(serverUrl);
            connection.connect();
            activeConnections.put(connectionId, connection);
            return connectionId;
        } catch (Exception e) {
            logger.error("Failed to create WebSocket connection: {}", e.getMessage());
            return null;
        }
    }

    public WebSocketConnection borrowConnection() throws InterruptedException {
        String connectionId = availableConnections.poll(5, TimeUnit.SECONDS);
        if (connectionId == null) {
            throw new RuntimeException("No available connections in pool");
        }

        WebSocketConnection connection = activeConnections.get(connectionId);
        if (connection == null || !connection.isConnected()) {
            // Connection is stale, create a new one
            activeConnections.remove(connectionId);
            connectionId = createConnection();
            if (connectionId == null) {
                throw new RuntimeException("Failed to create replacement connection");
            }
            connection = activeConnections.get(connectionId);
        }

        return connection;
    }

    public void returnConnection(String connectionId) {
        if (activeConnections.containsKey(connectionId)) {
            availableConnections.offer(connectionId);
        }
    }

    public void close() {
        availableConnections.clear();
        activeConnections.values().forEach(WebSocketConnection::close);
        activeConnections.clear();
        executorService.shutdown();
    }
}
```

### Message Batching and Compression

Optimize message throughput with batching and compression:

```java
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.io.ByteArrayOutputStream;
import java.util.zip.GZIPOutputStream;
import java.util.List;
import java.util.ArrayList;

public class BatchingWebSocketClient extends WebSocketClient {
    private final ConcurrentLinkedQueue<String> messageQueue = new ConcurrentLinkedQueue<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final int batchSize;
    private final long batchInterval;

    public BatchingWebSocketClient(URI serverUri, int batchSize, long batchIntervalMs) {
        super(serverUri);
        this.batchSize = batchSize;
        this.batchInterval = batchIntervalMs;

        // Schedule batch processing
        scheduler.scheduleAtFixedRate(this::processBatch,
            batchInterval, batchInterval, TimeUnit.MILLISECONDS);
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        System.out.println("Connected with batching enabled");
    }

    public void sendMessageBatched(String message) {
        messageQueue.offer(message);

        // If queue is full, process immediately
        if (messageQueue.size() >= batchSize) {
            processBatch();
        }
    }

    private void processBatch() {
        List<String> batch = new ArrayList<>();
        String message;

        // Collect messages for batch
        while (batch.size() < batchSize && (message = messageQueue.poll()) != null) {
            batch.add(message);
        }

        if (batch.isEmpty()) {
            return;
        }

        try {
            // Create batch message
            BatchMessage batchMessage = new BatchMessage(batch);
            String json = gson.toJson(batchMessage);

            // Compress if beneficial
            byte[] compressed = compress(json);
            if (compressed.length < json.getBytes().length) {
                // Send compressed binary message
                sendBinary(compressed);
            } else {
                // Send uncompressed text message
                send(json);
            }

        } catch (Exception e) {
            System.err.println("Failed to send batch: " + e.getMessage());
            // Re-queue messages for retry
            batch.forEach(messageQueue::offer);
        }
    }

    private byte[] compress(String data) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(baos)) {
            gzip.write(data.getBytes("UTF-8"));
        }
        return baos.toByteArray();
    }

    private static class BatchMessage {
        private final List<String> messages;
        private final long timestamp;
        private final boolean compressed;

        public BatchMessage(List<String> messages) {
            this.messages = messages;
            this.timestamp = System.currentTimeMillis();
            this.compressed = false;
        }

        // Getters...
    }

    public void shutdown() {
        processBatch(); // Process remaining messages
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }
    }
}
```

## Error Handling and Reconnection Strategies

Robust error handling is essential for production WebSocket applications:

```java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Supplier;

public class RobustWebSocketClient extends ReconnectingWebSocketClient {
    private final CircuitBreaker circuitBreaker;
    private final RetryPolicy retryPolicy;
    private final MetricsCollector metricsCollector;

    public RobustWebSocketClient(URI serverUri) {
        super(serverUri);
        this.circuitBreaker = new CircuitBreaker();
        this.retryPolicy = new ExponentialBackoffRetry();
        this.metricsCollector = new MetricsCollector();
    }

    @Override
    protected void onErrorOccurred(Exception ex) {
        metricsCollector.recordError(ex);
        circuitBreaker.recordFailure();

        if (ex instanceof ConnectException) {
            handleConnectionError(ex);
        } else if (ex instanceof SocketTimeoutException) {
            handleTimeoutError(ex);
        } else if (ex instanceof SecurityException) {
            handleSecurityError(ex);
        } else {
            handleGenericError(ex);
        }
    }

    private void handleConnectionError(Exception ex) {
        logger.warn("Connection error: {}", ex.getMessage());
        if (circuitBreaker.canAttemptRequest()) {
            scheduleReconnectWithBackoff();
        } else {
            logger.error("Circuit breaker open, not attempting reconnection");
            notifyErrorHandlers(new CircuitBreakerOpenException());
        }
    }

    private void handleTimeoutError(Exception ex) {
        logger.warn("Timeout error: {}", ex.getMessage());
        metricsCollector.recordTimeout();

        // Implement timeout-specific recovery
        if (getConsecutiveTimeouts() < 3) {
            increaseTimeout();
            scheduleReconnect();
        } else {
            // Switch to different server or fail fast
            handleFatalError(ex);
        }
    }

    private void handleSecurityError(Exception ex) {
        logger.error("Security error: {}", ex.getMessage());
        metricsCollector.recordSecurityError();

        // Security errors usually require user intervention
        notifyErrorHandlers(new AuthenticationException(ex));
    }

    private void handleGenericError(Exception ex) {
        logger.error("Generic error: {}", ex.getMessage(), ex);

        if (isRecoverableError(ex)) {
            scheduleReconnectWithBackoff();
        } else {
            handleFatalError(ex);
        }
    }

    private boolean isRecoverableError(Exception ex) {
        return !(ex instanceof SecurityException ||
                ex instanceof IllegalArgumentException ||
                ex instanceof OutOfMemoryError);
    }

    public CompletableFuture<Void> sendWithRetry(String message) {
        return CompletableFuture.supplyAsync(() -> {
            return retryPolicy.execute(() -> {
                if (!circuitBreaker.canAttemptRequest()) {
                    throw new CircuitBreakerOpenException();
                }

                try {
                    send(message);
                    circuitBreaker.recordSuccess();
                    return null;
                } catch (Exception e) {
                    circuitBreaker.recordFailure();
                    throw new CompletionException(e);
                }
            });
        });
    }
}

class CircuitBreaker {
    private volatile State state = State.CLOSED;
    private volatile long lastFailureTime;
    private volatile int failureCount;
    private final int failureThreshold = 5;
    private final long timeout = 60000; // 1 minute

    enum State { CLOSED, OPEN, HALF_OPEN }

    public boolean canAttemptRequest() {
        if (state == State.CLOSED) {
            return true;
        }

        if (state == State.OPEN) {
            if (System.currentTimeMillis() - lastFailureTime >= timeout) {
                state = State.HALF_OPEN;
                return true;
            }
            return false;
        }

        return true; // HALF_OPEN
    }

    public void recordSuccess() {
        failureCount = 0;
        state = State.CLOSED;
    }

    public void recordFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();

        if (failureCount >= failureThreshold) {
            state = State.OPEN;
        }
    }
}
```

## Security Best Practices

Security in Java WebSocket applications requires a comprehensive approach that
addresses authentication, authorization, data validation, and transport
security. Java's enterprise-focused ecosystem provides robust security
frameworks that can be seamlessly integrated with WebSocket applications,
leveraging existing authentication systems and authorization policies.

The stateful nature of WebSocket connections introduces unique security
challenges compared to traditional HTTP requests. Unlike stateless HTTP requests
where authentication can be verified per request, WebSocket connections require
ongoing validation of user permissions throughout the connection lifecycle.
Java's security frameworks provide sophisticated mechanisms for handling these
challenges while maintaining high performance.

### Authentication and Authorization

Implement secure WebSocket connections with proper authentication. Java's
integration with enterprise authentication systems like LDAP, OAuth 2.0, and
SAML makes it possible to leverage existing identity management infrastructure
for WebSocket applications:

```java
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.security.KeyStore;
import java.util.Map;

public class SecureWebSocketClient extends WebSocketClient {
    private final AuthenticationProvider authProvider;
    private final String apiKey;
    private final SSLContext sslContext;

    public SecureWebSocketClient(URI serverUri, AuthenticationProvider authProvider, String apiKey) {
        super(serverUri);
        this.authProvider = authProvider;
        this.apiKey = apiKey;
        this.sslContext = createSSLContext();
        configureSSL();
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        // Verify server certificate and handshake
        if (!verifyServerHandshake(handshake)) {
            close(CloseFrame.REFUSE, "Server verification failed");
            return;
        }

        // Send authentication message
        authenticateConnection();
    }

    private void authenticateConnection() {
        try {
            String token = authProvider.getAccessToken();
            AuthenticationMessage authMsg = new AuthenticationMessage(
                token, apiKey, System.currentTimeMillis()
            );

            // Sign the message
            String signature = signMessage(authMsg);
            authMsg.setSignature(signature);

            send(gson.toJson(authMsg));

        } catch (Exception e) {
            logger.error("Authentication failed: {}", e.getMessage());
            close(CloseFrame.POLICY_VALIDATION, "Authentication failed");
        }
    }

    private boolean verifyServerHandshake(ServerHandshake handshake) {
        // Verify server provides required security headers
        Map<String, String> headers = handshake.getFieldValue("Sec-WebSocket-Accept") != null ?
            Map.of("Sec-WebSocket-Accept", handshake.getFieldValue("Sec-WebSocket-Accept")) :
            Map.of();

        // Additional security validations
        return validateSecurityHeaders(headers) &&
               validateProtocolVersion(handshake) &&
               validateOrigin(handshake);
    }

    private boolean validateSecurityHeaders(Map<String, String> headers) {
        // Check for security headers like HSTS, CSP, etc.
        return true; // Implement according to your security requirements
    }

    @Override
    public void onMessage(String message) {
        try {
            // Validate message structure and content
            if (!validateMessage(message)) {
                logger.warn("Invalid message received, ignoring");
                return;
            }

            // Decrypt if necessary
            String decryptedMessage = decryptMessage(message);

            // Process validated and decrypted message
            super.onMessage(decryptedMessage);

        } catch (Exception e) {
            logger.error("Message processing failed: {}", e.getMessage());
        }
    }

    private boolean validateMessage(String message) {
        // Implement message validation logic
        if (message == null || message.length() > MAX_MESSAGE_SIZE) {
            return false;
        }

        // Check for malicious patterns
        return !containsMaliciousPatterns(message);
    }

    private SSLContext createSSLContext() {
        try {
            KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
            // Load your trusted certificates

            TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                TrustManagerFactory.getDefaultAlgorithm()
            );
            tmf.init(trustStore);

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, tmf.getTrustManagers(), null);

            return sslContext;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create SSL context", e);
        }
    }

    private void configureSSL() {
        setSocket(sslContext.getSocketFactory().createSocket());
    }
}

class AuthenticationMessage {
    private final String token;
    private final String apiKey;
    private final long timestamp;
    private String signature;

    public AuthenticationMessage(String token, String apiKey, long timestamp) {
        this.token = token;
        this.apiKey = apiKey;
        this.timestamp = timestamp;
    }

    // Getters and setters...
}
```

## Production Deployment Considerations

### Docker Configuration

Create a production-ready Docker setup:

```dockerfile
# Multi-stage build for Java WebSocket application
FROM openjdk:17-jdk-alpine AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

RUN ./mvnw clean package -DskipTests

FROM openjdk:17-jre-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install monitoring tools
RUN apk add --no-cache curl netcat-openbsd

WORKDIR /app

# Copy application
COPY --from=builder /app/target/websocket-java-guide*.jar app.jar
COPY docker/application.properties .
COPY docker/logback-spring.xml .

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseG1GC", \
  "-XX:MaxGCPauseMillis=100", \
  "-XX:+UseStringDeduplication", \
  "-Xms512m", \
  "-Xmx2048m", \
  "-Dspring.config.location=classpath:/application.properties,file:./application.properties", \
  "-Dlogging.config=./logback-spring.xml", \
  "-jar", "app.jar"]
```

### Kubernetes Deployment

Deploy with proper scaling and monitoring:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
  labels:
    app: websocket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket-server
  template:
    metadata:
      labels:
        app: websocket-server
    spec:
      containers:
        - name: websocket-server
          image: your-registry/websocket-server:latest
          ports:
            - containerPort: 8080
              protocol: TCP
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: 'production'
            - name: WEBSOCKET_MAX_CONNECTIONS
              value: '10000'
            - name: JVM_OPTS
              value: '-Xms1g -Xmx2g -XX:+UseG1GC'
          resources:
            requests:
              memory: '1Gi'
              cpu: '500m'
            limits:
              memory: '2Gi'
              cpu: '1000m'
          livenessProbe:
            httpGet:
              path: /actuator/health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: websocket-config

---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
spec:
  selector:
    app: websocket-server
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  type: LoadBalancer
  sessionAffinity: ClientIP # Important for WebSocket connections

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Best Practices

### Connection Management

- **Implement automatic reconnection with exponential backoff**: Use intelligent
  retry mechanisms that don't overwhelm servers during outages
- **Use connection pooling for multiple WebSocket connections**: Efficiently
  manage resources and reduce connection overhead
- **Handle network changes gracefully**: Especially important for mobile
  applications where network conditions change frequently
- **Implement heartbeat/ping-pong for connection health**: Detect dead
  connections early and maintain connection state

### Security

- **Always use WSS (WebSocket Secure) in production**: Encrypt all WebSocket
  communication to prevent eavesdropping and tampering
- **Implement proper authentication before upgrading connection**: Verify client
  identity before allowing WebSocket upgrade
- **Validate all incoming messages**: Never trust client input; implement
  server-side validation for all message types
- **Use rate limiting to prevent abuse**: Protect against DoS attacks and
  excessive resource consumption
- **Implement CORS properly**: Configure cross-origin policies to prevent
  unauthorized access from malicious websites

### Performance

- **Use binary messages for large data transfers**: Binary frames have less
  overhead than text frames for large payloads
- **Implement message compression (permessage-deflate)**: Reduce bandwidth
  usage, especially for text-heavy applications
- **Batch small messages when possible**: Reduce the overhead of sending many
  small messages
- **Use async message sending for better throughput**: Avoid blocking the main
  thread while sending messages
- **Configure appropriate buffer sizes**: Balance memory usage with performance
  based on your message patterns

### Error Handling

- **Implement comprehensive error handling**: Plan for all types of failures
  including network, protocol, and application errors
- **Log errors appropriately**: Provide enough detail for debugging while
  avoiding sensitive information leakage
- **Provide fallback mechanisms**: Implement graceful degradation when WebSocket
  connections fail
- **Handle partial message failures**: Deal with incomplete or corrupted
  messages gracefully
- **Implement circuit breaker pattern for failing services**: Prevent cascade
  failures in distributed systems

### Monitoring

- **Track connection metrics (open/close/error rates)**: Monitor the health of
  your WebSocket infrastructure
- **Monitor message throughput**: Understand usage patterns and capacity
  requirements
- **Log slow message processing**: Identify performance bottlenecks in message
  handling
- **Implement health checks**: Provide endpoints for load balancers and
  monitoring systems
- **Use distributed tracing for debugging**: Correlate WebSocket events with
  other application activities

## Troubleshooting Common Issues

### Connection Problems

**Issue**: Connections dropping frequently **Solution**: Implement proper
heartbeat mechanism and check firewall/proxy configurations

**Issue**: Unable to connect through corporate firewalls **Solution**: Use WSS
on port 443 and implement fallback mechanisms like HTTP long-polling

**Issue**: Memory leaks in long-running applications **Solution**: Properly
clean up WebSocket connections and implement connection lifecycle management

### Performance Issues

**Issue**: High CPU usage with many connections **Solution**: Use NIO-based
implementations and optimize message processing with thread pools

**Issue**: Slow message delivery **Solution**: Implement message prioritization
and consider using binary frames for large messages

**Issue**: Connection limit exceeded **Solution**: Implement connection pooling
and consider horizontal scaling strategies

This comprehensive guide provides everything needed to implement robust,
scalable, and secure WebSocket applications in Java. From basic client-server
communication to enterprise-grade deployments, these patterns and practices will
help you build production-ready real-time applications.

## Java's Maturity Advantage in WebSocket Development

Java's maturity as a platform brings unique advantages to WebSocket development
that are often underappreciated. The Java Virtual Machine (JVM) has been
optimized over decades, with sophisticated just-in-time compilation, garbage
collection algorithms, and memory management strategies that have been
battle-tested in some of the world's largest applications. This maturity
translates directly into reliable, high-performance WebSocket implementations
that can handle millions of concurrent connections.

The standardization through JSR 356 means that Java WebSocket applications have
a clear, well-defined API that promotes portability and maintainability. This
standardization extends beyond just the API - it includes clear specifications
for error handling, session management, and extension mechanisms. For enterprise
applications where long-term support and stability are crucial, this
standardization provides confidence that WebSocket applications built today will
continue to work with future Java versions.

The tooling ecosystem around Java is unmatched in its sophistication. Profilers
can analyze WebSocket performance down to the method level, identifying
bottlenecks with precision. Application Performance Monitoring (APM) tools
provide deep insights into WebSocket behavior in production. IDE support for
WebSocket development includes everything from code completion to automated
refactoring, making development more efficient and less error-prone.

## Frequently Asked Questions

### How do I add WebSockets to a Spring Boot application?

Add the `spring-boot-starter-websocket` dependency. Create a class annotated
with `@ServerEndpoint` or use Spring STOMP support with
`@EnableWebSocketMessageBroker`. Spring handles the upgrade handshake and
connection lifecycle automatically.

### What is JSR 356 and how does it relate to Java WebSockets?

JSR 356 (Jakarta WebSocket) is the standard Java API for WebSockets. It defines
annotations like `@ServerEndpoint` and `@ClientEndpoint` for building WebSocket
applications. Tyrus is the reference implementation, and all major Java servers
support it.

### Can I use WebSockets with Jakarta EE?

Yes. Jakarta WebSocket (formerly JSR 356) is part of Jakarta EE. Annotate a
class with `@ServerEndpoint`, implement `@OnOpen`, `@OnMessage`, `@OnClose`, and
`@OnError` methods, and deploy to any Jakarta EE-compatible server like Tomcat,
Jetty, or WildFly.

### How do I handle WebSocket authentication in Java?

Use a `HandshakeInterceptor` in Spring or a `Configurator` in Jakarta EE to
validate tokens during the HTTP upgrade. Check JWT tokens, session cookies, or
custom headers before accepting the WebSocket connection.

## Related Content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) -
  The protocol underlying Java WebSocket implementations
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Browser-side API for connecting to your Java server
- [WebSocket Security](/guides/security/) - Authentication, TLS, and rate
  limiting for WebSocket servers
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Curated list including Java libraries like Tyrus and Jetty
- [WebSockets at Scale](/guides/websockets-at-scale/) - Scaling patterns
  applicable to Java WebSocket deployments
