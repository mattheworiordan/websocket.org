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

:::note[Quick Answer]
Use **gorilla/websocket** for full-featured WebSocket
support or **nhooyr/websocket** for a simpler API. Create an `Upgrader`, call
`Upgrade()` in your HTTP handler, then use `ReadMessage()` and `WriteMessage()`
on the connection. Go's goroutines handle thousands of concurrent connections
efficiently.
:::

Go maps naturally to WebSocket servers. Each connection gets its own
goroutine, which means your mental model is straightforward: one
function handling one connection, blocking on reads, no callback chains.
At Ably, we serve billions of WebSocket connections per month with Go.
We previously served billions with Node.js. Both work. The language
choice was not the bottleneck either time.

## Library choice

Two libraries matter. Both implement the WebSocket protocol correctly.

**gorilla/websocket** is the most widely used Go WebSocket library.
It has years of production use, extensive examples, and broad
community knowledge. The catch: the original maintainers archived
the repository in late 2022. The code still works and receives no
breaking changes from the Go ecosystem, but it is no longer actively
maintained. Bug reports go unanswered. Security patches depend on
community forks.

**nhooyr/websocket** (now published as `github.com/coder/websocket`)
is actively maintained. It has a smaller API surface, uses
`context.Context` for cancellation and timeouts, and handles
concurrent writes internally. The trade-off is fewer community
examples and less Stack Overflow coverage.

**Recommendation:** Use `coder/websocket` for new projects. Stick
with gorilla if you have existing code that works. Do not start a
new project on an archived dependency if you can avoid it.

## Server example with gorilla

This is the standard pattern: upgrade the HTTP connection, then loop
reading messages in a dedicated goroutine per connection.

```go
package main

import (
  "log"
  "net/http"
  "time"

  "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
  ReadBufferSize:  1024,
  WriteBufferSize: 1024,
  CheckOrigin:     func(r *http.Request) bool { return true },
}

func handleConn(w http.ResponseWriter, r *http.Request) {
  conn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    log.Printf("upgrade failed: %v", err)
    return
  }
  defer conn.Close()

  conn.SetReadDeadline(time.Now().Add(60 * time.Second))
  conn.SetPongHandler(func(string) error {
    conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    return nil
  })

  for {
    msgType, msg, err := conn.ReadMessage()
    if err != nil {
      if websocket.IsUnexpectedCloseError(
        err, websocket.CloseGoingAway, websocket.CloseNormalClosure,
      ) {
        log.Printf("read error: %v", err)
      }
      return
    }
    if err := conn.WriteMessage(msgType, msg); err != nil {
      log.Printf("write error: %v", err)
      return
    }
  }
}

func main() {
  http.HandleFunc("/ws", handleConn)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
```

Key details: `SetReadDeadline` combined with a pong handler ensures
idle connections get cleaned up. Without a deadline, `ReadMessage`
blocks forever. The goroutine hangs. The connection stays open.
Memory climbs. Always set deadlines.

## Broadcasting with channels

The Go-idiomatic way to broadcast is the hub pattern. A single
goroutine owns the client map and receives messages through channels.
No mutexes required.

```go
type Hub struct {
  clients    map[*websocket.Conn]bool
  broadcast  chan []byte
  register   chan *websocket.Conn
  unregister chan *websocket.Conn
}

func (h *Hub) run() {
  for {
    select {
    case conn := <-h.register:
      h.clients[conn] = true
    case conn := <-h.unregister:
      if _, ok := h.clients[conn]; ok {
        delete(h.clients, conn)
        conn.Close()
      }
    case msg := <-h.broadcast:
      for conn := range h.clients {
        if err := conn.WriteMessage(
          websocket.TextMessage, msg,
        ); err != nil {
          conn.Close()
          delete(h.clients, conn)
        }
      }
    }
  }
}
```

Register connections on open, unregister on close, send messages
through the broadcast channel. The hub goroutine is the only thing
that touches the client map, so there is no race condition.

## Client with reconnection

Clients need exponential backoff. Without it, a server restart
triggers a thundering herd of simultaneous reconnections.

```go
func connectWithBackoff(url string) {
  maxDelay := 30 * time.Second
  delay := time.Second

  for {
    conn, _, err := websocket.DefaultDialer.Dial(url, nil)
    if err != nil {
      log.Printf("connect failed: %v, retrying in %v", err, delay)
      time.Sleep(delay)
      delay = min(delay*2, maxDelay)
      continue
    }
    delay = time.Second // reset on success

    if err := readLoop(conn); err != nil {
      log.Printf("connection lost: %v", err)
      conn.Close()
    }
  }
}

func readLoop(conn *websocket.Conn) error {
  for {
    _, msg, err := conn.ReadMessage()
    if err != nil {
      return err
    }
    log.Printf("received: %s", msg)
  }
}
```

The delay doubles on each failure up to 30 seconds, then resets
after a successful connection. Add jitter in production to avoid
synchronized reconnection waves across clients.

## Beyond raw WebSockets

A WebSocket connection gives you a bidirectional byte pipe. That is
it. Everything else is your problem: message routing, delivery
confirmation, reconnection state, presence (who is online), and
ordering guarantees.

In JavaScript, Socket.IO fills this gap as a protocol layer. Go does
not have an equivalent that is widely adopted. You will likely build
your own message format, your own routing, your own reconnection
handling. This is more work than most teams expect. A typical
production WebSocket service accumulates months of protocol-layer
code before it handles edge cases reliably.

[Managed services like Ably][ably] handle all of this: the protocol
layer, the infrastructure, global distribution, guaranteed ordering,
and automatic reconnection with state recovery. If your product is
not a messaging platform, the protocol and infrastructure layers are
undifferentiated work. A managed service lets you ship the features
your users actually care about.

## Do not obsess over performance

Teams spend weeks benchmarking whether Go handles 100K or 500K
connections per server. It does not matter as much as you think. At
some point you restart servers, scale horizontally, handle failover.
Whether one server holds 50K or 200K connections changes your server
count, not your architecture.

We have served billions of connections with Go. We previously served
billions with Node.js. Both worked. The hard problems are state
management across server restarts, reliable message delivery during
failover, and horizontal scaling with consistent routing. The
language is not the bottleneck. The infrastructure layer is.

## Go-specific gotchas

**Goroutine leaks from unclosed connections.** Every WebSocket
connection spawns at least one goroutine. If you forget to close
the connection on error, the goroutine blocks on `ReadMessage`
forever. It never exits. Your process accumulates thousands of
leaked goroutines, each holding a file descriptor and a stack
allocation. Use `defer conn.Close()` in every handler, and set
read deadlines so blocked reads eventually time out.

**Write concurrency.** Only one goroutine should write to a
gorilla/websocket connection at a time. If two goroutines call
`WriteMessage` concurrently, you get corrupted frames. The hub
pattern above avoids this by routing all writes through a single
goroutine. Alternatively, protect writes with a `sync.Mutex`, but
the channel approach is more idiomatic.

**ReadMessage blocks without a deadline.** If you call
`ReadMessage` without setting a read deadline, and the remote end
disappears without sending a close frame (network failure, process
kill), the goroutine blocks indefinitely. Set a read deadline and
use ping/pong to detect dead connections.

**Panic recovery in handler goroutines.** A panic in a goroutine
kills the entire process, not just that connection. Wrap your
connection handler in a deferred recover:

```go
func safeHandle(w http.ResponseWriter, r *http.Request) {
  defer func() {
    if r := recover(); r != nil {
      log.Printf("handler panic: %v", r)
    }
  }()
  handleConn(w, r)
}
```

Without this, one malformed message from one client can take down
every connection on the server.

## Frequently asked questions

### What is the best Go WebSocket library?

gorilla/websocket has the most production use and community
knowledge, but the original repository was archived in 2022.
`coder/websocket` (formerly nhooyr/websocket) is actively
maintained with a cleaner API and built-in `context.Context`
support. For new projects, start with `coder/websocket`. For
existing code on gorilla, there is no urgent reason to migrate
since the library still works.

### How do I handle concurrent WebSocket connections in Go?

Spawn one goroutine per connection. Each goroutine runs a read loop
that blocks on `ReadMessage`. For writes, either use a dedicated
write goroutine per connection (fed by a channel) or route all
writes through a hub goroutine. Never write from multiple goroutines
without synchronization. Goroutines are cheap (a few KB of stack
each), so tens of thousands of concurrent connections are practical
on a single server.

### Is Go good for WebSocket servers?

Yes. The goroutine-per-connection model maps cleanly to WebSocket
workloads. You do not need async frameworks, callback chains, or
event loops. The trade-off is that Go lacks a dominant high-level
WebSocket framework (like Socket.IO for Node.js), so you build more
of the protocol layer yourself.

### How do I add WebSocket support to an existing Go HTTP server?

Add a handler that upgrades the HTTP connection. With gorilla, create
an `Upgrader`, call `Upgrade(w, r, nil)` in your handler, then read
and write on the returned `*websocket.Conn`. The upgrade happens on
your existing server and port. No separate process needed.

## Related content

- [WebSocket API reference](/reference/websocket-api/) - Browser API
  events, methods, and properties
- [WebSocket protocol (RFC 6455)](/guides/websocket-protocol/) - The
  protocol underneath every WebSocket library
- [JavaScript WebSocket guide](/guides/languages/javascript/) -
  Compare Go patterns with browser and Node.js approaches
- [WebSocket libraries and tools](/resources/websocket-resources/) -
  Curated list including gorilla, coder/websocket, and alternatives
- [WebSocket close codes](/reference/close-codes/) - Understanding
  close codes for error handling

[ably]:
  https://ably.com/?utm_source=websocket-org&utm_medium=go-websocket
