---
title: "WebSocket with Express.js: ws Library Integration Guide"
description:
  "Integrate WebSocket into Express using ws. Covers sharing HTTP
  servers, upgrade handling, authentication, broadcasting, and
  scaling with Redis pub/sub."
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-04-21
lastUpdated: 2026-04-21
category: guide
keywords:
  - express websocket
  - express ws
  - websocket express.js
  - express websocket server
  - node express websocket
seo:
  keywords:
    - express websocket
    - express ws
    - websocket express.js
    - express websocket server
    - node express websocket
    - express upgrade handler
    - express websocket authentication
faq:
  - q: "Does Express support WebSocket natively?"
    a:
      "No. Express handles HTTP request/response cycles and has no
      built-in WebSocket support. Use the ws library alongside Express
      by sharing the underlying Node.js HTTP server. Do not use
      express-ws — it is abandoned and unmaintained."
  - q: "Why do I get 400 errors when connecting WebSocket to Express?"
    a:
      "Express intercepts the HTTP upgrade request and returns a 400
      because it does not know how to handle it. You must listen for
      the 'upgrade' event on the HTTP server and call
      wss.handleUpgrade() manually, or create the WebSocketServer
      with the server option to let ws handle it automatically."
  - q: "Does Express middleware run on WebSocket connections?"
    a:
      "No. Express middleware only runs on standard HTTP
      request/response cycles. The WebSocket upgrade bypasses Express
      entirely. You must handle authentication, rate limiting, and
      validation in the upgrade event handler, not in Express
      middleware."
  - q: "How do I scale Express WebSocket apps across multiple processes?"
    a:
      "WebSocket connections are stateful and pinned to one process.
      Use sticky sessions with pm2 or cluster mode so reconnections
      hit the same worker. For cross-process broadcasting, add a
      Redis pub/sub layer so messages reach clients on any worker."
  - q: "Should I use Socket.IO or raw ws with Express?"
    a:
      "Use ws directly for most cases — it is lighter, faster, and
      gives you full control. Use Socket.IO only when you need rooms,
      namespaces, automatic reconnection, or HTTP long-polling
      fallback. Socket.IO uses its own protocol, so standard WebSocket
      clients cannot connect."
tags:
  - websocket
  - express
  - nodejs
  - ws
  - framework
  - guide
  - implementation
---

:::note[Quick Answer]
Express has no WebSocket support. Use `ws` alongside Express by
sharing the HTTP server: create `http.createServer(app)` and pass
that `server` to `new WebSocketServer({ server })`. Handle auth in
the `upgrade` event, not in Express middleware --- middleware does
not run on WebSocket upgrade requests.
:::

Express is an HTTP framework. It handles requests and sends
responses. WebSockets are a different protocol that starts as HTTP
and then upgrades to a persistent, bidirectional connection. Express
knows nothing about that upgrade, so you need `ws` to handle it.

## Sharing the HTTP Server

The standard pattern creates one HTTP server and attaches both
Express and `ws` to it:

```javascript
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log("client connected from", req.socket.remoteAddress);
  ws.on("message", (data) => ws.send(`echo: ${data}`));
  ws.on("close", () => console.log("client disconnected"));
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

server.listen(3000, () => console.log("listening on :3000"));
```

Do not call `app.listen()` — that creates a separate HTTP server.
Use `server.listen()` instead so both Express routes and WebSocket
connections share the same port.

## The noServer Option: Path-Based Routing

If you need WebSocket endpoints on specific paths (say `/ws/chat`
and `/ws/notifications`), use `noServer: true` and handle the
upgrade event yourself:

```javascript
const chatWss = new WebSocketServer({ noServer: true });
const notifyWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (pathname === "/ws/chat") {
    chatWss.handleUpgrade(req, socket, head, (ws) => {
      chatWss.emit("connection", ws, req);
    });
  } else if (pathname === "/ws/notifications") {
    notifyWss.handleUpgrade(req, socket, head, (ws) => {
      notifyWss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});
```

This is the pattern to use when you want multiple WebSocket
endpoints with different behavior. The alternative — one
`WebSocketServer` with if/else branching inside the `connection`
handler — gets messy fast.

## express-ws vs Raw ws

You will find `express-ws` in old tutorials. It lets you write
`app.ws('/path', handler)` like a normal Express route. Convenient,
but the library has not been updated since 2020 and has unpatched
issues. More importantly, it creates a false mental model: it makes
WebSocket handlers look like Express middleware, but they do not
participate in the middleware chain.

Use `ws` directly. The setup is five extra lines, and you get full
control over the upgrade lifecycle.

## Authentication During Upgrade

Express middleware does not run on WebSocket connections. This is
the single most common mistake. Your `passport.authenticate()`,
your JWT middleware, your rate limiter — none of it applies to the
upgrade request. You must verify credentials in the `upgrade`
event handler, before calling `handleUpgrade`:

```javascript
import jwt from "jsonwebtoken";

server.on("upgrade", (req, socket, head) => {
  const token = new URL(req.url, "http://localhost")
    .searchParams.get("token");

  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

Pass the token as a query parameter, not in headers. The browser
`WebSocket` API does not allow custom headers — this is a protocol
limitation, not a library limitation. Cookies work as an
alternative if you control both domains.

## Origin Validation

Check `req.headers.origin` in the upgrade handler to block
cross-origin WebSocket connections. Without this, any page can
open a WebSocket to your server and ride on the user's cookies:

```javascript
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  const allowed = ["https://myapp.com", "https://staging.myapp.com"];

  if (!allowed.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

CORS headers do not protect WebSocket connections. Browsers enforce
CORS for `fetch` and `XMLHttpRequest`, but the WebSocket handshake
bypasses CORS entirely. Origin checking in the upgrade handler is
your only defense.

## Broadcasting to Connected Clients

The simplest approach iterates `wss.clients`:

```javascript
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
```

For targeted messaging (send to a specific user, a room, or a
subset), track connections in a `Map`:

```javascript
const clients = new Map();

wss.on("connection", (ws, req) => {
  const userId = req.user.id;
  clients.set(userId, ws);

  ws.on("close", () => clients.delete(userId));
});

function sendToUser(userId, data) {
  const ws = clients.get(userId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
```

If a user opens multiple tabs, store an array or `Set` of
connections per user ID instead of a single reference.

## Heartbeat: Detecting Dead Connections

TCP does not notify you when a connection drops silently (e.g., a
mobile user walks into a tunnel). Without heartbeats, your
`clients` Map fills with dead connections that consume memory and
cause failed sends.

```javascript
const HEARTBEAT_INTERVAL = 30_000;

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on("close", () => clearInterval(interval));
```

30 seconds is a reasonable default. Shorter intervals detect dead
connections faster but add bandwidth overhead. For mobile-heavy
apps, consider 20 seconds.

## Scaling with pm2 and Cluster Mode

Node.js runs on a single thread. To use multiple CPU cores, you
run multiple processes with `pm2` or the built-in `cluster` module.
The problem: WebSocket connections are stateful. A client connects
to worker A, but the next HTTP request (or reconnection) might hit
worker B, which knows nothing about that client.

You need sticky sessions — routing the same client to the same
worker. Configure this in your `ecosystem.config.js`:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "ws-app",
    script: "app.js",
    instances: "max",
    exec_mode: "cluster",
  }],
};
```

Then run `pm2 start ecosystem.config.js`. You also need sticky
sessions at the load balancer level (Nginx `ip_hash` or ALB
stickiness) because pm2's built-in cluster does not handle
WebSocket upgrade routing. Without sticky sessions, clients get
400 errors on reconnection
because the upgrade request lands on a different worker that has
no record of the connection. This is the number one scaling issue
with WebSocket apps on Node.js.

## Redis Pub/Sub for Multi-Process Broadcasting

Sticky sessions solve connection routing, but not broadcasting. If
user A is connected to worker 1 and user B is connected to worker
2, broadcasting from worker 1 only reaches user A.

The fix: publish messages to Redis and subscribe in every worker.

```javascript
import { createClient } from "redis";

const pub = createClient();
const sub = createClient();
await pub.connect();
await sub.connect();

await sub.subscribe("broadcast", (message) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

function broadcastAll(data) {
  pub.publish("broadcast", JSON.stringify(data));
}
```

Every worker subscribes to the `broadcast` channel. When any worker
publishes, all workers receive the message and forward it to their
local WebSocket clients. This pattern works with any pub/sub system
— Redis is the most common because you probably already have it.

For production systems with thousands of connections and complex
routing requirements, consider a [managed realtime
service][ably] like Ably, or alternatives like Pusher or PubNub,
rather than building and operating the pub/sub infrastructure
yourself.

## Socket.IO with Express: When It Makes Sense

Socket.IO adds a layer on top of WebSockets: automatic
reconnection, rooms, namespaces, binary support, and HTTP
long-polling fallback. If you need those features, Socket.IO saves
you from building them yourself.

The trade-off: Socket.IO uses its own protocol. Standard WebSocket
clients cannot connect to a Socket.IO server. You are locked into
the Socket.IO client library on every platform.

```javascript
import { Server } from "socket.io";

const io = new Server(server, {
  cors: { origin: "https://myapp.com" },
});

io.on("connection", (socket) => {
  socket.join("room-1");
  socket.to("room-1").emit("message", "hello room");
});
```

Use Socket.IO when you need rooms, namespaces, or guaranteed
delivery with acknowledgements. Use raw `ws` when you want a
standard WebSocket server that any client can connect to, or when
you need the lowest possible latency and overhead.

## Common Mistake: Missing Upgrade Handler

The most frequent Express + WebSocket bug: creating a
`WebSocketServer` without attaching it to the HTTP server or
handling the upgrade event. The client sends an upgrade request,
Express does not know what to do with it, and the client gets a
400 response.

The fix is always one of:

1. Pass `{ server }` to `WebSocketServer` (simplest)
2. Use `{ noServer: true }` and listen for `"upgrade"` on the
   HTTP server (more control)

If you see `Error: Unexpected server response: 400` in the client,
check that you are using `createServer(app)` and passing that
server to `ws`, not calling `app.listen()` separately.

## Frequently Asked Questions

### Does Express support WebSocket natively?

No, and it probably never will. Express is built on Node's HTTP
module, which handles request/response pairs. WebSockets are a
different protocol with persistent connections. The `ws` library
handles the WebSocket protocol and connects to the same HTTP
server that Express uses. The `express-ws` package attempted to
bridge this gap with `app.ws()` syntax, but it was abandoned in
2020 and should not be used in new projects.

### Why do I get 400 errors when connecting WebSocket to Express?

The HTTP upgrade request arrives at Node's HTTP server. If nothing
handles the `upgrade` event, Express processes it as a regular
HTTP request and returns 400 because it cannot match the upgrade
to any route. Fix it by either passing the `server` instance to
`new WebSocketServer({ server })` or by using `noServer: true`
and manually handling `server.on("upgrade", ...)`. The second
approach gives you control over path routing and authentication
before the upgrade completes.

### Does Express middleware run on WebSocket connections?

No. This catches everyone. Express middleware (body parsers, CORS,
session handling, authentication) runs exclusively on HTTP
request/response cycles. The WebSocket upgrade bypasses the
Express middleware stack entirely. You must implement
authentication, rate limiting, and origin validation in the
`upgrade` event handler. If you use Passport or JWT middleware in
Express, you need separate verification logic for WebSocket
connections.

### How do I scale Express WebSocket apps across processes?

WebSocket connections are long-lived and stateful — they are pinned
to the process that accepted the upgrade. With `pm2` or Node's
`cluster` module, you need sticky sessions to ensure reconnections
go back to the same worker. For broadcasting across workers, add a
Redis pub/sub layer: each worker subscribes and forwards messages
to its local clients. Without sticky sessions, reconnections get
400 errors. Without pub/sub, broadcasts only reach clients on one
worker.

### Should I use Socket.IO or raw ws with Express?

Default to `ws`. It is lighter (no protocol overhead), faster (no
encoding layer), and works with any WebSocket client. Socket.IO
makes sense when you specifically need rooms, namespaces, automatic
reconnection with buffering, or HTTP long-polling fallback for
environments where WebSockets are blocked. The cost is lock-in:
Socket.IO uses a custom protocol, so only Socket.IO clients can
connect. For most Express APIs adding real-time features, `ws` with
a simple reconnection wrapper on the client is enough.

## Related Content

- [JavaScript & Node.js WebSocket Guide](/guides/languages/javascript/)
  --- Full coverage of the ws library and browser WebSocket API
- [WebSocket Authentication](/guides/authentication/) ---
  Token-based auth patterns for WebSocket connections
- [WebSockets at Scale](/guides/websockets-at-scale/) ---
  Connection management, load balancing, and horizontal scaling
- [Socket.IO vs WebSocket](/comparisons/socket-io/) ---
  Detailed comparison of Socket.IO and raw WebSockets
- [WebSocket Reconnection](/guides/reconnection/) ---
  Exponential backoff, jitter, and state recovery patterns

[ably]:
  https://ably.com/docs/realtime?utm_source=websocket-org&utm_medium=express
