---
title: 'Rust WebSocket Guide: tokio-tungstenite, axum & JoinSet'
description:
  'Build production Rust WebSocket servers with tokio-tungstenite and
  axum. Graceful shutdown, ownership gotchas, and shared state patterns.'
sidebar:
  order: 4
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-14
category: guide
keywords:
  - rust websocket
  - tokio-tungstenite
  - axum websocket
  - rust websocket server
  - async websocket rust
seo:
  keywords:
    - rust websocket
    - tokio-tungstenite
    - axum websocket
    - rust websocket server
    - rust websocket client
    - async websocket rust
    - rust realtime
    - tungstenite
faq:
  - q: 'What is the best Rust WebSocket library?'
    a:
      'Use tokio-tungstenite for async WebSocket clients and servers.
      It builds on the tungstenite crate and integrates directly with
      tokio. For web applications, axum has built-in WebSocket support
      and is the recommended Rust web framework.'
  - q: 'Is Rust good for WebSocket servers?'
    a:
      'Rust produces the lowest-latency WebSocket servers with no GC
      pauses and predictable memory usage. The trade-off is development
      speed: Rust WebSocket code takes longer to write and the ecosystem
      is smaller than Go or Node.js.'
  - q: 'How do I handle multiple WebSocket connections in Rust?'
    a:
      'Spawn one tokio task per connection. Share state between tasks
      using broadcast channels for fan-out or Arc<RwLock<T>> for shared
      registries. The borrow checker prevents data races at compile
      time.'
  - q: 'How does Rust WebSocket performance compare to other languages?'
    a:
      'Rust WebSocket servers have flat p99 latencies under sustained
      load because there is no garbage collector. Memory usage is
      predictable and low. But most WebSocket servers are I/O-bound,
      so this advantage only matters for latency-critical workloads.'
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
Use **tokio-tungstenite** for async WebSocket clients and
servers. For web apps, **axum** has built-in WebSocket support.
Add `cargo add tokio-tungstenite tokio futures-util`, split
connections with `ws.split()`, and read/write with `StreamExt`
and `SinkExt`.
:::

Use tokio-tungstenite for standalone WebSocket servers and
clients. Use tungstenite (without tokio) if you need blocking
I/O. If you're building a web application, use axum -- it wraps
tungstenite and gives you routing, middleware, and WebSocket
upgrades in one framework.

## WebSocket server with tokio-tungstenite

Add the dependencies:

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.26"
futures-util = "0.3"
```

A broadcast server that upgrades connections, splits read/write
halves, and fans out messages:

```rust
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    let (tx, _) = broadcast::channel::<String>(256);
    eprintln!("listening on 127.0.0.1:8080");

    loop {
        let (stream, addr) = listener.accept().await?;
        let tx = tx.clone();
        let mut rx = tx.subscribe();

        tokio::spawn(async move {
            let Ok(ws) = accept_async(stream).await else {
                eprintln!("{addr}: handshake failed");
                return;
            };
            let (mut sink, mut source) = ws.split();

            let write = tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    if sink.send(Message::text(msg)).await.is_err() {
                        break;
                    }
                }
            });

            while let Some(Ok(msg)) = source.next().await {
                if let Message::Text(text) = msg {
                    let _ = tx.send(text.into());
                }
            }
            write.abort();
            eprintln!("{addr} disconnected");
        });
    }
}
```

`ws.split()` gives you two halves you can move into separate
tasks. The broadcast channel handles fan-out. When a client
disconnects, the read loop exits and the write task is aborted.

## Graceful shutdown with JoinSet

The server above runs forever. In production, you need to drain
connections on SIGTERM. `JoinSet` tracks spawned tasks and lets
you wait for all of them to finish:

```rust
use tokio::net::TcpListener;
use tokio::signal;
use tokio::task::JoinSet;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    let mut tasks = JoinSet::new();

    loop {
        tokio::select! {
            Ok((stream, addr)) = listener.accept() => {
                tasks.spawn(async move {
                    let Ok(ws) = accept_async(stream).await else {
                        return;
                    };
                    let (mut sink, mut source) = ws.split();
                    while let Some(Ok(msg)) = source.next().await {
                        if let Message::Text(text) = msg {
                            let _ = sink.send(
                                Message::text(text.into())
                            ).await;
                        }
                    }
                    eprintln!("{addr} disconnected");
                });
            }
            _ = signal::ctrl_c() => {
                eprintln!("shutting down, draining connections");
                break;
            }
        }
    }

    // Wait for all active connections to finish
    while tasks.join_next().await.is_some() {}
    Ok(())
}
```

`tokio::select!` waits on both new connections and Ctrl+C.
When the signal arrives, the loop breaks. `JoinSet::join_next`
then waits for every in-flight connection to close. No tasks
leak, no connections drop mid-message.

## Client with reconnection

```rust
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use rand::Rng;

async fn connect_with_backoff(url: &str) {
    let mut delay = Duration::from_secs(1);

    loop {
        match connect_async(url).await {
            Ok((ws, _)) => {
                delay = Duration::from_secs(1);
                let (mut sink, mut source) = ws.split();
                let _ = sink.send(Message::text("hello")).await;

                while let Some(Ok(msg)) = source.next().await {
                    eprintln!("received: {msg}");
                }
                eprintln!("disconnected, reconnecting...");
            }
            Err(e) => eprintln!("connect failed: {e}"),
        }
        // Jitter prevents all clients reconnecting at once
        let jitter = rand::rng().random_range(0..500);
        let wait = delay + Duration::from_millis(jitter);
        tokio::time::sleep(wait).await;
        delay = (delay * 2).min(Duration::from_secs(30));
    }
}
```

Always add jitter. Without it, a server restart causes every
client to reconnect at the same instant. That thundering herd
can take down the new server before it finishes booting.

## Rust-specific gotchas

These are the problems that catch experienced developers who
are new to Rust WebSocket code.

**Split streams have different types.** `ws.split()` returns a
`SplitSink` and `SplitStream` with different concrete types.
You can't put them back together easily, and you can't clone
either half. Once you split, commit to it. If you need both
read and write in the same task, use `ws.next()` and
`ws.send()` directly instead of splitting.

**`Arc<Mutex<T>>` vs channels.** Your instinct from other
languages is to wrap shared state in a mutex. In async Rust,
holding a `tokio::sync::Mutex` across an `.await` is fine but
blocks other tasks waiting on that lock. For fan-out (one
message to many clients), use `broadcast::channel`. For
request-response between tasks, use `mpsc::channel`. Reserve
`Arc<RwLock<T>>` for data that is read often and written
rarely, like a connection registry.

**`tokio::select!` drops unfinished futures.** When one branch
completes, the other is cancelled. If you're writing to a
WebSocket in one branch and reading in another, the write
may be dropped mid-send. Pin your futures if they hold state
you care about, or restructure so each future is idempotent.

**Backpressure is your problem.** `broadcast::channel` drops
messages when the receiver falls behind (it returns
`RecvError::Lagged`). If you ignore this, slow clients silently
miss messages. Either handle `Lagged` by catching up or
disconnecting, or use an unbounded channel and accept the memory
risk. There's no free lunch.

**`Message::Text` owns its data.** Each `Message::Text` allocates
a new `String`. For high-throughput servers, this allocation
pressure adds up. Consider `Message::Binary` with a serialization
format like MessagePack or Protobuf for hot paths.

## Shared state patterns

Two patterns cover most use cases:

```rust
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use std::collections::HashMap;

// Fan-out: one message to many clients
// Use for chat, live updates, pub/sub
let (tx, _rx) = broadcast::channel::<String>(256);

// Registry: track connected clients
// Use for presence, targeted messaging
type Clients = Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>;
```

For high-throughput registries, `dashmap` avoids holding a lock
across `.await` points. This matters because a standard `RwLock`
held across an await can block the tokio runtime's thread pool
if contention is high.

## When NOT to use Rust

WebSocket servers are I/O-bound. Your server spends most of
its time waiting on network reads, not doing computation.
Rust's CPU performance advantage barely matters when the
bottleneck is the network.

Go handles tens of thousands of WebSocket connections with
goroutines. Node.js does the same with its event loop. Both
get you to production faster with more library options.

Use Rust for WebSockets when you need sub-millisecond latency
consistency (trading systems, competitive gaming) or when each
message requires CPU-heavy work (compression, encryption,
real-time audio transforms). If you're mostly routing messages
between clients, your architecture matters more than your
language: horizontal scaling, state management, and a protocol
layer on top of raw WebSockets.

Rust also has no equivalent of Socket.IO or Phoenix Channels.
No off-the-shelf reconnection with message replay, room
management, or presence tracking. You build all of that
yourself. For most teams, this cost outweighs the runtime
advantage. If you need that infrastructure without building it,
[managed WebSocket services][ably-realtime] handle connection
management, ordering, and failover across any language.

## Frequently asked questions

### What is the best Rust WebSocket library?

tokio-tungstenite for async. It's the most downloaded, best
maintained, and works directly with tokio. If you're building
a web app with routing and middleware, use axum instead -- it
wraps tungstenite internally and gives you WebSocket upgrades
alongside your HTTP routes. For the rare case where you need
synchronous (blocking) WebSockets, use tungstenite directly.

actix-web also has WebSocket support, but axum has overtaken it
in adoption and is where the Rust web ecosystem is heading.
actix-web's actor model adds complexity that most WebSocket
servers don't need. New projects should default to axum.

### Is Rust good for WebSocket servers?

For latency-critical workloads, yes. No GC pauses means your
p99 latencies stay flat under sustained load. Memory usage is
predictable and low -- a connection costs kilobytes, not
megabytes.

The question is whether you need that. A Go WebSocket server
handles 100K concurrent connections on modest hardware. Rust
might handle 200K. But your architecture doesn't change at
either scale. You still need horizontal scaling, health checks,
and a reconnection strategy. Pick Rust when latency
predictability is a hard requirement, not when "more
connections" sounds appealing.

### How do I handle multiple connections in Rust?

Spawn one tokio task per connection. Each task owns its half
of the split WebSocket stream. Share state between tasks using
`broadcast::channel` for fan-out or `Arc<RwLock<T>>` for a
connection registry. The borrow checker prevents data races at
compile time -- if it compiles, you don't have a race
condition in your shared state access.

For graceful shutdown, use `JoinSet` to track all spawned tasks
and drain them on SIGTERM. Without this, a `kill` or
deployment drops every active connection immediately.

### How does Rust WebSocket performance compare?

Rust has the lowest latency and most predictable throughput of
any mainstream language for WebSocket servers. No garbage
collector means no tail-latency spikes. But the performance gap
only matters for specific workloads. If your server processes
messages (compression, ML inference, real-time encoding), Rust's
advantage is real. If your server just routes messages between
clients, Go or Node.js will be within 10-20% of Rust's
throughput and get you to production months faster.

## Related content

- [Go WebSocket Guide](/guides/languages/go/) - Compare Rust's
  approach with Go's goroutine-based concurrency
- [WebSocket Protocol: RFC 6455](/guides/websocket-protocol/) -
  The protocol Rust WebSocket libraries implement
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Full list of libraries and frameworks
- [WebSockets at Scale](/guides/websockets-at-scale/) -
  Architecture patterns for horizontal scaling
- [WebSocket Security](/guides/security/) - TLS, authentication,
  and origin validation

[ably-realtime]:
  https://ably.com/solutions/realtime?utm_source=websocket-org&utm_medium=rust-guide
