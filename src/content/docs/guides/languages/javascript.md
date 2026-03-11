---
title: 'JavaScript WebSocket: Browser API & Node.js Guide'
description:
  'Build WebSocket apps in JavaScript. Covers the browser WebSocket API, ws
  library for Node.js, reconnection, binary data, and production patterns for
  real-time applications.'
sidebar:
  order: 1
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
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
  - q: 'How do I create a WebSocket connection in JavaScript?'
    a:
      'Use the native WebSocket API: const ws = new
      WebSocket("wss://example.com"). Listen for events with ws.onopen,
      ws.onmessage, ws.onerror, and ws.onclose. The browser handles the HTTP
      upgrade automatically.'
  - q: 'What is the best WebSocket library for Node.js?'
    a:
      'The ws library is the most popular and performant choice for Node.js
      WebSocket servers. It is fast, well-maintained, and closely follows the
      WebSocket specification. For additional features like rooms and fallbacks,
      use Socket.IO.'
  - q: 'How do I handle WebSocket reconnection in JavaScript?'
    a:
      'Implement a reconnection loop with exponential backoff. On the close
      event, wait an increasing delay before calling new WebSocket() again. Cap
      the maximum delay and reset it after a successful connection.'
  - q: 'Can I send binary data over WebSockets in JavaScript?'
    a:
      'Yes. Set ws.binaryType to "arraybuffer" or "blob" before receiving. Send
      binary data with ws.send(arrayBuffer) or ws.send(blob). The WebSocket API
      handles framing automatically.'
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
In the browser, use the native API:
`new WebSocket("wss://example.com")`. For Node.js servers, use the **ws**
library (`npm install ws`). Handle events with `onopen`, `onmessage`, `onerror`,
and `onclose`. Add reconnection with exponential backoff for production use.
:::

Browsers ship with WebSocket support built in. No library, no polyfill,
no build step. You open a connection, listen for events, send messages.
For Node.js servers, the `ws` package is the standard choice. Here is
how both sides work, and where raw WebSockets stop being enough.

## Browser WebSocket API

The browser API is event-driven. Four callbacks cover the full lifecycle:

```javascript
const ws = new WebSocket("wss://echo.websocket.org");

ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "hello", user: "browser" }));
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

## Reconnection with backoff

The browser API does not reconnect automatically. If the connection
drops, it stays dropped. You need to handle this yourself:

```javascript
function connect(url) {
  let retries = 0;
  const maxRetries = 10;
  const maxDelay = 30000;

  function attempt() {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("Connected");
      retries = 0; // reset on success
    };

    ws.onmessage = (event) => {
      console.log("Message:", event.data);
    };

    ws.onclose = (event) => {
      if (event.code === 1000) return; // normal close, don't retry

      if (retries >= maxRetries) {
        console.error("Max retries reached");
        return;
      }

      const delay = Math.min(1000 * 2 ** retries, maxDelay);
      retries++;
      console.log(`Reconnecting in ${delay}ms (attempt ${retries})`);
      setTimeout(attempt, delay);
    };

    ws.onerror = () => {}; // onclose fires after onerror, handle there
  }

  attempt();
}
```

This pattern doubles the delay each retry and caps it. Without
backoff, a thousand clients reconnecting simultaneously after a
server restart will bring the server down again immediately.

## Connection leaks in React

If you create a WebSocket inside a React component without cleanup,
every re-render opens a new connection. The old ones stay open. Your
server sees connection counts climbing while the client has no idea.

```javascript
// Correct: clean up in useEffect
useEffect(() => {
  const ws = new WebSocket("wss://example.com");

  ws.onmessage = (event) => {
    setMessages((prev) => [...prev, event.data]);
  };

  return () => ws.close(); // This is critical
}, []); // Empty deps = one connection
```

Without the cleanup function, navigating between pages, toggling
components, or triggering re-renders all leak connections. This is
one of the most common WebSocket bugs in production React apps. If
your server's connection count keeps rising while active users stay
flat, check your cleanup functions first.

## Node.js server with ws

The `ws` library gives you a WebSocket server with minimal overhead.
Install it with `npm install ws`:

```javascript
const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on("connection", (ws, request) => {
  clients.add(ws);
  console.log(`Client connected from ${request.socket.remoteAddress}`);

  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Broadcast to all other clients
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("Client error:", err.message);
    clients.delete(ws);
  });
});

// Detect dead connections with ping/pong
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  clearInterval(interval);
  wss.close(() => process.exit(0));
});
```

This handles connection tracking, broadcast, JSON validation, dead
connection cleanup, and graceful shutdown. That is roughly the minimum
for a production server. You will notice it does not handle
authentication, rooms, message history, or presence. That is the
gap between a WebSocket server and a realtime application.

## Beyond raw WebSockets

A WebSocket gives you a bidirectional pipe. That is all. In practice,
most applications need a set of features that sit on top of that pipe:

- **Reconnection with state recovery** - not just reconnecting,
  but catching up on missed messages
- **Authentication and authorization** - who can connect, who can
  see what
- **Rooms or channels** - routing messages to subsets of clients
- **Presence** - knowing who is online right now
- **Message acknowledgment** - confirming delivery, not just sending
- **Scaling across servers** - a single Node.js process handles
  thousands of connections, not millions

You have three paths. Build it yourself on `ws` and you will spend
months on infrastructure code that is not your product. Socket.IO
adds the protocol layer as open source: reconnection, rooms, fallback
to HTTP long-polling, and acknowledgments out of the box. Use it if
you want those features without a third-party service. For teams
that do not want to run WebSocket infrastructure at all,
[managed services like Ably][ably] handle the protocol layer,
scaling, and global distribution.

The choice depends on what you are building. A hackathon project
works fine with raw `ws`. A production chat app with 10,000 users
needs the protocol layer. A product with millions of connections
across regions needs infrastructure that is someone's full-time job.

## When to use something else

WebSockets are not always the right tool. If your data only flows
server-to-client, Server-Sent Events (SSE) are simpler. SSE
reconnects automatically, works over plain HTTP, and every browser
supports it. The API is one line:
`new EventSource("/stream")`.

One caveat: SSE can be buffered by corporate proxies and
intermediaries. If your users sit behind aggressive network
filtering, SSE streams may arrive in chunks rather than in realtime.
WebSockets are less susceptible to this because the connection is
upgraded out of HTTP early.

For request-response patterns, plain HTTP is still the right answer.
WebSockets add connection state, memory on the server, and
complexity. Only use them when you need bidirectional, low-latency
communication.

## Frequently Asked Questions

### How do I create a WebSocket connection in JavaScript?

Use the native API: `const ws = new WebSocket("wss://example.com")`.
The browser handles the HTTP upgrade and protocol negotiation. Listen
for `onopen`, `onmessage`, `onerror`, and `onclose`. Always use
`wss://` (TLS) in production, both for security and because many
proxies block unencrypted `ws://` connections.

### What is the best WebSocket library for Node.js?

The `ws` library is the default choice. It is fast, spec-compliant,
and has no unnecessary dependencies. If you need rooms, reconnection,
and fallback transports, Socket.IO wraps WebSockets with a
higher-level protocol. Neither handles scaling across multiple servers
on its own, which is where pub/sub brokers like Redis or managed
services come in.

### How do I handle WebSocket reconnection in JavaScript?

Implement exponential backoff: on disconnect, wait 1s, then 2s, 4s,
8s, up to a cap (30s is typical). Reset the counter on successful
connection. Without backoff, mass reconnections after an outage will
overload the server. The browser API does not reconnect for you, so
this is code you must write or get from a library like Socket.IO.

### Can I send binary data over WebSockets in JavaScript?

Yes. Set `ws.binaryType = "arraybuffer"` before receiving binary
frames, then send with `ws.send(buffer)`. The WebSocket protocol
distinguishes text and binary frames natively. Most applications use
JSON text frames. Binary is useful for file transfers, audio streams,
or custom binary protocols where payload size matters.

## Related Content

- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Complete browser API reference
- [WebSocket Protocol: RFC 6455](/guides/websocket-protocol/) - The protocol
  behind the JavaScript WebSocket API
- [Python WebSocket Guide](/guides/languages/python/) - Compare JavaScript
  patterns with Python asyncio
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Curated list including ws, Socket.IO, and uWebSockets.js
- [WebSocket Close Codes](/reference/close-codes/) - Understanding close codes
  for error handling

[ably]:
  https://ably.com/?utm_source=websocket-org&utm_medium=javascript-websocket
