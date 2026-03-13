---
title: 'WebSocket Authentication: Tokens, Renewal & Security'
description:
  'How to authenticate WebSocket connections: token-based auth, URL
  parameter vs first-message patterns, and JWT renewal for
  long-lived connections.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-13
lastUpdated: 2026-03-13
category: guide
keywords:
  - websocket authentication
  - websocket auth
  - websocket jwt
  - websocket token
  - websocket authorization
  - websocket security token
  - websocket bearer token
seo:
  keywords:
    - websocket authentication
    - websocket auth
    - websocket jwt token
    - websocket authorization header
    - websocket token refresh
    - websocket cookie auth
    - websocket bearer token
faq:
  - q: "Why can't I use the Authorization header with WebSockets?"
    a: "The browser WebSocket API does not support custom headers.
      The constructor only accepts a URL and optional protocols
      array. You cannot attach an Authorization header, unlike
      fetch or XMLHttpRequest. Use a URL query parameter, cookie,
      or first-message pattern instead."
  - q: "Should I pass the token as a URL query parameter?"
    a: "It depends on your threat model. URL parameters let the
      server reject unauthenticated connections during the HTTP
      upgrade handshake, before allocating resources. The trade-off
      is that tokens appear in server access logs and browser
      history. Use short-lived tokens to limit exposure."
  - q: "How do I refresh an expiring JWT on a WebSocket connection?"
    a: "Two approaches: in-band refresh, where the client sends a
      new token over the existing connection and the server
      validates it without disconnecting; or reconnect with a new
      token, which is simpler but causes a brief interruption and
      requires state resynchronization."
  - q: "What is the safest WebSocket authentication approach?"
    a: "Use short-lived tokens issued by your auth server. Pass the
      token as a URL parameter for fast server-side rejection
      during the handshake. Implement in-band token renewal so
      long-lived connections stay authenticated without
      reconnecting. Never embed API keys in client-side code."
---

:::note[Quick Answer]
Use token-based auth, not API keys. Pass the token as a URL
parameter or in the first message for fast server-side rejection.
Implement a token renewal mechanism for long-lived connections
— tokens expire, but WebSocket connections don't. Never send API
keys to untrusted clients.
:::

The browser WebSocket API has no way to set custom HTTP headers.
That single constraint shapes every authentication approach for
WebSockets. Unlike `fetch` or `XMLHttpRequest`, the `WebSocket`
constructor accepts only a URL and an optional subprotocol array.
There is no `Authorization` header.

```javascript
// This is the entire browser WebSocket API for connection setup.
// Notice: no headers parameter, no options object.
const ws = new WebSocket("wss://example.com/ws");
// Compare with fetch, which supports arbitrary headers:
// fetch(url, { headers: { Authorization: "Bearer ..." } })
```

This means you need a different mechanism to prove identity. Three
patterns have emerged, each with real trade-offs.

## URL query parameter authentication

Pass the token in the WebSocket URL. The server validates it during
the HTTP upgrade handshake, before the connection is established.

```javascript
// Client: attach token to the connection URL
async function connectWithToken() {
  const token = await fetchTokenFromAuthServer();
  const ws = new WebSocket(
    `wss://example.com/ws?token=${encodeURIComponent(token)}`
  );

  ws.onopen = () => console.log("Authenticated and connected");
  ws.onclose = (e) => {
    if (e.code === 4001) console.error("Authentication failed");
  };
  return ws;
}
```

```javascript
// Server (Node.js with ws library): validate before upgrading
const { WebSocketServer } = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  const user = validateToken(token);
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.user = user;
    wss.emit("connection", ws, req);
  });
});

server.listen(8080);
```

**Why this works well:** The server rejects bad tokens during the
handshake. No WebSocket connection is created, no resources are
allocated, no application-level message processing runs. The
rejection is fast and cheap.

**The trade-off:** The token appears in the URL. That means it
shows up in server access logs, proxy logs, browser history, and
the `Referer` header if the page navigates. Use short-lived tokens
(5-15 minutes) to limit the window of exposure. Never put API keys
or long-lived credentials in query parameters.

## Cookie-based authentication

If your WebSocket server shares a domain with your web application,
cookies set during the HTTP login flow are automatically sent with
the WebSocket upgrade request. The server validates the session
cookie like any other HTTP request.

```javascript
// Client: no special handling needed — cookies are sent
// automatically if the WebSocket is on the same domain.
const ws = new WebSocket("wss://example.com/ws");
```

```javascript
// Server: validate the session cookie during upgrade
server.on("upgrade", (req, socket, head) => {
  const sessionId = parseCookie(req.headers.cookie, "session_id");
  const session = sessionStore.get(sessionId);

  if (!session || session.expired()) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.user = session.user;
    wss.emit("connection", ws, req);
  });
});
```

**Why this works well:** Zero client-side auth code. If the user
has a valid session from your web app, the WebSocket connection
inherits it. No tokens in URLs.

**The trade-off:** Cookies are sent automatically by the browser,
which means you need CSRF protection. Validate the `Origin` header
on every upgrade request — if it doesn't match your domain, reject
it. Cross-origin WebSocket connections also hit cookie restrictions:
`SameSite=Strict` cookies won't be sent, and `SameSite=Lax` only
works for top-level navigations. If your WebSocket server is on a
different subdomain or domain, cookies won't help.

## First-message authentication

Open the connection without credentials, then send the token as the
first message. The server validates before processing anything else.

```javascript
// Client: connect first, authenticate immediately
function connectWithFirstMessage() {
  const ws = new WebSocket("wss://example.com/ws");

  ws.onopen = async () => {
    const token = await fetchTokenFromAuthServer();
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "auth_result" && !msg.success) {
      console.error("Auth failed:", msg.reason);
      ws.close(4001, "Authentication failed");
    }
  };
  return ws;
}
```

```javascript
// Server: set up the connection with an auth timeout
wss.on("connection", (ws) => {
  ws.authenticated = false;

  const authTimeout = setTimeout(() => {
    if (!ws.authenticated) ws.close(4001, "Auth timeout");
  }, 5000);
```

The 5-second timeout is critical — without it, unauthenticated
connections sit open indefinitely. Once the client sends its auth
message, validate and either accept or reject:

```javascript
  ws.on("message", (data) => {
    const msg = JSON.parse(data);
    if (!ws.authenticated) {
      if (msg.type !== "auth") {
        ws.close(4001, "Authenticate first");
        return;
      }
      const user = validateToken(msg.token);
      if (!user) {
        ws.close(4001, "Invalid token");
        return;
      }
      ws.authenticated = true;
      ws.user = user;
      clearTimeout(authTimeout);
      ws.send(JSON.stringify({ type: "auth_result", success: true }));
      return;
    }
    handleMessage(ws, msg);
  });
});
```

**Why this works well:** The token never appears in URLs or logs.
You have full control over the auth protocol — you can include
device fingerprints, client versions, or capability requests in
the auth message.

**The trade-off:** The TCP connection and TLS handshake happen
before authentication. An attacker can open thousands of
unauthenticated connections to exhaust your server's resources.
The 5-second auth timeout in the example above mitigates this, but
you also need connection-level rate limiting by IP.

## Token renewal for long-lived connections

JWT tokens expire. WebSocket connections don't — or at least, they
shouldn't. A chat application might hold a connection open for
hours. A monitoring dashboard might stay connected for days. If
your token expires after 15 minutes, you need a renewal mechanism.

Two models work in practice:

### In-band token refresh

Send a fresh token over the existing WebSocket connection. The
server validates it and updates the session without dropping the
connection.

```javascript
// Client: refresh the token before it expires
function scheduleTokenRefresh(ws, expiresIn) {
  const refreshAt = expiresIn - 30000; // 30s before expiry
  setTimeout(async () => {
    const newToken = await fetchTokenFromAuthServer();
    ws.send(JSON.stringify({ type: "token_refresh", token: newToken }));
  }, refreshAt);
}

// After successful auth:
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "auth_result" && msg.success) {
    scheduleTokenRefresh(ws, msg.expiresIn);
  }
  if (msg.type === "token_refreshed") {
    scheduleTokenRefresh(ws, msg.expiresIn);
  }
};
```

```javascript
// Server: handle token refresh messages
ws.on("message", (data) => {
  const msg = JSON.parse(data);

  if (msg.type === "token_refresh") {
    const user = validateToken(msg.token);
    if (!user) {
      ws.close(4001, "Refresh token invalid");
      return;
    }
    ws.user = user; // Update permissions
    ws.send(JSON.stringify({
      type: "token_refreshed",
      expiresIn: user.expiresIn,
    }));
    return;
  }

  handleMessage(ws, msg);
});
```

**Why this is preferred:** No connection drop. No state resync. No
message gap. The user's experience is uninterrupted. This is the
approach that services like [Ably][ably-auth] use — an in-band
protocol to refresh credentials without disrupting the connection.

### Reconnect with a new token

Close the connection and open a new one with fresh credentials.
Simpler to implement, but the client experiences a brief
interruption.

```javascript
// Client: reconnect when the token is near expiry
function connectWithAutoRenewal() {
  let ws;

  async function connect() {
    const token = await fetchTokenFromAuthServer();
    ws = new WebSocket(
      `wss://example.com/ws?token=${encodeURIComponent(token)}`
    );

    ws.onopen = () => {
      // Schedule reconnect 30s before token expires
      setTimeout(() => {
        ws.close(1000, "Token renewal");
        connect();
      }, TOKEN_LIFETIME - 30000);
    };
  }

  connect();
}
```

This works for simple cases, but the reconnect-and-resync cycle
gets painful as application state grows. If the client has
subscriptions, cursor positions, or pending operations, all of that
needs to be re-established. In-band refresh avoids that cost.

## Privilege changes and revocation

Authentication is not a one-time gate. On a long-lived connection,
a user's permissions might change — an admin promotes them, a
subscription expires, or a moderation action restricts their
access. Your protocol needs a way to handle this.

### Server-initiated privilege updates

```javascript
// Server: push updated permissions to the client
function updateUserPermissions(ws, newPermissions) {
  ws.user.permissions = newPermissions;
  ws.send(JSON.stringify({
    type: "permissions_updated",
    permissions: newPermissions,
  }));
}

// Check permissions on every message, not just at connect time
function handleMessage(ws, msg) {
  if (!ws.user.permissions.includes(msg.action)) {
    ws.send(JSON.stringify({
      type: "error",
      reason: "Permission denied",
      action: msg.action,
    }));
    return;
  }
  // Process the message
}
```

### Token revocation

Short-lived tokens are the simplest revocation strategy. If a token
is valid for 5 minutes, a compromised token is usable for at most
5 minutes. For immediate revocation, check each message against a
revocation list (Redis set or database query). The cost is an extra
lookup per message, but it's the only way to guarantee instant
invalidation.

## Common mistakes

**Embedding API keys in client code.** API keys have no expiry and
full permissions. If a key leaks — from a mobile app binary, a
browser's DevTools, or a decompiled desktop app — you cannot
revoke it without rotating it for all clients. Use short-lived
tokens scoped to specific permissions instead.

**No token rotation on long-lived connections.** The connection
opens with a valid token, but nobody checks again. Hours later,
that token is expired or revoked, but the connection is still
active and processing messages with stale credentials.

**Trusting the initial handshake forever.** Authentication at
connect time proves identity at that moment. It doesn't guarantee
the user still has the same permissions 3 hours later. Validate
on every sensitive operation, or implement in-band token refresh.

**Sending credentials over `ws://` instead of `wss://`.** Tokens
in query parameters or first messages are visible to anyone
intercepting the traffic. Always use TLS. There is no valid reason
to send authentication tokens over an unencrypted connection.

## Frequently asked questions

### Why can't I use the Authorization header?

The browser `WebSocket` constructor accepts two arguments: a URL
and an optional array of subprotocol strings. There is no options
object, no headers parameter, and no way to add one. This is a
deliberate API design choice from the original spec — the WebSocket
handshake uses an HTTP `Upgrade` request, but the browser API
exposes none of the HTTP plumbing.

Server-to-server WebSocket connections (Node.js, Python, Go) can
set arbitrary headers because they control the HTTP client. The
limitation is browser-specific, but since most WebSocket
applications involve a browser client, it shapes every auth design.

### Should I use URL parameters or first-message auth?

Use URL parameters when fast rejection matters — the server can
reject the connection during the handshake without allocating
resources. Use first-message auth when token confidentiality
matters more — the token stays out of logs and browser history.
For highest security, combine short-lived tokens in URL parameters
with in-band refresh after connection.

### How do I handle token expiry during an active connection?

Pick one of two models. In-band refresh: send a new token over the
existing connection before the current one expires. The server
validates and continues without interruption. Reconnect: close the
connection and open a new one with a fresh token. In-band refresh
is better for applications with complex state (subscriptions,
cursors, pending operations). Reconnect is simpler but forces state
resynchronization.

### Can I use OAuth tokens for WebSocket authentication?

Yes. The flow is: the client authenticates with your OAuth provider
through the normal browser flow, receives an access token, and
passes it to the WebSocket server via URL parameter or first
message. The WebSocket server validates the token against your
OAuth provider's token introspection endpoint or verifies the JWT
signature locally. Remember that OAuth access tokens expire — you
still need a renewal mechanism for long-lived connections.

## Related content

- [WebSocket Security Hardening](/guides/security/) — TLS setup,
  CSWSH prevention, rate limiting, and input validation
- [Building a WebSocket App](/guides/building-a-websocket-app/)
  — connection lifecycle, error handling, and reconnection patterns
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/)
  — the HTTP upgrade handshake and frame format
- [WebSockets vs HTTP](/comparisons/http/) — why WebSockets use a
  different authentication model than REST APIs
- [WebSocket API Reference](/reference/websocket-api/) — the
  browser API, including constructor and close codes

[ably-auth]:
  https://ably.com/docs/auth?utm_source=websocket-org&utm_medium=authentication
