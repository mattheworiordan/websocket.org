---
title: "JavaScript WebSocket: Browser API & Node.js Server"
description:
  "Build WebSocket apps in JavaScript with ws for Node.js servers and the
  native browser API. Covers reconnection, backpressure, and security."
sidebar:
  order: 1
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: "2024-09-02"
lastUpdated: 2026-03-14
category: guide
keywords:
  - javascript websocket
  - websocket api javascript
  - nodejs websocket
  - ws library
  - browser websocket
seo:
  keywords:
    - javascript websocket
    - websocket api javascript
    - nodejs websocket
    - ws library
    - browser websocket
    - websocket client javascript
    - websocket server nodejs
    - real-time javascript
faq:
  - q: "How do I create a WebSocket connection in JavaScript?"
    a:
      "Use the native WebSocket API: const ws = new
      WebSocket('wss://example.com'). Listen for events with ws.onopen,
      ws.onmessage, ws.onerror, and ws.onclose. The browser handles the HTTP
      upgrade automatically."
  - q: "What is the best WebSocket library for Node.js?"
    a:
      "Use ws. It is the most widely deployed Node.js WebSocket library, has no
      dependencies, and closely follows RFC 6455. Consider Socket.IO only if you
      need rooms, automatic reconnection, or HTTP long-polling fallback."
  - q: "How do I handle WebSocket reconnection in JavaScript?"
    a:
      "Implement exponential backoff with jitter. On disconnect, wait an
      increasing delay plus random jitter before reconnecting. Cap the maximum
      delay at 30 seconds and reset on successful connection."
  - q: "What are common JavaScript WebSocket gotchas?"
    a:
      "Event loop blocking delays message processing for all connections.
      Unclosed connections in React leak memory. Missing backpressure handling
      causes unbounded memory growth when clients read slower than the server
      sends."
tags:
  - websocket
  - javascript
  - nodejs
  - browser
  - websocket-javascript
  - programming
  - tutorial
  - implementation
  - guide
  - how-to
---

:::note[Quick Answer]
In browsers, use the native API: `new WebSocket("wss://example.com")`.
For Node.js servers, use **ws** (`npm install ws`). It is fast,
spec-compliant, and dependency-free. Add reconnection with exponential
backoff and jitter for production use.
:::

Use `ws` for Node.js WebSocket servers. It is the most widely deployed
option, has zero dependencies, and follows RFC 6455 closely.
Socket.IO sits on top of WebSockets and adds reconnection, rooms, and
HTTP fallback --- but it uses its own protocol, so standard WebSocket
clients cannot connect to a Socket.IO server. Pick `ws` when you want
control. Pick Socket.IO when you want batteries included and accept
the vendor lock-in to its protocol.

## Browser WebSocket API

The browser API is event-driven. Four callbacks cover the full
lifecycle:

```javascript
const ws = new WebSocket("wss://echo.websocket.org");

ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "hello" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
  console.log(`Closed: ${event.code} ${event.reason}`);
};
```

That is the entire client API. No HTTP upgrade to manage, no framing
to handle. The browser does it for you.

## Reconnection with backoff and jitter

The browser API does not reconnect. If the connection drops, it stays
dropped. You must handle this yourself, and you must include jitter.
Without jitter, every client uses the same backoff schedule. A server
restart at 2am causes a thousand clients to all reconnect at 2am +
1s, then 2am + 2s, then 2am + 4s --- synchronized waves that keep
crashing the server.

```javascript
function connect(url) {
  let retries = 0;
  const maxRetries = 10;
  const maxDelay = 30000;

  function attempt() {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      retries = 0;
    };

    ws.onmessage = (event) => {
      handleMessage(event.data);
    };

    ws.onclose = (event) => {
      if (event.code === 1000) return;
      if (retries >= maxRetries) {
        console.error("Max retries reached");
        return;
      }
      const base = Math.min(1000 * 2 ** retries, maxDelay);
      const jitter = Math.random() * base * 0.5;
      const delay = base + jitter;
      retries++;
      setTimeout(attempt, delay);
    };

    ws.onerror = () => {};
  }

  attempt();
}
```

The jitter adds up to 50% random delay on top of the base. This
spreads reconnections across time so your server sees a gradual ramp
instead of a spike.

## Connection leaks in React

Creating a WebSocket inside a React component without cleanup is one
of the most common production bugs. Every re-render opens a new
connection. The old ones stay open. Your server sees connection counts
climbing while the client has no idea.

```javascript
useEffect(() => {
  const ws = new WebSocket("wss://example.com");

  ws.onmessage = (event) => {
    setMessages((prev) => [...prev, event.data]);
  };

  return () => ws.close();
}, []);
```

The cleanup function in `return` is not optional. Without it,
navigating between pages, toggling components, or triggering
re-renders all leak connections. If your server's connection count
keeps rising while active users stay flat, check your effect
cleanup first.

## Node.js server with ws

Install with `npm install ws`. This server handles connection
tracking, origin validation, dead connection cleanup, and graceful
shutdown:

```javascript
const { WebSocketServer } = require("ws");

const ALLOWED_ORIGINS = ["https://example.com", "https://app.example.com"];

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, request) => {
  const origin = request.headers.origin;
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ws.close(1008, "Origin not allowed");
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    broadcast(wss, ws, message);
  });

  ws.on("error", (err) => console.error("Client error:", err.message));
});

function broadcast(server, sender, message) {
  const payload = JSON.stringify(message);
  for (const client of server.clients) {
    if (client !== sender && client.readyState === 1) {
      client.send(payload);
    }
  }
}
```

Origin validation matters. Without it, any page on the internet can
open a WebSocket to your server. The `Origin` header is
browser-enforced --- it cannot be spoofed from a browser context ---
so checking it blocks cross-site WebSocket hijacking.

### Ping/pong and graceful shutdown

Dead connections consume memory and file descriptors silently. Use
ping/pong to detect them:

```javascript
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

process.on("SIGTERM", () => {
  clearInterval(interval);
  for (const ws of wss.clients) {
    ws.close(1001, "Server shutting down");
  }
  wss.close(() => process.exit(0));
});
```

## JavaScript-specific gotchas

### Event loop blocking kills throughput

Node.js runs on a single thread. If you do CPU work in a message
handler --- JSON parsing a 5MB payload, running a regex against
user input, or computing a diff --- every other connection waits.
The message queue backs up. Clients see latency spike. Move heavy
work to a worker thread or a separate service.

### Backpressure causes memory bloat

When you call `ws.send()`, the data goes into a buffer. If the
client reads slower than you send, that buffer grows without limit.
Check `ws.bufferedAmount` before sending:

```javascript
function safeSend(ws, data) {
  if (ws.bufferedAmount > 1024 * 1024) {
    console.warn("Client too slow, dropping message");
    return false;
  }
  ws.send(data);
  return true;
}
```

In production, you either drop messages, apply backpressure (stop
producing), or disconnect slow clients. Ignoring this leads to your
Node.js process running out of memory under load.

### Memory leaks from listeners

Each `ws.on("message", ...)` registers a listener. If you add
listeners inside loops or repeated function calls without removing
them, you get a memory leak. Node.js warns at 11 listeners per
emitter by default. If you see that warning, you have a leak.

## Beyond raw WebSockets

A WebSocket gives you a bidirectional pipe. That is all. Production
apps need reconnection with state recovery, authentication, message
routing, presence, and delivery guarantees. You have three paths:

**Build on `ws`** --- full control, but you will spend months on
infrastructure code. Authentication, rooms, message ordering,
horizontal scaling across servers: all of that is your problem.

**Use Socket.IO** --- adds reconnection, rooms, acknowledgments,
and HTTP fallback as open source. Good if you can run your own
infrastructure and accept its custom protocol.

**Use a managed service** --- [platforms like Ably][ably] handle the
protocol layer, global distribution, and scaling. The trade-off is
cost and dependency on a vendor. The benefit is not running
WebSocket infrastructure at all.

The right choice depends on scale. A hackathon project works with
raw `ws`. A production app with 10,000 users needs the protocol
layer. An app with millions of connections across regions needs
infrastructure that is someone's full-time job.

## When WebSockets are overkill

If data only flows server-to-client, use Server-Sent Events. SSE
reconnects automatically, works over HTTP/2, and the API is one
line: `new EventSource("/stream")`. For request-response patterns,
use plain HTTP. WebSockets add connection state, server memory, and
operational complexity. Only reach for them when you need
bidirectional, low-latency messaging.

## Frequently Asked Questions

### How do I create a WebSocket connection in JavaScript?

Use the native API: `const ws = new WebSocket("wss://example.com")`.
The browser handles the HTTP upgrade and protocol negotiation. Listen
for `onopen`, `onmessage`, `onerror`, and `onclose`. Always use
`wss://` in production --- many corporate proxies and firewalls
block unencrypted `ws://` traffic, and TLS prevents intermediaries
from interfering with the WebSocket frame stream.

### What is the best WebSocket library for Node.js?

Use `ws`. It has no dependencies, closely follows RFC 6455, and
handles both server and client use cases. Socket.IO is the right
choice when you specifically need rooms, automatic reconnection, or
fallback to HTTP long-polling --- but it introduces its own protocol
on top of WebSockets, so vanilla WebSocket clients cannot connect.
For scaling beyond a single server, both need a pub/sub layer
(Redis, NATS) or a [managed realtime service][ably].

### How do I handle WebSocket reconnection in JavaScript?

Implement exponential backoff with jitter. On disconnect, wait a
base delay (1s, 2s, 4s, doubling each time) plus a random offset,
up to a cap of 30 seconds. Reset on successful connection. Without
jitter, every client reconnects on the same schedule and you get a
thundering herd that overwhelms the server on recovery.

### What are common JavaScript WebSocket gotchas?

Three things catch most teams: event loop blocking (CPU-heavy message
handlers stall all connections), backpressure (sending faster than
clients can consume causes unbounded memory growth), and connection
leaks (especially in React apps that do not clean up WebSockets in
`useEffect` return functions). All three show up under load, not
during development.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) ---
  Full browser API with events, methods, and properties
- [WebSocket Protocol: RFC 6455](/guides/websocket-protocol/) ---
  The protocol behind the JavaScript WebSocket API
- [Python WebSocket Guide](/guides/languages/python/) --- Compare
  JavaScript patterns with Python asyncio
- [WebSocket Libraries & Tools](/resources/websocket-resources/) ---
  Curated list including ws, Socket.IO, and uWebSockets.js
- [WebSocket Close Codes](/reference/close-codes/) --- Understanding
  close codes for error handling

[ably]:
  https://ably.com/?utm_source=websocket-org&utm_medium=javascript-websocket
