---
title: 'Rust WebSocket: tokio-tungstenite & actix-web Guide'
description:
  'Build Rust WebSocket servers with tokio-tungstenite and actix-web. Covers
  async patterns, connection management, error handling, performance
  optimization, and production deployment.'
sidebar:
  order: 4
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - rust websocket
  - tokio-tungstenite
  - actix websocket
  - rust websocket server
  - async websocket rust
seo:
  keywords:
    - rust websocket
    - tokio-tungstenite
    - actix websocket
    - rust websocket server
    - rust websocket client
    - async websocket rust
    - warp websocket
    - rust realtime
faq:
  - q: 'What is the best Rust WebSocket library?'
    a:
      'tokio-tungstenite is the most popular choice for async Rust WebSocket
      applications. It integrates with the tokio runtime and provides both
      client and server support. actix-web has built-in WebSocket support if you
      already use that framework.'
  - q: 'Is Rust good for WebSocket servers?'
    a:
      'Yes, Rust is excellent for high-performance WebSocket servers. Zero-cost
      abstractions, no garbage collection pauses, and memory safety without
      runtime overhead make Rust ideal for low-latency, high-throughput
      WebSocket applications.'
  - q: 'How do I handle multiple WebSocket connections in Rust?'
    a:
      'Use tokio async tasks - spawn one task per connection. Rust async tasks
      are lightweight like goroutines. Share state between connections using Arc
      and Mutex or channels (mpsc, broadcast). The borrow checker prevents data
      races at compile time.'
  - q: 'How does Rust WebSocket performance compare to other languages?'
    a:
      'Rust WebSocket servers typically have the lowest latency and highest
      throughput. No garbage collection means consistent 99th percentile
      latencies. Memory usage is predictable and low. Rust matches or exceeds
      C/C++ performance with memory safety guarantees.'
tags:
  - websocket
  - rust
  - tokio
  - async
  - websocket-rust
  - programming
  - tutorial
  - implementation
  - guide
  - how-to
---

:::note[Quick Answer]
Use **tokio-tungstenite** for async WebSocket support in
Rust. Add it with `cargo add tokio-tungstenite tokio`, accept connections with
`accept_async()`, and read/write with `StreamExt` and `SinkExt` traits. For the
actix-web framework, use its built-in WebSocket support.
:::

Rust gives you the lowest latency and most predictable performance
for WebSocket servers. No garbage collector means no GC pauses, so your
p99 latencies stay flat under load. The trade-off is real: steeper
learning curve, slower development velocity, and a smaller ecosystem of
WebSocket-specific libraries compared to Go or Node.js. Most WebSocket
applications are I/O-bound, not CPU-bound, so most teams won't need
what Rust offers here.

## WebSocket server with tokio-tungstenite

Add the dependencies to your `Cargo.toml`:

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.24"
futures-util = "0.3"
```

A minimal server that accepts connections, reads messages, and
broadcasts to other connected clients:

```rust
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};

type Clients = Arc<RwLock<HashMap<SocketAddr, broadcast::Sender<String>>>>;

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:8080").await.unwrap();
    let (tx, _) = broadcast::channel::<String>(256);

    loop {
        let (stream, addr) = listener.accept().await.unwrap();
        let tx = tx.clone();
        let mut rx = tx.subscribe();

        tokio::spawn(async move {
            let ws = accept_async(stream).await.unwrap();
            let (mut sink, mut stream) = ws.split();

            // Forward broadcasts to this client
            let send_task = tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    if sink.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Read from this client, broadcast to others
            while let Some(Ok(msg)) = stream.next().await {
                match msg {
                    Message::Text(text) => {
                        let _ = tx.send(text.to_string());
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }

            send_task.abort();
            eprintln!("{addr} disconnected");
        });
    }
}
```

This handles the WebSocket upgrade, splits each connection into
read/write halves, and uses a broadcast channel so every message
reaches all other clients. When a client disconnects, its task
ends and the channel subscription is dropped.

## Client with reconnection

```rust
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;

async fn connect_with_backoff(url: &str) {
    let mut delay = Duration::from_secs(1);

    loop {
        match connect_async(url).await {
            Ok((ws, _)) => {
                delay = Duration::from_secs(1); // reset on success
                let (mut sink, mut stream) = ws.split();
                sink.send(Message::Text("hello".into())).await.ok();

                while let Some(Ok(msg)) = stream.next().await {
                    eprintln!("received: {msg}");
                }
                eprintln!("disconnected, reconnecting...");
            }
            Err(e) => {
                eprintln!("connect failed: {e}");
            }
        }
        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(Duration::from_secs(30));
    }
}
```

The backoff caps at 30 seconds. In production, add jitter to
prevent all clients from reconnecting at the same instant after
a server restart.

## Shared state and the borrow checker

Rust's real advantage for WebSocket servers isn't raw speed. It's
that the compiler catches data races at compile time. If you try
to share mutable state across connections without proper
synchronization, your code won't compile.

Two common patterns for shared state:

```rust
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use std::collections::HashMap;

// Option 1: Arc<RwLock<T>> for shared mutable state
// Good for connection registries, user sessions
type UserMap = Arc<RwLock<HashMap<String, String>>>;

// Option 2: broadcast channel for fan-out
// Good for pub/sub, chat rooms, live updates
let (tx, _rx) = broadcast::channel::<String>(256);
```

`Arc<RwLock<T>>` works for connection registries and session
lookups. Broadcast channels are better for fan-out patterns
like chat rooms. For high-throughput scenarios, `dashmap` gives
you a concurrent HashMap without holding a lock across await
points, which avoids a common footgun with `RwLock` in async
code.

## Beyond raw WebSockets

Raw WebSocket libraries like tokio-tungstenite give you a
transport layer: open a connection, send frames, receive frames.
Everything above that, you build yourself.

Rust has no equivalent of Socket.IO or Phoenix Channels. There's
no off-the-shelf library for reconnection with message replay,
automatic room/channel management, presence tracking, or message
ordering guarantees. In Go or Node.js, you can reach for existing
libraries that handle some of this. In Rust, you're writing it
from scratch.

For most teams, this development cost outweighs Rust's runtime
performance advantage. If you need that infrastructure layer
without building it, managed services like
[Ably](https://ably.com?utm_source=websocket-org&utm_medium=rust-websocket)
handle connection management, message ordering, presence, and
failover regardless of what language your application uses.

## When NOT to use Rust

WebSocket servers are I/O-bound. Your server spends most of its
time waiting on network reads and writes, not crunching numbers.
Rust's CPU performance advantage doesn't help much when the
bottleneck is the network.

Go handles tens of thousands of WebSocket connections with
goroutines and a fast garbage collector that pauses for
microseconds, not milliseconds. Node.js does the same with its
event loop. Both get you to production faster with more library
choices.

Use Rust for WebSockets when you genuinely need sub-millisecond
latency consistency (trading systems, competitive gaming backends)
or when each message requires CPU-heavy processing (compression,
encryption, real-time audio/video transforms). If your server is
mostly routing messages between clients, the language matters
far less than your architecture: horizontal scaling, state
management, and having a protocol layer on top of raw WebSockets.

## Frequently asked questions

### What is the best Rust WebSocket library?

tokio-tungstenite is the most widely used option and integrates
directly with the tokio async runtime. It supports both client
and server use cases. If you're already using actix-web for HTTP,
its built-in WebSocket support avoids adding another dependency.
There is no clear "best" choice beyond these two, which reflects
how small the Rust WebSocket ecosystem is compared to Go or
JavaScript.

### Is Rust good for WebSocket servers?

Rust produces the lowest-latency, most memory-efficient WebSocket
servers you can build. No GC pauses, predictable memory usage,
and compile-time data race prevention are genuine advantages.
But "good" depends on your constraints. If development speed and
library ecosystem matter more than squeezing out the last
microsecond of latency, Go or Node.js may be a better fit.

### How do I handle multiple connections in Rust?

Spawn one tokio task per connection. Tokio tasks are lightweight,
similar to goroutines. Share state between connections using
`Arc<RwLock<T>>` for mutable state or broadcast channels for
fan-out messaging. The borrow checker prevents data races at
compile time, so if your code compiles, you don't have a race
condition in your shared state access.

### How does Rust WebSocket performance compare?

Rust WebSocket servers have the lowest latency and most
predictable throughput. No garbage collection means flat p99
latencies even under sustained load. But whether Rust handles
200K connections or Go handles 100K on the same hardware, your
architecture doesn't change. You still need horizontal scaling,
graceful restarts, and a protocol layer. The performance
difference rarely changes what you need to build.

## Related content

- [Go WebSocket Guide](/guides/languages/go/) - Compare Rust's approach with
  Go's goroutine-based concurrency
- [WebSocket Protocol: RFC 6455](/guides/websocket-protocol/) - The protocol
  Rust WebSocket libraries implement
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) - Full
  list including tokio-tungstenite, actix-web, and warp
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  for horizontal scaling and state management
- [WebSocket Security](/guides/security/) - TLS, authentication, and origin
  validation for WebSocket servers
