---
title: 'Go WebSocket: Gorilla, nhooyr & Concurrency Patterns'
description:
  'Build Go WebSocket servers and clients with Gorilla WebSocket and
  nhooyr/websocket. Covers goroutines, channels, connection pooling, testing,
  and production deployment.'
sidebar:
  order: 3
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - go websocket
  - golang websocket
  - gorilla websocket
  - go websocket server
  - nhooyr websocket
seo:
  keywords:
    - go websocket
    - golang websocket
    - gorilla websocket
    - go websocket server
    - go websocket client
    - nhooyr websocket
    - golang realtime
    - go websocket goroutine
faq:
  - q: 'What is the best Go WebSocket library?'
    a:
      'Gorilla WebSocket is the most popular and battle-tested choice.
      nhooyr/websocket is a newer alternative with a simpler API and better
      context support. Both are production-ready. Gorilla has more examples and
      community resources.'
  - q: 'How do I handle concurrent WebSocket connections in Go?'
    a:
      'Use one goroutine per connection for reading and one for writing. Protect
      shared state with sync.Mutex or use channels to coordinate. Go goroutines
      are lightweight, so thousands of concurrent connections are practical.'
  - q: 'Is Go good for WebSocket servers?'
    a:
      'Yes, Go is excellent for WebSocket servers. Goroutines handle thousands
      of concurrent connections efficiently without thread overhead. Static
      binaries deploy easily, and Go standard library has built-in HTTP upgrade
      support.'
  - q: 'How do I add WebSocket support to an existing Go HTTP server?'
    a:
      'Use gorilla/websocket Upgrader to upgrade HTTP connections. Create an
      Upgrader instance, call Upgrade() in your HTTP handler, then read and
      write messages on the returned Conn. The upgrade happens on your existing
      HTTP server and port.'
tags:
  - websocket
  - go
  - golang
  - gorilla
  - websocket-go
  - programming
  - tutorial
  - implementation
  - guide
  - how-to
---

:::note[Quick Answer] Use **gorilla/websocket** for full-featured WebSocket
support or **nhooyr/websocket** for a simpler API. Create an `Upgrader`, call
`Upgrade()` in your HTTP handler, then use `ReadMessage()` and `WriteMessage()`
on the connection. Go's goroutines handle thousands of concurrent connections
efficiently. :::

Go has emerged as one of the most powerful languages for building real-time,
concurrent applications, making it an excellent choice for WebSocket
implementations. This comprehensive guide covers everything you need to know
about implementing WebSockets in Go, from basic client-server connections to
enterprise-grade production deployments.

The design philosophy of Go aligns exceptionally well with the requirements of
WebSocket applications. The language's emphasis on simplicity and explicit
behavior makes it easier to reason about connection lifecycles, error handling,
and resource management—critical aspects of reliable real-time systems. Go's
approach to concurrency, built around the principle of "don't communicate by
sharing memory; share memory by communicating," maps naturally to WebSocket
applications where messages need to be routed between different connections and
processing components.

## Why Choose Go for WebSocket Development?

Go offers several compelling advantages for WebSocket development that make it
stand out from other programming languages:

**Built-in Concurrency**: Go's goroutines and channels provide elegant,
lightweight concurrency primitives that are perfect for handling thousands of
simultaneous WebSocket connections with minimal resource overhead.

**Excellent Performance**: Go's compiled nature, efficient garbage collector,
and runtime optimizations deliver exceptional performance for real-time
applications, often outperforming interpreted languages by orders of magnitude.

**Simple Deployment**: Go compiles to a single binary with no external
dependencies, making deployment and containerization straightforward and
reliable.

**Strong Standard Library**: Go's standard library includes excellent support
for HTTP servers, networking, and JSON handling, providing a solid foundation
for WebSocket applications.

**Robust Error Handling**: Go's explicit error handling approach ensures that
network failures, connection drops, and protocol errors are handled consistently
throughout WebSocket applications, contributing to overall system reliability.

**Mature Ecosystem**: The Go ecosystem includes battle-tested WebSocket
libraries, comprehensive testing tools, and excellent profiling capabilities
that enable developers to build and maintain production-grade WebSocket
applications efficiently.

The combination of these advantages makes Go particularly well-suited for
high-performance, scalable WebSocket applications. Companies like Discord, which
handles billions of WebSocket messages daily, have demonstrated Go's
capabilities at massive scale. The language's predictable performance
characteristics and efficient resource utilization make it an excellent choice
for both startup applications and enterprise-scale deployments.

**Rich Ecosystem**: Libraries like Gorilla WebSocket and nhooyr/websocket offer
mature, well-tested implementations with extensive feature sets and community
support.

**Memory Efficiency**: Go's efficient memory management and low memory footprint
make it ideal for handling large numbers of concurrent connections.

**Fast Development Cycle**: Go's fast compilation times and excellent tooling
support rapid development and testing cycles.

## Setting Up Your Go WebSocket Project

Let's start by setting up a comprehensive Go WebSocket project structure that
follows Go best practices and supports both client and server implementations.

### Project Structure and Dependencies

Create your project with a clean, maintainable structure:

```text
go-websocket-guide/
├── cmd/
│   ├── server/
│   │   └── main.go
│   └── client/
│       └── main.go
├── internal/
│   ├── server/
│   │   ├── hub.go
│   │   ├── client.go
│   │   └── handlers.go
│   ├── client/
│   │   └── websocket.go
│   └── common/
│       ├── message.go
│       ├── config.go
│       └── logger.go
├── pkg/
│   └── websocket/
│       └── types.go
├── web/
│   └── static/
│       ├── index.html
│       └── js/
├── docker/
│   └── Dockerfile
├── deployments/
│   └── k8s/
├── scripts/
├── go.mod
├── go.sum
└── README.md
```

### Initialize Your Go Module

```bash
# Initialize your Go module
go mod init github.com/yourusername/go-websocket-guide

# Add required dependencies
go get github.com/gorilla/websocket@latest
go get nhooyr.io/websocket@latest
go get github.com/gorilla/mux@latest
go get github.com/sirupsen/logrus@latest
go get github.com/spf13/viper@latest
go get github.com/prometheus/client_golang@latest

# Testing dependencies
go get github.com/stretchr/testify@latest
go get github.com/testcontainers/testcontainers-go@latest
```

Your `go.mod` file should look like this:

```go
module github.com/yourusername/go-websocket-guide

go 1.21

require (
    github.com/gorilla/websocket v1.5.1
    nhooyr.io/websocket v1.8.10
    github.com/gorilla/mux v1.8.1
    github.com/sirupsen/logrus v1.9.3
    github.com/spf13/viper v1.17.0
    github.com/prometheus/client_golang v1.17.0
    github.com/stretchr/testify v1.8.4
    github.com/testcontainers/testcontainers-go v0.26.0
)
```

### Configuration Management

Create a robust configuration system in `internal/common/config.go`:

```go
package common

import (
    "fmt"
    "time"

    "github.com/spf13/viper"
)

type Config struct {
    Server ServerConfig `mapstructure:"server"`
    WebSocket WSConfig `mapstructure:"websocket"`
    Redis RedisConfig `mapstructure:"redis"`
    Monitoring MonitoringConfig `mapstructure:"monitoring"`
    Security SecurityConfig `mapstructure:"security"`
}

type ServerConfig struct {
    Host         string        `mapstructure:"host"`
    Port         int           `mapstructure:"port"`
    ReadTimeout  time.Duration `mapstructure:"read_timeout"`
    WriteTimeout time.Duration `mapstructure:"write_timeout"`
    IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
}

type WSConfig struct {
    MaxConnections    int           `mapstructure:"max_connections"`
    ReadBufferSize    int           `mapstructure:"read_buffer_size"`
    WriteBufferSize   int           `mapstructure:"write_buffer_size"`
    HandshakeTimeout  time.Duration `mapstructure:"handshake_timeout"`
    PongWait          time.Duration `mapstructure:"pong_wait"`
    PingPeriod        time.Duration `mapstructure:"ping_period"`
    WriteWait         time.Duration `mapstructure:"write_wait"`
    MaxMessageSize    int64         `mapstructure:"max_message_size"`
    EnableCompression bool          `mapstructure:"enable_compression"`
}

type RedisConfig struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
    Password string `mapstructure:"password"`
    DB       int    `mapstructure:"db"`
}

type MonitoringConfig struct {
    Enabled    bool   `mapstructure:"enabled"`
    MetricsPath string `mapstructure:"metrics_path"`
    PrometheusPort int `mapstructure:"prometheus_port"`
}

type SecurityConfig struct {
    EnableTLS       bool     `mapstructure:"enable_tls"`
    CertFile        string   `mapstructure:"cert_file"`
    KeyFile         string   `mapstructure:"key_file"`
    AllowedOrigins  []string `mapstructure:"allowed_origins"`
    RequireAuth     bool     `mapstructure:"require_auth"`
    JWTSecret       string   `mapstructure:"jwt_secret"`
    RateLimitRPS    int      `mapstructure:"rate_limit_rps"`
    RateLimitBurst  int      `mapstructure:"rate_limit_burst"`
}

func LoadConfig(path string) (*Config, error) {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(path)
    viper.AddConfigPath(".")
    viper.AddConfigPath("./config")

    // Set defaults
    setDefaults()

    // Read config file
    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); ok {
            // Config file not found; use defaults
        } else {
            return nil, fmt.Errorf("error reading config file: %w", err)
        }
    }

    // Read environment variables
    viper.AutomaticEnv()

    var config Config
    if err := viper.Unmarshal(&config); err != nil {
        return nil, fmt.Errorf("unable to decode config: %w", err)
    }

    return &config, nil
}

func setDefaults() {
    // Server defaults
    viper.SetDefault("server.host", "localhost")
    viper.SetDefault("server.port", 8080)
    viper.SetDefault("server.read_timeout", "15s")
    viper.SetDefault("server.write_timeout", "15s")
    viper.SetDefault("server.idle_timeout", "60s")

    // WebSocket defaults
    viper.SetDefault("websocket.max_connections", 10000)
    viper.SetDefault("websocket.read_buffer_size", 1024)
    viper.SetDefault("websocket.write_buffer_size", 1024)
    viper.SetDefault("websocket.handshake_timeout", "10s")
    viper.SetDefault("websocket.pong_wait", "60s")
    viper.SetDefault("websocket.ping_period", "54s")
    viper.SetDefault("websocket.write_wait", "10s")
    viper.SetDefault("websocket.max_message_size", 512*1024) // 512KB
    viper.SetDefault("websocket.enable_compression", true)

    // Security defaults
    viper.SetDefault("security.enable_tls", false)
    viper.SetDefault("security.allowed_origins", []string{"*"})
    viper.SetDefault("security.require_auth", false)
    viper.SetDefault("security.rate_limit_rps", 100)
    viper.SetDefault("security.rate_limit_burst", 200)

    // Monitoring defaults
    viper.SetDefault("monitoring.enabled", true)
    viper.SetDefault("monitoring.metrics_path", "/metrics")
    viper.SetDefault("monitoring.prometheus_port", 9090)
}
```

This guide covers WebSocket implementation in Go using popular libraries,
concurrent connection handling, and production patterns.

## Gorilla WebSocket

Gorilla WebSocket is the most popular and battle-tested WebSocket library for
Go.

### Installation

```bash
go get github.com/gorilla/websocket
```

### Basic Server

Create a WebSocket server with proper upgrade handling:

```go
package main

import ( "encoding/json" "log" "net/http" "github.com/gorilla/websocket" )

var upgrader = websocket.Upgrader{ ReadBufferSize: 1024, WriteBufferSize: 1024,
CheckOrigin: func(r \*http.Request) bool { // Configure origin checking for
production return true }, }

type Message struct { Type string `json:"type"` Content string `json:"content"`
Data json.RawMessage `json:"data,omitempty"` }

func handleWebSocket(w http.ResponseWriter, r \*http.Request) { // Upgrade HTTP
connection to WebSocket conn, err := upgrader.Upgrade(w, r, nil) if err != nil {
log.Printf("Failed to upgrade connection: %v", err) return } defer conn.Close()

    log.Printf("Client connected from %s", conn.RemoteAddr())

    // Send welcome message
    welcome := Message{
        Type:    "welcome",
        Content: "Connected to WebSocket server",
    }
    if err := conn.WriteJSON(welcome); err != nil {
        log.Printf("Write error: %v", err)
        return
    }

    // Read messages
    for {
        var msg Message
        err := conn.ReadJSON(&msg)
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            break
        }

        log.Printf("Received: %+v", msg)

        // Echo message back
        response := Message{
            Type:    "echo",
            Content: msg.Content,
        }

        if err := conn.WriteJSON(response); err != nil {
            log.Printf("Write error: %v", err)
            break
        }
    }

}

func main() { http.HandleFunc("/ws", handleWebSocket)

    log.Println("WebSocket server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Concurrent Connection Management

Handle multiple connections with goroutines and channels:

```go
package main

import ( "encoding/json" "log" "net/http" "sync"

    "github.com/gorilla/websocket"

)

// Client represents a WebSocket client type Client struct { ID string conn
*websocket.Conn send chan []byte hub *Hub }

// Hub maintains active clients and broadcasts messages type Hub struct {
clients map[*Client]bool broadcast chan []byte register chan *Client unregister
chan *Client mu sync.RWMutex }

func NewHub() *Hub { return &Hub{ clients: make(map[*Client]bool), broadcast:
make(chan []byte), register: make(chan *Client), unregister: make(chan *Client),
} }

func (h \*Hub) Run() { for { select { case client := <-h.register: h.mu.Lock()
h.clients[client] = true h.mu.Unlock() log.Printf("Client %s registered",
client.ID)

            // Notify others about new client
            notification, _ := json.Marshal(map[string]string{
                "type": "user_joined",
                "id":   client.ID,
            })
            h.broadcastMessage(notification, client)

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
                h.mu.Unlock()

                log.Printf("Client %s unregistered", client.ID)

                // Notify others about disconnection
                notification, _ := json.Marshal(map[string]string{
                    "type": "user_left",
                    "id":   client.ID,
                })
                h.broadcastMessage(notification, nil)
            } else {
                h.mu.Unlock()
            }

        case message := <-h.broadcast:
            h.broadcastMessage(message, nil)
        }
    }

}

func (h *Hub) broadcastMessage(message []byte, exclude *Client) { h.mu.RLock()
defer h.mu.RUnlock()

    for client := range h.clients {
        if client != exclude {
            select {
            case client.send <- message:
            default:
                // Client's send channel is full, close it
                delete(h.clients, client)
                close(client.send)
            }
        }
    }

}

// Client methods func (c \*Client) ReadPump() { defer func() { c.hub.unregister
<- c c.conn.Close() }()

    c.conn.SetReadLimit(512 * 1024) // 512KB max message size

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            break
        }

        // Process message
        var msg map[string]interface{}
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("JSON parse error: %v", err)
            continue
        }

        // Handle different message types
        switch msg["type"] {
        case "broadcast":
            c.hub.broadcast <- message
        case "ping":
            pong, _ := json.Marshal(map[string]string{"type": "pong"})
            c.send <- pong
        default:
            // Echo to sender
            c.send <- message
        }
    }

}

func (c \*Client) WritePump() { defer c.conn.Close()

    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                // Hub closed the channel
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            c.conn.WriteMessage(websocket.TextMessage, message)
        }
    }

}

var hub = NewHub()

func handleConnections(w http.ResponseWriter, r \*http.Request) { conn, err :=
upgrader.Upgrade(w, r, nil) if err != nil { log.Printf("Upgrade error: %v", err)
return }

    // Get client ID from query params or generate
    clientID := r.URL.Query().Get("id")
    if clientID == "" {
        clientID = generateID()
    }

    client := &Client{
        ID:   clientID,
        conn: conn,
        send: make(chan []byte, 256),
        hub:  hub,
    }

    hub.register <- client

    // Start goroutines for reading and writing
    go client.WritePump()
    go client.ReadPump()

}

func generateID() string { // Generate unique ID (simplified) return
fmt.Sprintf("client\_%d", time.Now().UnixNano()) }

func main() { go hub.Run()

    http.HandleFunc("/ws", handleConnections)

    log.Println("Server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Advanced Features with Rooms

Implement chat rooms and broadcasting:

```go
package main

import ( "encoding/json" "fmt" "log" "sync" "time"

    "github.com/gorilla/websocket"

)

// Room represents a chat room type Room struct { ID string Name string clients
map[*Client]bool mu sync.RWMutex }

// Enhanced Hub with room support type EnhancedHub struct { clients
map[string]*Client rooms map[string]*Room broadcast chan BroadcastMessage
register chan *Client unregister chan *Client mu sync.RWMutex }

type BroadcastMessage struct { Room string Message []byte Sender \*Client }

func NewEnhancedHub() *EnhancedHub { return &EnhancedHub{ clients:
make(map[string]*Client), rooms: make(map[string]*Room), broadcast: make(chan
BroadcastMessage), register: make(chan *Client), unregister: make(chan
\*Client), } }

func (h _EnhancedHub) Run() { // Periodic cleanup ticker := time.NewTicker(30 _
time.Second) defer ticker.Stop()

    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client.ID] = client
            h.mu.Unlock()
            log.Printf("Client %s connected", client.ID)

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client.ID]; ok {
                // Leave all rooms
                for roomID := range client.rooms {
                    if room, exists := h.rooms[roomID]; exists {
                        room.RemoveClient(client)
                    }
                }

                delete(h.clients, client.ID)
                close(client.send)
            }
            h.mu.Unlock()
            log.Printf("Client %s disconnected", client.ID)

        case msg := <-h.broadcast:
            h.handleBroadcast(msg)

        case <-ticker.C:
            h.cleanup()
        }
    }

}

func (h \*EnhancedHub) handleBroadcast(msg BroadcastMessage) { if msg.Room == ""
{ // Global broadcast h.mu.RLock() defer h.mu.RUnlock()

        for _, client := range h.clients {
            if client != msg.Sender {
                select {
                case client.send <- msg.Message:
                default:
                    // Client buffer full
                    go h.removeClient(client)
                }
            }
        }
    } else {
        // Room broadcast
        h.mu.RLock()
        room, exists := h.rooms[msg.Room]
        h.mu.RUnlock()

        if exists {
            room.Broadcast(msg.Message, msg.Sender)
        }
    }

}

func (h *EnhancedHub) JoinRoom(client *Client, roomID string) error {
h.mu.Lock() room, exists := h.rooms[roomID] if !exists { room = &Room{ ID:
roomID, Name: roomID, clients: make(map[*Client]bool), } h.rooms[roomID] = room
} h.mu.Unlock()

    room.AddClient(client)
    client.rooms[roomID] = true

    // Notify room members
    notification, _ := json.Marshal(map[string]interface{}{
        "type":   "user_joined_room",
        "room":   roomID,
        "userId": client.ID,
    })

    room.Broadcast(notification, client)

    // Send room info to client
    roomInfo, _ := json.Marshal(map[string]interface{}{
        "type":    "room_joined",
        "room":    roomID,
        "members": room.GetMemberIDs(),
    })

    client.send <- roomInfo

    return nil

}

func (h *EnhancedHub) LeaveRoom(client *Client, roomID string) { h.mu.RLock()
room, exists := h.rooms[roomID] h.mu.RUnlock()

    if !exists {
        return
    }

    room.RemoveClient(client)
    delete(client.rooms, roomID)

    // Notify room members
    notification, _ := json.Marshal(map[string]interface{}{
        "type":   "user_left_room",
        "room":   roomID,
        "userId": client.ID,
    })

    room.Broadcast(notification, nil)

    // Delete empty room
    if room.IsEmpty() {
        h.mu.Lock()
        delete(h.rooms, roomID)
        h.mu.Unlock()
    }

}

func (r *Room) AddClient(client *Client) { r.mu.Lock() defer r.mu.Unlock()
r.clients[client] = true }

func (r *Room) RemoveClient(client *Client) { r.mu.Lock() defer r.mu.Unlock()
delete(r.clients, client) }

func (r *Room) Broadcast(message []byte, exclude *Client) { r.mu.RLock() defer
r.mu.RUnlock()

    for client := range r.clients {
        if client != exclude {
            select {
            case client.send <- message:
            default:
                // Buffer full, skip
            }
        }
    }

}

func (r \*Room) GetMemberIDs() []string { r.mu.RLock() defer r.mu.RUnlock()

    members := make([]string, 0, len(r.clients))
    for client := range r.clients {
        members = append(members, client.ID)
    }
    return members

}

func (r \*Room) IsEmpty() bool { r.mu.RLock() defer r.mu.RUnlock() return
len(r.clients) == 0 }

// Enhanced Client with room support type EnhancedClient struct { ID string conn
*websocket.Conn send chan []byte hub *EnhancedHub rooms map[string]bool mu
sync.RWMutex }

func (c \*EnhancedClient) HandleMessage(message []byte) { var msg
map[string]interface{} if err := json.Unmarshal(message, &msg); err != nil {
c.sendError("Invalid message format") return }

    switch msg["type"] {
    case "join_room":
        if roomID, ok := msg["room"].(string); ok {
            if err := c.hub.JoinRoom(c, roomID); err != nil {
                c.sendError(fmt.Sprintf("Failed to join room: %v", err))
            }
        }

    case "leave_room":
        if roomID, ok := msg["room"].(string); ok {
            c.hub.LeaveRoom(c, roomID)
        }

    case "room_message":
        if roomID, ok := msg["room"].(string); ok {
            if _, inRoom := c.rooms[roomID]; inRoom {
                c.hub.broadcast <- BroadcastMessage{
                    Room:    roomID,
                    Message: message,
                    Sender:  c,
                }
            } else {
                c.sendError("Not in room")
            }
        }

    case "private_message":
        if targetID, ok := msg["to"].(string); ok {
            c.sendPrivateMessage(targetID, message)
        }

    default:
        // Global broadcast
        c.hub.broadcast <- BroadcastMessage{
            Message: message,
            Sender:  c,
        }
    }

}

func (c \*EnhancedClient) sendError(err string) { errMsg, \_ :=
json.Marshal(map[string]string{ "type": "error", "error": err, }) c.send <-
errMsg }

func (c \*EnhancedClient) sendPrivateMessage(targetID string, message []byte) {
c.hub.mu.RLock() target, exists := c.hub.clients[targetID] c.hub.mu.RUnlock()

    if exists {
        target.send <- message
    } else {
        c.sendError("User not found")
    }

}
```

### Client Implementation

WebSocket client with reconnection:

```go
package main

import ( "encoding/json" "fmt" "log" "net/url" "sync" "time"

    "github.com/gorilla/websocket"

)

type WebSocketClient struct { URL string conn \*websocket.Conn send chan []byte
receive chan []byte done chan struct{} reconnect bool reconnectDelay
time.Duration maxReconnect time.Duration mu sync.Mutex }

func NewWebSocketClient(serverURL string) _WebSocketClient { return
&WebSocketClient{ URL: serverURL, send: make(chan []byte, 100), receive:
make(chan []byte, 100), done: make(chan struct{}), reconnect: true,
reconnectDelay: 2 _ time.Second, maxReconnect: 30 \* time.Second, } }

func (c \*WebSocketClient) Connect() error { u, err := url.Parse(c.URL) if err
!= nil { return err }

    log.Printf("Connecting to %s", u.String())

    conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
    if err != nil {
        return err
    }

    c.mu.Lock()
    c.conn = conn
    c.mu.Unlock()

    log.Println("Connected successfully")

    // Start read and write pumps
    go c.readPump()
    go c.writePump()

    return nil

}

func (c \*WebSocketClient) readPump() { defer func() { c.mu.Lock() if c.conn !=
nil { c.conn.Close() c.conn = nil } c.mu.Unlock()

        if c.reconnect {
            go c.reconnectLoop()
        }
    }()

    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            return
        }

        select {
        case c.receive <- message:
        case <-c.done:
            return
        }
    }

}

func (c _WebSocketClient) writePump() { ticker := time.NewTicker(54 _
time.Second) defer func() { ticker.Stop() c.mu.Lock() if c.conn != nil {
c.conn.Close() } c.mu.Unlock() }()

    for {
        select {
        case message, ok := <-c.send:
            c.mu.Lock()
            conn := c.conn
            c.mu.Unlock()

            if conn == nil {
                return
            }

            conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if !ok {
                conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                log.Printf("Write error: %v", err)
                return
            }

        case <-ticker.C:
            c.mu.Lock()
            conn := c.conn
            c.mu.Unlock()

            if conn == nil {
                return
            }

            conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }

        case <-c.done:
            return
        }
    }

}

func (c \*WebSocketClient) reconnectLoop() { delay := c.reconnectDelay

    for c.reconnect {
        log.Printf("Reconnecting in %v...", delay)
        time.Sleep(delay)

        if err := c.Connect(); err != nil {
            log.Printf("Reconnection failed: %v", err)

            // Exponential backoff
            delay *= 2
            if delay > c.maxReconnect {
                delay = c.maxReconnect
            }
        } else {
            return
        }
    }

}

func (c \*WebSocketClient) Send(message interface{}) error { data, err :=
json.Marshal(message) if err != nil { return err }

    select {
    case c.send <- data:
        return nil
    case <-time.After(5 * time.Second):
        return fmt.Errorf("send timeout")
    }

}

func (c _WebSocketClient) Receive() ([]byte, error) { select { case message :=
<-c.receive: return message, nil case <-time.After(30 _ time.Second): return
nil, fmt.Errorf("receive timeout") } }

func (c \*WebSocketClient) Close() { c.reconnect = false close(c.done)

    c.mu.Lock()
    if c.conn != nil {
        c.conn.Close()
    }
    c.mu.Unlock()

}

// Usage example func main() { client :=
NewWebSocketClient("ws://localhost:8080/ws")

    if err := client.Connect(); err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Send messages
    go func() {
        for i := 0; i < 10; i++ {
            msg := map[string]interface{}{
                "type":    "message",
                "content": fmt.Sprintf("Hello %d", i),
            }

            if err := client.Send(msg); err != nil {
                log.Printf("Send error: %v", err)
            }

            time.Sleep(2 * time.Second)
        }
    }()

    // Receive messages
    for {
        message, err := client.Receive()
        if err != nil {
            log.Printf("Receive error: %v", err)
            continue
        }

        var msg map[string]interface{}
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("Parse error: %v", err)
            continue
        }

        log.Printf("Received: %+v", msg)
    }

}
```

## nhooyr/websocket

A modern, idiomatic WebSocket library for Go with context support.

### Installation

```bash
go get nhooyr.io/websocket
```

### Modern Server Implementation

```go
package main

import ( "context" "encoding/json" "fmt" "log" "net/http" "time"

    "nhooyr.io/websocket"
    "nhooyr.io/websocket/wsjson"

)

type Server struct { // Server state }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { conn, err
:= websocket.Accept(w, r, &websocket.AcceptOptions{ OriginPatterns:
[]string{"\*"}, // Configure for production CompressionMode:
websocket.CompressionContextTakeover, }) if err != nil { log.Printf("Failed to
accept WebSocket: %v", err) return } defer
conn.Close(websocket.StatusInternalError, "Internal error")

    ctx := r.Context()

    // Handle connection with context
    if err := s.handleConnection(ctx, conn); err != nil {
        log.Printf("Connection error: %v", err)
        return
    }

    conn.Close(websocket.StatusNormalClosure, "")

}

func (s *Server) handleConnection(ctx context.Context, conn *websocket.Conn)
error { // Set connection limits conn.SetReadLimit(32768) // 32KB

    // Send welcome message
    welcome := map[string]string{
        "type":    "welcome",
        "message": "Connected to modern WebSocket server",
    }

    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    if err := wsjson.Write(ctx, conn, welcome); err != nil {
        return fmt.Errorf("failed to send welcome: %w", err)
    }

    // Message loop
    for {
        var msg map[string]interface{}

        // Read with timeout
        ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
        err := wsjson.Read(ctx, conn, &msg)
        cancel()

        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return nil
            }
            return fmt.Errorf("read error: %w", err)
        }

        // Process message
        response, err := s.processMessage(msg)
        if err != nil {
            response = map[string]string{
                "type":  "error",
                "error": err.Error(),
            }
        }

        // Write response
        ctx, cancel = context.WithTimeout(ctx, 5*time.Second)
        err = wsjson.Write(ctx, conn, response)
        cancel()

        if err != nil {
            return fmt.Errorf("write error: %w", err)
        }
    }

}

func (s \*Server) processMessage(msg map[string]interface{}) (interface{},
error) { msgType, ok := msg["type"].(string) if !ok { return nil,
fmt.Errorf("missing message type") }

    switch msgType {
    case "ping":
        return map[string]string{"type": "pong"}, nil

    case "echo":
        return map[string]interface{}{
            "type": "echo",
            "data": msg["data"],
        }, nil

    default:
        return nil, fmt.Errorf("unknown message type: %s", msgType)
    }

}

// Broadcast server with pub/sub type BroadcastServer struct { subscribers
map[*subscriber]bool subscribe chan *subscriber unsubscribe chan *subscriber
broadcast chan []byte }

type subscriber struct { conn \*websocket.Conn messages chan []byte done chan
struct{} }

func NewBroadcastServer() *BroadcastServer { bs := &BroadcastServer{
subscribers: make(map[*subscriber]bool), subscribe: make(chan *subscriber),
unsubscribe: make(chan *subscriber), broadcast: make(chan []byte), }

    go bs.run()
    return bs

}

func (bs \*BroadcastServer) run() { for { select { case sub := <-bs.subscribe:
bs.subscribers[sub] = true log.Printf("Subscriber added, total: %d",
len(bs.subscribers))

        case sub := <-bs.unsubscribe:
            if _, ok := bs.subscribers[sub]; ok {
                delete(bs.subscribers, sub)
                close(sub.messages)
                log.Printf("Subscriber removed, total: %d", len(bs.subscribers))
            }

        case msg := <-bs.broadcast:
            for sub := range bs.subscribers {
                select {
                case sub.messages <- msg:
                default:
                    // Subscriber slow, skip
                }
            }
        }
    }

}

func (bs *BroadcastServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
conn, err := websocket.Accept(w, r, nil) if err != nil { log.Printf("Accept
error: %v", err) return } defer conn.Close(websocket.StatusInternalError, "")

    sub := &subscriber{
        conn:     conn,
        messages: make(chan []byte, 16),
        done:     make(chan struct{}),
    }

    bs.subscribe <- sub
    defer func() {
        bs.unsubscribe <- sub
    }()

    ctx := r.Context()

    // Start writer
    go sub.writer(ctx)

    // Read messages
    for {
        _, msg, err := conn.Read(ctx)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return
            }
            log.Printf("Read error: %v", err)
            return
        }

        // Broadcast to all subscribers
        bs.broadcast <- msg
    }

}

func (sub _subscriber) writer(ctx context.Context) { ticker := time.NewTicker(54
_ time.Second) defer ticker.Stop()

    for {
        select {
        case msg := <-sub.messages:
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            err := sub.conn.Write(ctx, websocket.MessageText, msg)
            cancel()

            if err != nil {
                return
            }

        case <-ticker.C:
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            err := sub.conn.Ping(ctx)
            cancel()

            if err != nil {
                return
            }

        case <-sub.done:
            return
        }
    }

}

func main() { // Simple server simpleServer := &Server{} http.Handle("/ws",
simpleServer)

    // Broadcast server
    broadcastServer := NewBroadcastServer()
    http.Handle("/broadcast", broadcastServer)

    log.Println("Server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Zero-Copy Operations

Optimize performance with zero-copy reads:

```go
package main

import ( "context" "io" "log" "net/http"

    "nhooyr.io/websocket"

)

// Binary protocol handler with zero-copy type BinaryHandler struct { // Handler
state }

func (h *BinaryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{ CompressionMode:
websocket.CompressionDisabled, // Disable for binary }) if err != nil { return }
defer conn.Close(websocket.StatusInternalError, "")

    ctx := r.Context()

    for {
        // Zero-copy read
        typ, reader, err := conn.Reader(ctx)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return
            }
            log.Printf("Read error: %v", err)
            return
        }

        if typ != websocket.MessageBinary {
            conn.Close(websocket.StatusUnsupportedData, "Expected binary data")
            return
        }

        // Process binary stream without copying
        if err := h.processBinaryStream(ctx, conn, reader); err != nil {
            log.Printf("Process error: %v", err)
            return
        }
    }

}

func (h *BinaryHandler) processBinaryStream( ctx context.Context, conn
*websocket.Conn, reader io.Reader, ) error { // Read header (example: 4 bytes)
header := make([]byte, 4) if \_, err := io.ReadFull(reader, header); err != nil
{ return err }

    // Parse message type and length
    msgType := header[0]
    length := int(header[1])<<16 | int(header[2])<<8 | int(header[3])

    // Process based on type
    switch msgType {
    case 0x01: // Data message
        // Stream processing without loading all into memory
        writer, err := conn.Writer(ctx, websocket.MessageBinary)
        if err != nil {
            return err
        }
        defer writer.Close()

        // Write response header
        responseHeader := []byte{0x02, byte(length >> 16), byte(length >> 8), byte(length)}
        if _, err := writer.Write(responseHeader); err != nil {
            return err
        }

        // Stream copy
        if _, err := io.CopyN(writer, reader, int64(length)); err != nil {
            return err
        }

    case 0x02: // Control message
        // Read control data
        control := make([]byte, length)
        if _, err := io.ReadFull(reader, control); err != nil {
            return err
        }

        // Process control message
        response := h.processControl(control)

        // Send response
        if err := conn.Write(ctx, websocket.MessageBinary, response); err != nil {
            return err
        }
    }

    return nil

}

func (h \*BinaryHandler) processControl(data []byte) []byte { // Process control
message return []byte{0x00} // ACK }
```

## Performance Optimization

Performance optimization in Go WebSocket applications leverages the language's
inherent strengths while addressing the specific challenges of real-time
communication. Go's runtime scheduler efficiently manages goroutines, but proper
design patterns can significantly enhance performance, especially under high
load conditions.

The key to optimizing Go WebSocket applications lies in understanding the
interaction between goroutines, the garbage collector, and the network I/O
subsystem. Proper buffer management, connection pooling, and message routing
strategies can dramatically improve both throughput and latency characteristics.

Go's built-in profiling tools, including pprof and trace, provide excellent
visibility into WebSocket application performance. These tools can identify
bottlenecks related to goroutine scheduling, memory allocation patterns, and
network I/O efficiency, enabling data-driven optimization decisions.

### Connection Pooling

Connection pooling in Go WebSocket applications requires careful consideration
of goroutine lifecycle management and resource cleanup. Unlike traditional
request-response patterns, WebSocket connections are long-lived, making
efficient pool management crucial for scalability:

```go
package main

import ( "sync" "time"

    "github.com/gorilla/websocket"

)

type ConnectionPool struct { urls []string connections []*PooledConnection
available chan *PooledConnection mu sync.Mutex maxSize int maxIdleTime
time.Duration }

type PooledConnection struct { conn \*websocket.Conn url string lastUsed
time.Time inUse bool }

func NewConnectionPool(urls []string, maxSize int) *ConnectionPool { pool :=
&ConnectionPool{ urls: urls, connections: make([]*PooledConnection, 0, maxSize),
available: make(chan _PooledConnection, maxSize), maxSize: maxSize, maxIdleTime:
5 _ time.Minute, }

    // Start cleanup routine
    go pool.cleanup()

    return pool

}

func (p *ConnectionPool) Get() (*PooledConnection, error) { // Try to get
available connection select { case conn := <-p.available: if conn.isValid() {
conn.inUse = true conn.lastUsed = time.Now() return conn, nil } // Connection
invalid, close it conn.Close()

    default:
        // No available connections
    }

    // Create new connection if under limit
    p.mu.Lock()
    if len(p.connections) < p.maxSize {
        p.mu.Unlock()
        return p.createConnection()
    }
    p.mu.Unlock()

    // Wait for available connection
    conn := <-p.available
    conn.inUse = true
    conn.lastUsed = time.Now()
    return conn, nil

}

func (p *ConnectionPool) Return(conn *PooledConnection) { if conn == nil ||
!conn.isValid() { if conn != nil { conn.Close() } return }

    conn.inUse = false
    conn.lastUsed = time.Now()

    select {
    case p.available <- conn:
        // Returned to pool
    default:
        // Pool full, close connection
        conn.Close()
    }

}

func (p *ConnectionPool) createConnection() (*PooledConnection, error) { //
Round-robin URL selection url := p.urls[len(p.connections)%len(p.urls)]

    dialer := websocket.Dialer{
        HandshakeTimeout: 10 * time.Second,
        ReadBufferSize:   1024,
        WriteBufferSize:  1024,
    }

    conn, _, err := dialer.Dial(url, nil)
    if err != nil {
        return nil, err
    }

    pooled := &PooledConnection{
        conn:     conn,
        url:      url,
        lastUsed: time.Now(),
        inUse:    true,
    }

    p.mu.Lock()
    p.connections = append(p.connections, pooled)
    p.mu.Unlock()

    return pooled, nil

}

func (p _ConnectionPool) cleanup() { ticker := time.NewTicker(1 _ time.Minute)
defer ticker.Stop()

    for range ticker.C {
        p.mu.Lock()
        now := time.Now()

        for i := len(p.connections) - 1; i >= 0; i-- {
            conn := p.connections[i]

            if !conn.inUse && now.Sub(conn.lastUsed) > p.maxIdleTime {
                conn.Close()
                p.connections = append(p.connections[:i], p.connections[i+1:]...)
            }
        }
        p.mu.Unlock()
    }

}

func (pc \*PooledConnection) isValid() bool { if pc.conn == nil { return false }

    // Send ping to check connection
    pc.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
    err := pc.conn.WriteMessage(websocket.PingMessage, nil)
    return err == nil

}

func (pc \*PooledConnection) Close() { if pc.conn != nil { pc.conn.Close()
pc.conn = nil } }
```

### Benchmarking

```go
package main

import ( "fmt" "sync" "sync/atomic" "testing" "time"

    "github.com/gorilla/websocket"

)

func BenchmarkWebSocketThroughput(b \*testing.B) { // Start test server server
:= startTestServer() defer server.Close()

    // Connect client
    conn, _, err := websocket.DefaultDialer.Dial(server.URL, nil)
    if err != nil {
        b.Fatal(err)
    }
    defer conn.Close()

    message := []byte("benchmark message")

    b.ResetTimer()
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // Write message
            if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                b.Error(err)
            }

            // Read response
            _, _, err := conn.ReadMessage()
            if err != nil {
                b.Error(err)
            }
        }
    })

}

func BenchmarkConcurrentConnections(b \*testing.B) { server := startTestServer()
defer server.Close()

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            conn, _, err := websocket.DefaultDialer.Dial(server.URL, nil)
            if err != nil {
                b.Error(err)
                continue
            }

            // Send/receive one message
            conn.WriteMessage(websocket.TextMessage, []byte("test"))
            conn.ReadMessage()

            conn.Close()
        }
    })

}

// Load test func LoadTest(url string, numClients int, duration time.Duration) {
var ( connected int64 messages int64 errors int64 totalBytes int64 )

    startTime := time.Now()
    wg := sync.WaitGroup{}

    for i := 0; i < numClients; i++ {
        wg.Add(1)
        go func(clientID int) {
            defer wg.Done()

            conn, _, err := websocket.DefaultDialer.Dial(url, nil)
            if err != nil {
                atomic.AddInt64(&errors, 1)
                return
            }
            defer conn.Close()

            atomic.AddInt64(&connected, 1)

            message := []byte(fmt.Sprintf("Client %d message", clientID))

            for time.Since(startTime) < duration {
                // Send message
                if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                    atomic.AddInt64(&errors, 1)
                    break
                }

                // Read response
                _, data, err := conn.ReadMessage()
                if err != nil {
                    atomic.AddInt64(&errors, 1)
                    break
                }

                atomic.AddInt64(&messages, 1)
                atomic.AddInt64(&totalBytes, int64(len(data)))

                time.Sleep(100 * time.Millisecond) // Simulate real usage
            }
        }(i)
    }

    wg.Wait()

    elapsed := time.Since(startTime)

    fmt.Printf("Load Test Results:
")
    fmt.Printf("Duration: %v
", elapsed)
    fmt.Printf("Clients: %d
", numClients)
    fmt.Printf("Connected: %d
", connected)
    fmt.Printf("Messages: %d
", messages)
    fmt.Printf("Errors: %d
", errors)
    fmt.Printf("Total Bytes: %d
", totalBytes)
    fmt.Printf("Messages/sec: %.2f
", float64(messages)/elapsed.Seconds())
    fmt.Printf("Bytes/sec: %.2f
", float64(totalBytes)/elapsed.Seconds())

}
```

## Testing

### Unit Testing

```go
package main

import ( "encoding/json" "net/http" "net/http/httptest" "strings" "testing"
"time"

    "github.com/gorilla/websocket"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

)

func TestWebSocketConnection(t \*testing.T) { // Create test server server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    // Convert http:// to ws://
    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

    // Connect
    conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    require.NoError(t, err)
    defer conn.Close()

    // Test welcome message
    var welcome map[string]string
    err = conn.ReadJSON(&welcome)
    require.NoError(t, err)
    assert.Equal(t, "welcome", welcome["type"])

}

func TestMessageEcho(t \*testing.T) { server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
    conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    require.NoError(t, err)
    defer conn.Close()

    // Skip welcome message
    conn.ReadMessage()

    // Send test message
    testMsg := map[string]string{
        "type":    "echo",
        "content": "test message",
    }

    err = conn.WriteJSON(testMsg)
    require.NoError(t, err)

    // Read echo response
    var response map[string]string
    err = conn.ReadJSON(&response)
    require.NoError(t, err)

    assert.Equal(t, "echo", response["type"])
    assert.Equal(t, "test message", response["content"])

}

func TestConcurrentMessages(t \*testing.T) { server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

    numClients := 10
    done := make(chan bool, numClients)

    for i := 0; i < numClients; i++ {
        go func(id int) {
            conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
            assert.NoError(t, err)
            defer conn.Close()

            // Send message
            msg := map[string]interface{}{
                "type": "test",
                "id":   id,
            }

            err = conn.WriteJSON(msg)
            assert.NoError(t, err)

            // Read response
            var response map[string]interface{}
            err = conn.ReadJSON(&response)
            assert.NoError(t, err)

            done <- true
        }(i)
    }

    // Wait for all clients
    for i := 0; i < numClients; i++ {
        select {
        case <-done:
            // Success
        case <-time.After(5 * time.Second):
            t.Fatal("Timeout waiting for clients")
        }
    }

}

// Test with mock WebSocket type MockWebSocket struct { messages [][]byte closed
bool }

func (m \*MockWebSocket) WriteMessage(messageType int, data []byte) error {
m.messages = append(m.messages, data) return nil }

func (m \*MockWebSocket) Close() error { m.closed = true return nil }

func TestBroadcastLogic(t \*testing.T) { hub := NewHub()

    // Create mock clients
    mockClients := make([]*MockWebSocket, 3)
    for i := range mockClients {
        mockClients[i] = &MockWebSocket{}
        // Add to hub (simplified)
    }

    // Test broadcast
    message := []byte(`{"type":"broadcast","message":"test"}`)
    hub.broadcast <- message

    // Verify all clients received message
    time.Sleep(100 * time.Millisecond) // Wait for processing

    for _, mock := range mockClients {
        assert.Len(t, mock.messages, 1)
        assert.Equal(t, message, mock.messages[0])
    }

}
```

## Production Deployment

### Graceful Shutdown

```go
package main

import ( "context" "log" "net/http" "os" "os/signal" "sync" "syscall" "time"

    "github.com/gorilla/websocket"

)

type GracefulServer struct { server *http.Server hub *Hub connections sync.Map
// thread-safe map shutdownCh chan struct{} }

func NewGracefulServer(addr string) \*GracefulServer { gs := &GracefulServer{
hub: NewHub(), shutdownCh: make(chan struct{}), }

    mux := http.NewServeMux()
    mux.HandleFunc("/ws", gs.handleWebSocket)
    mux.HandleFunc("/health", gs.healthCheck)

    gs.server = &http.Server{
        Addr:           addr,
        Handler:        mux,
        ReadTimeout:    15 * time.Second,
        WriteTimeout:   15 * time.Second,
        IdleTimeout:    60 * time.Second,
        MaxHeaderBytes: 1 << 20, // 1MB
    }

    return gs

}

func (gs \*GracefulServer) Start() error { // Start hub go gs.hub.Run()

    // Setup signal handling
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-sigChan
        log.Println("Shutdown signal received")
        gs.Shutdown()
    }()

    log.Printf("Server starting on %s", gs.server.Addr)
    return gs.server.ListenAndServe()

}

func (gs \*GracefulServer) Shutdown() { log.Println("Starting graceful
shutdown...")

    // Signal shutdown
    close(gs.shutdownCh)

    // Stop accepting new connections
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Notify all clients
    gs.notifyShutdown()

    // Wait for connections to close
    done := make(chan struct{})
    go func() {
        gs.waitForConnections()
        close(done)
    }()

    select {
    case <-done:
        log.Println("All connections closed")
    case <-ctx.Done():
        log.Println("Shutdown timeout, forcing close")
        gs.forceCloseConnections()
    }

    // Shutdown HTTP server
    if err := gs.server.Shutdown(ctx); err != nil {
        log.Printf("Server shutdown error: %v", err)
    }

    log.Println("Server stopped")

}

func (gs \*GracefulServer) notifyShutdown() { message := map[string]string{
"type": "server_shutdown", "message": "Server is shutting down", }

    data, _ := json.Marshal(message)

    gs.connections.Range(func(key, value interface{}) bool {
        if conn, ok := value.(*websocket.Conn); ok {
            conn.WriteMessage(websocket.TextMessage, data)
            conn.WriteMessage(
                websocket.CloseMessage,
                websocket.FormatCloseMessage(websocket.CloseGoingAway, "Server shutdown"),
            )
        }
        return true
    })

}

func (gs _GracefulServer) waitForConnections() { ticker := time.NewTicker(1 _
time.Second) defer ticker.Stop()

    timeout := time.After(25 * time.Second)

    for {
        select {
        case <-ticker.C:
            count := 0
            gs.connections.Range(func(_, _ interface{}) bool {
                count++
                return true
            })

            if count == 0 {
                return
            }

            log.Printf("Waiting for %d connections to close", count)

        case <-timeout:
            return
        }
    }

}

func (gs *GracefulServer) forceCloseConnections() {
gs.connections.Range(func(key, value interface{}) bool { if conn, ok :=
value.(*websocket.Conn); ok { conn.Close() } gs.connections.Delete(key) return
true }) }

func (gs *GracefulServer) healthCheck(w http.ResponseWriter, r *http.Request) {
select { case <-gs.shutdownCh: // Server is shutting down
w.WriteHeader(http.StatusServiceUnavailable) w.Write([]byte("Shutting down"))
default: // Server is healthy w.WriteHeader(http.StatusOK) w.Write([]byte("OK"))
} }
```

## Best Practices

### Security

- Always validate Origin headers
- Implement rate limiting per connection
- Use TLS in production
- Validate and sanitize all input
- Implement authentication before upgrade
- Set appropriate buffer sizes and timeouts

### Performance

- Use goroutines for concurrent connections
- Implement connection pooling for clients
- Use buffered channels appropriately
- Consider using sync.Pool for object reuse
- Profile and benchmark your application
- Use binary frames for large data

### Error Handling

- Always check for specific close codes
- Implement exponential backoff for reconnection
- Log errors with context
- Handle panics in goroutines
- Implement circuit breakers for external services

## Monitoring and Observability

Monitoring and observability in Go WebSocket applications benefit from the
language's excellent tooling ecosystem and built-in support for metrics
collection. Go's runtime provides detailed information about goroutine counts,
memory usage, and garbage collection patterns, all of which are crucial for
monitoring WebSocket applications that maintain many concurrent connections.

The observability strategy for Go WebSocket applications should encompass
multiple layers: application-level metrics (connection counts, message rates,
error rates), runtime metrics (goroutine counts, memory allocation patterns),
and infrastructure metrics (network I/O, CPU usage). Go's integration with
popular monitoring systems like Prometheus makes it straightforward to implement
comprehensive observability solutions.

Distributed tracing becomes particularly important in WebSocket applications
that involve message routing between multiple services or that integrate with
external systems. Go's support for OpenTelemetry and similar tracing frameworks
enables detailed analysis of message flow and latency across complex system
boundaries.

### Prometheus Metrics Integration

Implement comprehensive metrics collection for monitoring WebSocket performance.
The metrics should capture both business-level indicators (active users, message
throughput) and technical performance indicators (connection duration, error
rates):

```go
package metrics

import (
    "time"

    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // Connection metrics
    activeConnections = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "websocket_active_connections",
        Help: "The current number of active WebSocket connections",
    })

    totalConnections = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "websocket_connections_total",
        Help: "The total number of WebSocket connections",
    }, []string{"status"}) // status: accepted, rejected

    connectionDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "websocket_connection_duration_seconds",
        Help:    "Duration of WebSocket connections",
        Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
    }, []string{"disconnect_reason"})

    // Message metrics
    messagesTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "websocket_messages_total",
        Help: "The total number of WebSocket messages",
    }, []string{"direction", "type"}) // direction: inbound, outbound; type: text, binary

    messageSize = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "websocket_message_size_bytes",
        Help:    "Size of WebSocket messages in bytes",
        Buckets: prometheus.ExponentialBuckets(64, 4, 10),
    }, []string{"direction", "type"})

    messageProcessingDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "websocket_message_processing_duration_seconds",
        Help:    "Time spent processing WebSocket messages",
        Buckets: prometheus.ExponentialBuckets(0.001, 2, 10),
    }, []string{"message_type"})

    // Error metrics
    errorsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "websocket_errors_total",
        Help: "The total number of WebSocket errors",
    }, []string{"error_type", "component"})

    // Performance metrics
    roomsTotal = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "websocket_rooms_total",
        Help: "The current number of active rooms",
    })

    clientsPerRoom = promauto.NewHistogram(prometheus.HistogramOpts{
        Name:    "websocket_clients_per_room",
        Help:    "Distribution of clients per room",
        Buckets: prometheus.ExponentialBuckets(1, 2, 10),
    })

    memoryUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
        Name: "websocket_memory_usage_bytes",
        Help: "Memory usage of WebSocket components",
    }, []string{"component"})
)

// Metrics collector interface
type Collector struct {
    startTime time.Time
}

func NewCollector() *Collector {
    return &Collector{
        startTime: time.Now(),
    }
}

func (c *Collector) RecordConnectionAccepted() {
    activeConnections.Inc()
    totalConnections.WithLabelValues("accepted").Inc()
}

func (c *Collector) RecordConnectionRejected(reason string) {
    totalConnections.WithLabelValues("rejected").Inc()
    errorsTotal.WithLabelValues("connection_rejected", "server").Inc()
}

func (c *Collector) RecordConnectionClosed(duration time.Duration, reason string) {
    activeConnections.Dec()
    connectionDuration.WithLabelValues(reason).Observe(duration.Seconds())
}

func (c *Collector) RecordMessageReceived(messageType, msgType string, size int) {
    messagesTotal.WithLabelValues("inbound", messageType).Inc()
    messageSize.WithLabelValues("inbound", messageType).Observe(float64(size))
}

func (c *Collector) RecordMessageSent(messageType, msgType string, size int) {
    messagesTotal.WithLabelValues("outbound", messageType).Inc()
    messageSize.WithLabelValues("outbound", messageType).Observe(float64(size))
}

func (c *Collector) RecordMessageProcessingTime(messageType string, duration time.Duration) {
    messageProcessingDuration.WithLabelValues(messageType).Observe(duration.Seconds())
}

func (c *Collector) RecordError(errorType, component string) {
    errorsTotal.WithLabelValues(errorType, component).Inc()
}

func (c *Collector) UpdateRoomCount(count int) {
    roomsTotal.Set(float64(count))
}

func (c *Collector) RecordRoomClientCount(count int) {
    clientsPerRoom.Observe(float64(count))
}

func (c *Collector) UpdateMemoryUsage(component string, bytes int64) {
    memoryUsage.WithLabelValues(component).Set(float64(bytes))
}
```

### Health Checks and Diagnostics

Implement comprehensive health checking:

```go
package health

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "runtime"
    "sync"
    "time"
)

type HealthChecker struct {
    checks   map[string]HealthCheck
    mu       sync.RWMutex
    timeout  time.Duration
}

type HealthCheck interface {
    Name() string
    Check(ctx context.Context) error
}

type HealthStatus struct {
    Status    string                 `json:"status"`
    Timestamp time.Time              `json:"timestamp"`
    Duration  string                 `json:"duration"`
    Checks    map[string]CheckResult `json:"checks"`
    System    SystemInfo             `json:"system"`
}

type CheckResult struct {
    Status    string        `json:"status"`
    Error     string        `json:"error,omitempty"`
    Duration  time.Duration `json:"duration"`
    Metadata  interface{}   `json:"metadata,omitempty"`
}

type SystemInfo struct {
    Uptime         time.Duration `json:"uptime"`
    Goroutines     int           `json:"goroutines"`
    MemoryAlloc    uint64        `json:"memory_alloc"`
    MemorySys      uint64        `json:"memory_sys"`
    GCPauseTotal   time.Duration `json:"gc_pause_total"`
    NumGC          uint32        `json:"num_gc"`
    Version        string        `json:"version"`
}

func NewHealthChecker(timeout time.Duration) *HealthChecker {
    return &HealthChecker{
        checks:  make(map[string]HealthCheck),
        timeout: timeout,
    }
}

func (h *HealthChecker) AddCheck(check HealthCheck) {
    h.mu.Lock()
    defer h.mu.Unlock()
    h.checks[check.Name()] = check
}

func (h *HealthChecker) RemoveCheck(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.checks, name)
}

func (h *HealthChecker) Check(ctx context.Context) HealthStatus {
    start := time.Now()

    h.mu.RLock()
    checks := make(map[string]HealthCheck)
    for name, check := range h.checks {
        checks[name] = check
    }
    h.mu.RUnlock()

    results := make(map[string]CheckResult)
    overallStatus := "healthy"

    // Run all checks
    for name, check := range checks {
        checkStart := time.Now()

        ctx, cancel := context.WithTimeout(ctx, h.timeout)
        err := check.Check(ctx)
        cancel()

        duration := time.Since(checkStart)

        if err != nil {
            overallStatus = "unhealthy"
            results[name] = CheckResult{
                Status:   "unhealthy",
                Error:    err.Error(),
                Duration: duration,
            }
        } else {
            results[name] = CheckResult{
                Status:   "healthy",
                Duration: duration,
            }
        }
    }

    return HealthStatus{
        Status:    overallStatus,
        Timestamp: start,
        Duration:  time.Since(start).String(),
        Checks:    results,
        System:    getSystemInfo(),
    }
}

func (h *HealthChecker) Handler() http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()
        health := h.Check(ctx)

        w.Header().Set("Content-Type", "application/json")

        if health.Status == "healthy" {
            w.WriteHeader(http.StatusOK)
        } else {
            w.WriteHeader(http.StatusServiceUnavailable)
        }

        json.NewEncoder(w).Encode(health)
    }
}

func getSystemInfo() SystemInfo {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)

    return SystemInfo{
        Uptime:         time.Since(startTime),
        Goroutines:     runtime.NumGoroutine(),
        MemoryAlloc:    m.Alloc,
        MemorySys:      m.Sys,
        GCPauseTotal:   time.Duration(m.PauseTotalNs),
        NumGC:          m.NumGC,
        Version:        runtime.Version(),
    }
}

// WebSocket-specific health checks
type WebSocketHealthCheck struct {
    hub *Hub
}

func NewWebSocketHealthCheck(hub *Hub) *WebSocketHealthCheck {
    return &WebSocketHealthCheck{hub: hub}
}

func (w *WebSocketHealthCheck) Name() string {
    return "websocket"
}

func (w *WebSocketHealthCheck) Check(ctx context.Context) error {
    if w.hub == nil {
        return fmt.Errorf("websocket hub is nil")
    }

    // Check if hub is running
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        // Hub is responsive
        return nil
    }
}

// Redis health check (if using Redis for scaling)
type RedisHealthCheck struct {
    client interface{} // Your Redis client
}

func (r *RedisHealthCheck) Name() string {
    return "redis"
}

func (r *RedisHealthCheck) Check(ctx context.Context) error {
    // Implement Redis ping
    return nil
}
```

### Distributed Tracing

Add distributed tracing for debugging complex WebSocket interactions:

```go
package tracing

import (
    "context"
    "fmt"
    "net/http"
    "time"

    "github.com/gorilla/websocket"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/trace"
)

const (
    instrumentationName = "websocket-server"
)

var tracer = otel.Tracer(instrumentationName)

// Trace wrapper for WebSocket connections
type TracedConnection struct {
    *websocket.Conn
    clientID string
    ctx      context.Context
    span     trace.Span
}

func NewTracedConnection(conn *websocket.Conn, clientID string, ctx context.Context) *TracedConnection {
    ctx, span := tracer.Start(ctx, "websocket.connection",
        trace.WithAttributes(
            attribute.String("client.id", clientID),
            attribute.String("connection.type", "websocket"),
        ),
    )

    return &TracedConnection{
        Conn:     conn,
        clientID: clientID,
        ctx:      ctx,
        span:     span,
    }
}

func (tc *TracedConnection) ReadMessage() (messageType int, p []byte, err error) {
    ctx, span := tracer.Start(tc.ctx, "websocket.read_message",
        trace.WithAttributes(
            attribute.String("client.id", tc.clientID),
        ),
    )
    defer span.End()

    start := time.Now()
    messageType, p, err = tc.Conn.ReadMessage()

    span.SetAttributes(
        attribute.Int("message.type", messageType),
        attribute.Int("message.size", len(p)),
        attribute.String("duration", time.Since(start).String()),
    )

    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
    } else {
        span.SetStatus(codes.Ok, "")
    }

    return messageType, p, err
}

func (tc *TracedConnection) WriteMessage(messageType int, data []byte) error {
    ctx, span := tracer.Start(tc.ctx, "websocket.write_message",
        trace.WithAttributes(
            attribute.String("client.id", tc.clientID),
            attribute.Int("message.type", messageType),
            attribute.Int("message.size", len(data)),
        ),
    )
    defer span.End()

    start := time.Now()
    err := tc.Conn.WriteMessage(messageType, data)

    span.SetAttributes(
        attribute.String("duration", time.Since(start).String()),
    )

    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
    } else {
        span.SetStatus(codes.Ok, "")
    }

    return err
}

func (tc *TracedConnection) Close() error {
    defer tc.span.End()
    return tc.Conn.Close()
}

// Middleware for HTTP to WebSocket upgrade tracing
func TracingUpgradeMiddleware(upgrader websocket.Upgrader) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Extract tracing context from HTTP headers
        ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))

        ctx, span := tracer.Start(ctx, "websocket.upgrade",
            trace.WithAttributes(
                attribute.String("http.method", r.Method),
                attribute.String("http.url", r.URL.String()),
                attribute.String("http.remote_addr", r.RemoteAddr),
                attribute.String("http.user_agent", r.UserAgent()),
            ),
        )
        defer span.End()

        // Attempt WebSocket upgrade
        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
            span.RecordError(err)
            span.SetStatus(codes.Error, fmt.Sprintf("WebSocket upgrade failed: %v", err))
            return
        }

        span.SetStatus(codes.Ok, "WebSocket upgraded successfully")

        clientID := generateClientID() // Implement your client ID generation
        tracedConn := NewTracedConnection(conn, clientID, ctx)

        // Continue with your WebSocket handler logic
        handleWebSocketConnection(tracedConn)
    }
}

// Message processing with tracing
func TraceMessageProcessing(ctx context.Context, messageType string, handler func(context.Context) error) error {
    ctx, span := tracer.Start(ctx, fmt.Sprintf("websocket.process_%s", messageType),
        trace.WithAttributes(
            attribute.String("message.type", messageType),
        ),
    )
    defer span.End()

    start := time.Now()
    err := handler(ctx)

    span.SetAttributes(
        attribute.String("processing.duration", time.Since(start).String()),
    )

    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
    } else {
        span.SetStatus(codes.Ok, "")
    }

    return err
}
```

## Advanced Production Features

### Circuit Breaker Implementation

Protect your WebSocket service from cascading failures:

```go
package circuitbreaker

import (
    "context"
    "errors"
    "sync"
    "time"
)

type State int

const (
    StateClosed State = iota
    StateHalfOpen
    StateOpen
)

type CircuitBreaker struct {
    name         string
    maxRequests  uint32
    interval     time.Duration
    timeout      time.Duration
    readyToTrip  func(counts Counts) bool
    onStateChange func(name string, from State, to State)

    mutex      sync.Mutex
    state      State
    generation uint64
    counts     Counts
    expiry     time.Time
}

type Counts struct {
    Requests             uint32
    TotalSuccesses       uint32
    TotalFailures        uint32
    ConsecutiveSuccesses uint32
    ConsecutiveFailures  uint32
}

var (
    ErrTooManyRequests = errors.New("circuit breaker: too many requests")
    ErrOpenState       = errors.New("circuit breaker: circuit breaker is open")
)

func NewCircuitBreaker(settings Settings) *CircuitBreaker {
    cb := &CircuitBreaker{
        name:          settings.Name,
        maxRequests:   settings.MaxRequests,
        interval:      settings.Interval,
        timeout:       settings.Timeout,
        readyToTrip:   settings.ReadyToTrip,
        onStateChange: settings.OnStateChange,
    }

    cb.toNewGeneration(time.Now())
    return cb
}

func (cb *CircuitBreaker) Execute(req func() (interface{}, error)) (interface{}, error) {
    generation, err := cb.beforeRequest()
    if err != nil {
        return nil, err
    }

    defer func() {
        e := recover()
        if e != nil {
            cb.afterRequest(generation, false)
            panic(e)
        }
    }()

    result, err := req()
    cb.afterRequest(generation, err == nil)
    return result, err
}

func (cb *CircuitBreaker) ExecuteContext(ctx context.Context, req func(context.Context) (interface{}, error)) (interface{}, error) {
    generation, err := cb.beforeRequest()
    if err != nil {
        return nil, err
    }

    defer func() {
        e := recover()
        if e != nil {
            cb.afterRequest(generation, false)
            panic(e)
        }
    }()

    result, err := req(ctx)
    cb.afterRequest(generation, err == nil)
    return result, err
}

func (cb *CircuitBreaker) beforeRequest() (uint64, error) {
    cb.mutex.Lock()
    defer cb.mutex.Unlock()

    now := time.Now()
    state, generation := cb.currentState(now)

    if state == StateOpen {
        return generation, ErrOpenState
    } else if state == StateHalfOpen && cb.counts.Requests >= cb.maxRequests {
        return generation, ErrTooManyRequests
    }

    cb.counts.Requests++
    return generation, nil
}

func (cb *CircuitBreaker) afterRequest(before uint64, success bool) {
    cb.mutex.Lock()
    defer cb.mutex.Unlock()

    now := time.Now()
    state, generation := cb.currentState(now)
    if generation != before {
        return
    }

    if success {
        cb.onSuccess(state, now)
    } else {
        cb.onFailure(state, now)
    }
}

func (cb *CircuitBreaker) onSuccess(state State, now time.Time) {
    cb.counts.TotalSuccesses++
    cb.counts.ConsecutiveSuccesses++
    cb.counts.ConsecutiveFailures = 0

    if state == StateHalfOpen {
        cb.setState(StateClosed, now)
    }
}

func (cb *CircuitBreaker) onFailure(state State, now time.Time) {
    cb.counts.TotalFailures++
    cb.counts.ConsecutiveFailures++
    cb.counts.ConsecutiveSuccesses = 0

    if cb.readyToTrip(cb.counts) {
        cb.setState(StateOpen, now)
    }
}

func (cb *CircuitBreaker) currentState(now time.Time) (State, uint64) {
    switch cb.state {
    case StateClosed:
        if !cb.expiry.IsZero() && cb.expiry.Before(now) {
            cb.toNewGeneration(now)
        }
    case StateOpen:
        if cb.expiry.Before(now) {
            cb.setState(StateHalfOpen, now)
        }
    }
    return cb.state, cb.generation
}

func (cb *CircuitBreaker) setState(state State, now time.Time) {
    if cb.state == state {
        return
    }

    prev := cb.state
    cb.state = state
    cb.toNewGeneration(now)

    if cb.onStateChange != nil {
        cb.onStateChange(cb.name, prev, state)
    }
}

func (cb *CircuitBreaker) toNewGeneration(now time.Time) {
    cb.generation++
    cb.counts = Counts{}

    var zero time.Time
    switch cb.state {
    case StateClosed:
        if cb.interval == 0 {
            cb.expiry = zero
        } else {
            cb.expiry = now.Add(cb.interval)
        }
    case StateOpen:
        cb.expiry = now.Add(cb.timeout)
    default: // StateHalfOpen
        cb.expiry = zero
    }
}

// WebSocket-specific circuit breaker settings
type Settings struct {
    Name        string
    MaxRequests uint32
    Interval    time.Duration
    Timeout     time.Duration
    ReadyToTrip func(counts Counts) bool
    OnStateChange func(name string, from State, to State)
}

// Default settings for WebSocket connections
func DefaultWebSocketSettings() Settings {
    return Settings{
        Name:        "websocket",
        MaxRequests: 5,
        Interval:    60 * time.Second,
        Timeout:     60 * time.Second,
        ReadyToTrip: func(counts Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 3 && failureRatio >= 0.6
        },
        OnStateChange: func(name string, from State, to State) {
            // Log state changes or emit metrics
        },
    }
}
```

## Resources and Further Reading

- [Gorilla WebSocket Documentation](https://github.com/gorilla/websocket) - The
  most popular WebSocket library for Go
- [nhooyr/websocket Documentation](https://github.com/nhooyr/websocket) -
  Modern, context-aware WebSocket library
- [Go Concurrency Patterns](https://go.dev/blog/pipelines) - Essential reading
  for WebSocket connection management
- [Effective Go](https://go.dev/doc/effective_go) - Official Go best practices
  guide
- [Go WebSocket Tutorial](https://github.com/golang-standards/project-layout) -
  Standard project layout for Go applications
- [OpenTelemetry Go](https://opentelemetry.io/docs/instrumentation/go/) -
  Observability and tracing for Go applications
- [Prometheus Go Client](https://prometheus.io/docs/guides/go-application/) -
  Metrics collection for Go applications
- [Go Context Package](https://pkg.go.dev/context) - Essential for managing
  WebSocket connection lifecycles

This comprehensive guide provides everything you need to build production-ready
WebSocket applications in Go. The combination of Go's excellent concurrency
model, robust libraries, and the patterns demonstrated here will help you create
scalable, maintainable, and observable real-time applications that can handle
thousands of concurrent connections with ease.

## Go's Design Philosophy and WebSocket Excellence

Go's design philosophy aligns perfectly with the requirements of WebSocket
development. The language was created at Google specifically to address the
challenges of modern networked services, and this focus is evident in every
aspect of its design. The built-in concurrency primitives aren't just additions
to the language - they're fundamental to how Go programs are structured. This
makes Go particularly well-suited for WebSocket servers that need to handle
thousands of concurrent connections efficiently.

The simplicity of Go's approach to error handling, while sometimes criticized,
actually works well for WebSocket applications. The explicit error checking
encourages developers to think about failure modes at every step, resulting in
more robust applications. This is particularly important for WebSocket
connections, which can fail in numerous ways - network issues, protocol
violations, timeouts, and application errors all need to be handled gracefully.

Go's compilation to native binaries provides significant operational advantages.
Deployment is as simple as copying a single binary file, with no runtime
dependencies to manage. This simplicity extends to containerization, where Go
applications result in minimal Docker images that start quickly and use less
memory. For WebSocket applications that might need to scale horizontally across
many instances, these operational characteristics translate into real cost
savings and improved reliability.

The community around Go has embraced WebSockets enthusiastically, creating a
rich ecosystem of libraries and tools. From the battle-tested Gorilla WebSocket
library to more recent additions like nhooyr/websocket, developers have choices
that suit different use cases and preferences. This healthy ecosystem ensures
that Go will remain a strong choice for WebSocket development for years to come.

The future of Go WebSocket development looks particularly bright with ongoing
language improvements and the growing adoption of WebAssembly. As Go continues
to evolve with better generics support and improved tooling, WebSocket
applications will benefit from cleaner code and better type safety while
maintaining the performance characteristics that make Go so attractive for
network programming.

## Frequently Asked Questions

### What is the best Go WebSocket library?

Gorilla WebSocket is the most popular and battle-tested choice. nhooyr/websocket
is a newer alternative with a simpler API and better context support. Both are
production-ready. Gorilla has more examples and community resources.

### How do I handle concurrent WebSocket connections in Go?

Use one goroutine per connection for reading and one for writing. Protect shared
state with `sync.Mutex` or use channels to coordinate. Go goroutines are
lightweight, so thousands of concurrent connections are practical.

### Is Go good for WebSocket servers?

Yes, Go is excellent for WebSocket servers. Goroutines handle thousands of
concurrent connections efficiently without thread overhead. Static binaries
deploy easily, and Go's standard library has built-in HTTP upgrade support.

### How do I add WebSocket support to an existing Go HTTP server?

Use `gorilla/websocket` Upgrader to upgrade HTTP connections. Create an Upgrader
instance, call `Upgrade()` in your HTTP handler, then read and write messages on
the returned Conn. The upgrade happens on your existing HTTP server and port.

## Related Content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) -
  The protocol Go WebSocket libraries implement
- [Python WebSocket Guide](/guides/languages/python/) - Compare Go's approach
  with Python's asyncio WebSocket patterns
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) - Full
  list of Go WebSocket libraries including Melody and Centrifugo
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  that complement Go's concurrency model
- [WebSocket Security](/guides/security/) - Securing Go WebSocket servers with
  TLS and authentication
