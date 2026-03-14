---
title: "Go WebSocket Server Guide: coder/websocket vs Gorilla"
description:
  "Build production Go WebSocket servers with coder/websocket. Context
  cancellation, graceful shutdown, connection hub pattern, and
  concurrency gotchas."
sidebar:
  order: 3
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: "2024-09-02"
lastUpdated: 2026-03-14
category: guide
keywords:
  - go websocket
  - golang websocket
  - gorilla websocket
  - go websocket server
  - coder websocket
seo:
  keywords:
    - go websocket
    - golang websocket
    - gorilla websocket
    - go websocket server
    - go websocket client
    - coder websocket
    - golang realtime
    - go websocket goroutine
faq:
  - q: "What is the best Go WebSocket library?"
    a:
      "Use coder/websocket (formerly nhooyr/websocket) for new projects.
      It has context.Context support, handles concurrent writes safely,
      and is actively maintained. gorilla/websocket still works but the
      original repo was archived in 2022."
  - q: "How do I handle concurrent WebSocket connections in Go?"
    a:
      "Use one goroutine per connection for reading and a separate
      goroutine or channel-based hub for writing. Never call
      WriteMessage from multiple goroutines on gorilla/websocket
      without synchronization. coder/websocket handles concurrent
      writes internally."
  - q: "Is Go good for WebSocket servers?"
    a:
      "Yes. Go's goroutine-per-connection model maps directly to
      WebSocket workloads. No async frameworks or event loops needed.
      A single server handles tens of thousands of concurrent
      connections with a few KB of stack per goroutine."
  - q: "How do I gracefully shut down a Go WebSocket server?"
    a:
      "Use signal.NotifyContext to catch SIGINT/SIGTERM, pass the
      context to http.Server, then call Shutdown() with a timeout.
      This drains existing connections before the process exits."
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
Use **coder/websocket** (`github.com/coder/websocket`) for new Go
WebSocket projects. It supports `context.Context` for cancellation
and timeouts, handles concurrent writes safely, and is actively
maintained. gorilla/websocket still works but is archived.
:::

Go's goroutine-per-connection model is a natural fit for WebSocket
servers. Each connection gets its own goroutine, blocking on reads,
no callback chains. The code reads like synchronous logic but
handles thousands of connections concurrently.

## Which library to use

**coder/websocket** (formerly `nhooyr/websocket`) is the right
choice for new projects. It uses `context.Context` throughout, so
cancellation and timeouts work the way Go developers expect. It
handles concurrent writes internally, which removes an entire
class of bugs. And it is actively maintained.

**gorilla/websocket** is the library you will find in most existing
Go codebases. It has years of production use and the most Stack
Overflow answers. But the original repository was archived in late
2022. The code still works. No breaking changes have come from the
Go ecosystem. But bug reports go unanswered and security patches
depend on community forks.

If you have an existing gorilla codebase that works, keep it. If
you are starting fresh, use coder/websocket. Do not build on an
archived dependency when a maintained alternative exists.

## Server with context cancellation

This server uses coder/websocket with proper context propagation.
The request context controls the connection lifetime, so when the
client disconnects or the server shuts down, everything cleans up
automatically.

```go
package main

import (
  "context"
  "log"
  "net/http"
  "time"

  "github.com/coder/websocket"
)

func handleWS(w http.ResponseWriter, r *http.Request) {
  conn, err := websocket.Accept(w, r, nil)
  if err != nil {
    log.Printf("accept failed: %v", err)
    return
  }
  defer conn.CloseNow()

  ctx := conn.CloseRead(r.Context())

  for {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    _, msg, err := conn.Read(ctx)
    cancel()
    if err != nil {
      return // context cancelled or connection closed
    }
    err = conn.Write(ctx, websocket.MessageText, msg)
    if err != nil {
      return
    }
  }
}
```

`conn.CloseRead` returns a context that is cancelled when the
client sends a close frame. Every read and write takes a context
with a timeout. No manual deadline management, no pong handlers,
no goroutine leaks. When the context expires, the operation
returns an error and the connection closes.

## Graceful shutdown with signal handling

Production servers need to drain connections before exiting. A
`SIGTERM` during a deployment should not drop every connected
client mid-message.

```go
func main() {
  ctx, stop := signal.NotifyContext(
    context.Background(), os.Interrupt, syscall.SIGTERM,
  )
  defer stop()

  srv := &http.Server{
    Addr:    ":8080",
    Handler: http.HandlerFunc(handleWS),
  }

  go func() {
    if err := srv.ListenAndServe(); err != http.ErrServerClosed {
      log.Fatalf("server error: %v", err)
    }
  }()

  <-ctx.Done()
  log.Println("shutting down, draining connections...")

  shutdownCtx, cancel := context.WithTimeout(
    context.Background(), 10*time.Second,
  )
  defer cancel()
  srv.Shutdown(shutdownCtx)
}
```

`signal.NotifyContext` catches `SIGINT` and `SIGTERM`, then
`Shutdown` waits up to 10 seconds for active connections to
finish. After that, the process exits. This is the pattern you
want in a Kubernetes deployment where the pod gets a `SIGTERM`
before being killed.

## Connection hub pattern

Broadcasting to multiple clients requires coordinating writes.
The hub pattern uses a single goroutine that owns the client map
and receives messages through channels. No mutexes needed.

```go
type Hub struct {
  clients    map[*websocket.Conn]bool
  broadcast  chan []byte
  register   chan *websocket.Conn
  unregister chan *websocket.Conn
}

func newHub() *Hub {
  return &Hub{
    clients:    make(map[*websocket.Conn]bool),
    broadcast:  make(chan []byte, 256),
    register:   make(chan *websocket.Conn),
    unregister: make(chan *websocket.Conn),
  }
}

func (h *Hub) run(ctx context.Context) {
  for {
    select {
    case <-ctx.Done():
      for c := range h.clients {
        c.CloseNow()
      }
      return
    case conn := <-h.register:
      h.clients[conn] = true
    case conn := <-h.unregister:
      delete(h.clients, conn)
      conn.CloseNow()
    case msg := <-h.broadcast:
      for c := range h.clients {
        ctx, cancel := context.WithTimeout(
          context.Background(), 5*time.Second,
        )
        err := c.Write(ctx, websocket.MessageText, msg)
        cancel()
        if err != nil {
          delete(h.clients, c)
          c.CloseNow()
        }
      }
    }
  }
}
```

Register connections on open, unregister on close, send messages
through the broadcast channel. The hub goroutine is the only thing
that touches the client map, so there is no race condition. The
context parameter lets the hub shut down cleanly when the server
stops.

## Client with reconnection

Clients need exponential backoff with jitter. Without jitter, a
server restart triggers a wall of simultaneous reconnections that
can overload the new instance.

```go
func connectWithBackoff(ctx context.Context, url string) {
  maxDelay := 30 * time.Second
  delay := time.Second

  for {
    conn, _, err := websocket.Dial(ctx, url, nil)
    if err != nil {
      jitter := time.Duration(rand.Int63n(int64(delay / 2)))
      wait := delay + jitter
      log.Printf("connect failed, retrying in %v", wait)
      select {
      case <-time.After(wait):
      case <-ctx.Done():
        return
      }
      delay = min(delay*2, maxDelay)
      continue
    }
    delay = time.Second

    if err := readLoop(ctx, conn); err != nil {
      log.Printf("connection lost: %v", err)
      conn.CloseNow()
    }
  }
}
```

The context makes this cancellable. When the parent context is
cancelled (application shutdown, user action), the reconnection
loop exits cleanly instead of retrying forever.

## Go-specific gotchas

**Goroutine leaks from unclosed connections.** Every WebSocket
connection spawns at least one goroutine. If you forget to close
the connection on error, the goroutine blocks on `Read` forever.
It never exits. Memory climbs. File descriptors leak. Always use
`defer conn.CloseNow()` in every handler, and use contexts with
timeouts so blocked reads eventually return.

**Concurrent write panics (gorilla only).** gorilla/websocket
panics if two goroutines call `WriteMessage` at the same time.
This is the most common production bug in Go WebSocket code. The
hub pattern avoids it by routing all writes through a single
goroutine. coder/websocket handles concurrent writes internally,
which is one reason to prefer it for new code.

**Read goroutine pattern.** The standard pattern is one goroutine
reading and one writing per connection. The reader blocks on
`ReadMessage`, the writer reads from a channel. Do not mix read
and write on the same goroutine unless you are using
coder/websocket's `CloseRead` pattern, which handles this for
you.

**Context propagation matters.** Pass the request context (or a
derived context) into your connection handler. If you create a
background context instead, the connection survives server
shutdown, request cancellation, and timeout enforcement. The
whole point of Go's context system is propagation. Use it.

**Panic recovery in handler goroutines.** A panic in a goroutine
kills the entire process, not just that connection. Wrap your
handler:

```go
func safeHandle(w http.ResponseWriter, r *http.Request) {
  defer func() {
    if v := recover(); v != nil {
      log.Printf("handler panic: %v", v)
    }
  }()
  handleWS(w, r)
}
```

One malformed message from one client should not take down every
connection on the server.

## Beyond raw WebSockets

A WebSocket connection gives you a bidirectional byte pipe. That
is it. Everything else is your problem: message routing, delivery
confirmation, reconnection state, presence, and ordering
guarantees.

Go does not have an equivalent to Socket.IO. You will build your
own message format, your own routing, your own reconnection
handling. This is more work than most teams expect. A typical
production WebSocket service accumulates months of protocol-layer
code before it handles edge cases reliably.

[Managed services like Ably][ably] handle the protocol layer,
infrastructure, global distribution, and automatic reconnection
with state recovery. If your product is not a messaging platform,
the protocol and infrastructure layers are undifferentiated work.

## Frequently asked questions

### What is the best Go WebSocket library?

coder/websocket (formerly nhooyr/websocket) for new projects.
It uses `context.Context` for cancellation and timeouts, handles
concurrent writes without panics, and is actively maintained.
gorilla/websocket has the most community knowledge and existing
code, but the original repo was archived in late 2022. If you
have working gorilla code, there is no urgent reason to rewrite
it. But do not start a new project on an archived dependency.

### How do I handle concurrent connections in Go?

Spawn one goroutine per connection with a read loop. For writes,
either use a dedicated write goroutine per connection (fed by a
channel) or route all writes through a hub goroutine. With
gorilla, never write from multiple goroutines without
synchronization or you will get corrupted frames and panics.
With coder/websocket, concurrent writes are safe. Goroutines are
cheap (a few KB of stack each), so tens of thousands of concurrent
connections are practical on a single server.

### How do I gracefully shut down a Go WebSocket server?

Use `signal.NotifyContext` to catch `SIGINT` and `SIGTERM`. Pass
the context to your server logic and call `http.Server.Shutdown()`
with a timeout when the signal arrives. This stops accepting new
connections and waits for existing handlers to finish. Set a
reasonable timeout (10-30 seconds) so the process eventually exits
even if some connections hang. In Kubernetes, this aligns with the
pod termination grace period.

### Is Go good for WebSocket servers?

Yes. The goroutine-per-connection model maps directly to WebSocket
workloads without async frameworks or event loops. The trade-off
is that Go lacks a high-level WebSocket framework like Socket.IO,
so you build more of the protocol layer yourself. For raw
connections with custom protocols, Go is a strong choice. For
applications that need rooms, presence, and message guarantees out
of the box, evaluate whether building that yourself is the right
use of your team's time.

## Related content

- [WebSocket protocol (RFC 6455)](/guides/websocket-protocol/) -
  The protocol underneath every WebSocket library
- [JavaScript WebSocket guide](/guides/languages/javascript/) -
  Compare Go patterns with browser and Node.js approaches
- [Rust WebSocket guide](/guides/languages/rust/) - Another
  systems language approach to WebSocket servers
- [WebSocket close codes](/reference/close-codes/) - Understanding
  close codes for error handling in your Go handlers
- [WebSocket libraries and tools](/resources/websocket-resources/)
  \- Curated list of Go WebSocket libraries and alternatives

[ably]:
  https://ably.com/?utm_source=websocket-org&utm_medium=go-websocket
