---
title: 'WebSocket HTTP Headers: Complete Handshake Reference'
description:
  'Every HTTP header in the WebSocket handshake explained: what it
  does, who sets it, what breaks when it is wrong, and how proxies
  affect it.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-23'
lastUpdated: 2026-03-23
category: reference
sidebar:
  order: 3
keywords:
  - websocket headers
  - websocket handshake headers
  - sec-websocket-key
  - sec-websocket-accept
  - websocket upgrade header
  - websocket authorization header
seo:
  keywords:
    - websocket headers
    - websocket handshake headers
    - sec-websocket-key
    - sec-websocket-accept
    - websocket upgrade header
    - websocket connection upgrade
    - websocket authorization header
faq:
  - q: 'What headers are required for a WebSocket handshake?'
    a:
      'The client must send Upgrade: websocket, Connection: Upgrade,
      Sec-WebSocket-Key (random base64 value), Sec-WebSocket-Version:
      13, and Host. The server responds with 101 Switching Protocols,
      Upgrade: websocket, Connection: Upgrade, and
      Sec-WebSocket-Accept (a SHA-1 hash of the client key plus a
      magic GUID).'
  - q: 'Can I set custom headers on a browser WebSocket connection?'
    a:
      'No. The browser WebSocket API does not allow setting custom
      HTTP headers like Authorization. You can pass authentication
      tokens as URL query parameters, use cookies, or send
      credentials in the first WebSocket message after the connection
      opens.'
  - q: 'What does the Sec- prefix mean on WebSocket headers?'
    a:
      'The Sec- prefix marks headers that browsers set automatically
      and JavaScript cannot override. This prevents malicious
      scripts from forging WebSocket handshakes. Only the browser
      engine can set Sec-WebSocket-Key, Sec-WebSocket-Version, and
      Sec-WebSocket-Extensions.'
  - q: 'Why does my WebSocket connection fail behind Nginx?'
    a:
      'Nginx does not forward Upgrade and Connection headers by
      default. You must add proxy_http_version 1.1,
      proxy_set_header Upgrade $http_upgrade, and
      proxy_set_header Connection Upgrade to your location block.
      Without proxy_http_version 1.1, Nginx uses HTTP/1.0 which
      cannot upgrade connections at all.'
  - q: 'What is Sec-WebSocket-Accept and how is it calculated?'
    a:
      'Sec-WebSocket-Accept is the server response that proves it
      understood the WebSocket upgrade. The server concatenates the
      client Sec-WebSocket-Key with the magic GUID
      258EAFA5-E914-47DA-95CA-C5AB0DC85B11, takes the SHA-1 hash,
      and base64-encodes the result. If this value is wrong or
      missing, the client rejects the connection.'
---

:::note[Quick Answer]
A WebSocket connection starts as an HTTP/1.1 GET with four
required headers: `Upgrade: websocket`, `Connection: Upgrade`,
`Sec-WebSocket-Key`, and `Sec-WebSocket-Version: 13`. The server
proves it understood by returning `101 Switching Protocols` with a
`Sec-WebSocket-Accept` hash. After that exchange, both sides
switch to the WebSocket binary frame protocol.
:::

## The Full Handshake

Before covering each header, here is a complete handshake with
every header you will encounter:

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: graphql-ws, mqtt
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
Origin: https://example.com
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: graphql-ws
Sec-WebSocket-Extensions: permessage-deflate
```

After the server sends this response, both sides speak WebSocket
binary frames. No more HTTP.

## Client Request Headers

### Host

Standard HTTP host header. Required by HTTP/1.1, not specific to
WebSocket.

**Who sets it:** The browser or HTTP client, automatically.

**What breaks:** Without `Host`, the request is invalid HTTP. Most
servers return `400 Bad Request` before WebSocket processing even
starts.

### Upgrade: websocket

Tells the server to switch protocols from HTTP to WebSocket.

**Who sets it:** The browser or client library, automatically.

**What breaks:** Without this header, the server processes the
request as a normal HTTP GET. You get back a `200 OK` with an HTML
page or a `404` — not a WebSocket connection. The browser fires
`onerror` and `onclose` immediately.

### Connection: Upgrade

Signals that this is a hop-by-hop connection upgrade, not a regular
request.

**Who sets it:** The browser or client library, automatically.

**What breaks:** Same as missing `Upgrade`. The server ignores
the upgrade intent. This header is also the one most commonly
stripped by reverse proxies — see
[proxy issues](#how-reverse-proxies-affect-headers) below.

### Sec-WebSocket-Key

A base64-encoded 16-byte random value. The server uses this to
prove it actually understands the WebSocket protocol.

**Who sets it:** The browser generates 16 random bytes and
base64-encodes them. Server-side clients do the same.

**What breaks:** If missing, the server cannot compute
`Sec-WebSocket-Accept` and must reject the handshake. If the value
is not valid base64 or not 16 bytes decoded, conforming servers
reject it. In practice, most libraries generate this correctly —
you will only hit issues with hand-rolled HTTP clients.

**Example value:** `dGhlIHNhbXBsZSBub25jZQ==`

### Sec-WebSocket-Version: 13

Declares the WebSocket protocol version. The only valid value is
`13`, defined in [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455).
Versions 8 and below are obsolete drafts from 2011.

**Who sets it:** The browser, automatically. Always 13.

**What breaks:** If the client sends a different version, the
server must reject with `426 Upgrade Required` and include
`Sec-WebSocket-Version: 13` in the response to tell the client
what to use. Every modern browser and library sends 13. You will
only see version mismatches with very old or custom clients.

### Sec-WebSocket-Protocol (optional)

A comma-separated list of application-level subprotocols the client
supports. The server picks one.

**Who sets it:** Your code, via the second argument to the
`WebSocket` constructor:

```javascript
const ws = new WebSocket('wss://example.com/chat', [
  'graphql-ws',
  'graphql-transport-ws',
]);
// Sends: Sec-WebSocket-Protocol: graphql-ws, graphql-transport-ws
```

**What breaks:** If the server does not support any listed
subprotocol, it can either omit the header (connection opens
without an agreed subprotocol) or reject the handshake entirely.
Behavior depends on the server implementation. If the server
returns a subprotocol the client did not request, the browser
closes the connection.

**Common subprotocols:**

| Subprotocol | Use |
| --- | --- |
| `graphql-ws` | GraphQL subscriptions (graphql-ws library) |
| `graphql-transport-ws` | GraphQL subscriptions (older protocol) |
| `mqtt` | MQTT over WebSocket |
| `wamp.2.json` | WAMP v2 with JSON serialization |
| `ocpp1.6` | Open Charge Point Protocol (EV charging) |

### Sec-WebSocket-Extensions (optional)

Requests protocol-level extensions, most commonly compression.

**Who sets it:** The browser or client library. You cannot control
this directly from the browser WebSocket API — browsers decide
whether to request `permessage-deflate` on their own.

**Example:**

```http
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

**What breaks:** If the server does not support the requested
extension, it omits it from the response. The connection proceeds
without it. No error occurs.

**The trade-off with `permessage-deflate`:** compression saves
bandwidth but costs CPU and memory. The zlib sliding window
consumes ~300 KB per connection by default (two zlib sliding windows,
one per direction). At 10,000 connections, that is 3 GB of memory
just for compression state. For messages
under 100 bytes, compression often makes them larger. Skip it
unless your messages are consistently over 1 KB.

### Origin

The origin of the page that initiated the WebSocket connection.

**Who sets it:** The browser, automatically. You cannot override
it from JavaScript. Server-side clients typically do not send it.

**What breaks:** Nothing breaks if `Origin` is missing — the
connection still opens. But if your server does not validate
`Origin`, any website can open WebSocket connections to your server
from a user's browser, using their cookies and session. This is
Cross-Site WebSocket Hijacking (CSWSH), the WebSocket equivalent
of CSRF. Always validate `Origin` on the server against an
allowlist.

## Server Response Headers

The server must return `HTTP/1.1 101 Switching Protocols` with
these headers. Any other status code means the handshake failed.

### Upgrade: websocket

Confirms the protocol switch. Must match the client's request.

### Connection: Upgrade

Confirms the connection upgrade. Must be present.

### Sec-WebSocket-Accept

The proof that the server understood the WebSocket upgrade. The
server computes this from the client's `Sec-WebSocket-Key`:

1. Concatenate `Sec-WebSocket-Key` with the magic string
   `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`
2. Compute the SHA-1 hash of the concatenated string
3. Base64-encode the hash

```text
Key:    dGhlIHNhbXBsZSBub25jZQ==
Concat: dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11
SHA-1:  b37a4f2cc0624f1690f64606cf385945b2bec4ea
Base64: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

If the value is wrong, the browser closes the connection
immediately. This mechanism does not provide security — it is not
encryption or authentication. It only proves the server
intentionally processed the upgrade rather than being a caching
proxy that blindly forwarded the request.

### Sec-WebSocket-Protocol (conditional)

If the client proposed subprotocols, the server returns the one it
selected. The server must return exactly one value, not a list.
If the server returns a subprotocol the client did not offer, the
browser rejects the connection.

### Sec-WebSocket-Extensions (conditional)

The extensions the server agreed to. The server can accept all,
some, or none of the client's requested extensions.

## The Sec- Prefix: Why It Exists

Headers starting with `Sec-` have a special rule: browsers prevent
JavaScript from setting or reading them. Only the browser engine
itself can set `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, and
`Sec-WebSocket-Extensions`.

This matters because without this restriction, a malicious script
could forge a WebSocket handshake using `XMLHttpRequest` or
`fetch()` by manually setting the `Upgrade` and `Sec-WebSocket-*`
headers. The `Sec-` prefix makes this impossible — if a header
starts with `Sec-`, the browser silently drops any attempt by
JavaScript to set it.

Server-side clients (Node.js, Python, Go) are not bound by this
restriction. They can set any header they want.

## Headers You Cannot Set from the Browser

The browser `WebSocket` API is deliberately minimal. The
constructor takes a URL and an optional subprotocol list. That is
it. You cannot set:

- **`Authorization`** — No way to pass a Bearer token
- **Custom headers** — No `X-Request-ID`, no `X-API-Key`
- **`Cookie`** — You cannot choose which cookies to send (the
  browser sends all cookies for the domain automatically)

This is the single most common frustration developers hit when
moving from REST to WebSocket in the browser.

### Workarounds

**URL query parameters** — The simplest approach. Put the token
in the URL:

```javascript
const ws = new WebSocket(
  'wss://example.com/ws?token=eyJhbGciOi...'
);
```

The downside: tokens in URLs appear in server access logs, proxy
logs, and browser history. Use short-lived tokens and rotate them
after connection establishment.

**Cookies** — If your WebSocket server shares a domain with your
web app, authentication cookies are sent automatically. This
works but ties your WebSocket auth to your HTTP session, which
can be a problem when scaling across multiple server processes.

**First-message authentication** — Open the connection, then send
credentials as the first message:

```javascript
const ws = new WebSocket('wss://example.com/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'eyJhbGciOi...',
  }));
};
```

The server holds the connection but does not process other
messages until it validates the token. This is what most
real-time platforms use — services like
[Ably][ably-realtime], Pusher, and PubNub all authenticate
after the WebSocket connection is established rather than
during the HTTP handshake.

**Subprotocol header** — Some developers encode tokens in the
`Sec-WebSocket-Protocol` header since it is the one header you
can set from the browser API. This works technically but abuses
the header's purpose and can confuse debugging tools.

## How Reverse Proxies Affect Headers

Reverse proxies are the number one reason WebSocket connections
fail in production. The connection works on localhost. It works
when you connect directly to the server. It breaks the moment
you put Nginx, HAProxy, or a cloud load balancer in front.

**The problem:** HTTP proxies treat `Upgrade` and `Connection` as
hop-by-hop headers. Per HTTP spec, hop-by-hop headers are consumed
by the first proxy and not forwarded. Your server never sees the
upgrade request. It gets a normal GET, returns a 200 or 404, and
the WebSocket handshake fails silently.

### Nginx

Nginx does not forward `Upgrade` by default. You must explicitly
pass it through:

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

Three things go wrong if you skip parts of this config:

1. Without `proxy_http_version 1.1`, Nginx uses HTTP/1.0, which
   does not support connection upgrades at all.
2. Without the `Upgrade` and `Connection` headers, the backend
   sees a normal GET request.
3. Without the timeout overrides, Nginx closes idle WebSocket
   connections after 60 seconds (its default `proxy_read_timeout`).

### AWS Application Load Balancer

ALB supports WebSocket natively on ports 80 and 443. No special
configuration is needed — it detects the `Upgrade` header and
switches to a persistent connection. However, ALB has an idle
timeout (default 60 seconds) that closes connections with no
traffic. Set the idle timeout higher or implement application-level
ping/pong.

### Cloudflare

Cloudflare proxies WebSocket traffic automatically for all plans.
The main gotcha: Cloudflare enforces a 100-second idle timeout on
free plans. If your application has quiet periods longer than that,
send WebSocket ping frames every 30 seconds.

## Frequently Asked Questions

### What headers are required for a WebSocket handshake?

Five client headers are mandatory: `Host`, `Upgrade: websocket`,
`Connection: Upgrade`, `Sec-WebSocket-Key`, and
`Sec-WebSocket-Version: 13`. The server must respond with
`101 Switching Protocols`, `Upgrade: websocket`,
`Connection: Upgrade`, and `Sec-WebSocket-Accept`. If any of
these are missing or wrong, the handshake fails — the browser
fires `onerror` and closes the connection. See the
[full handshake](#the-full-handshake) above for a complete
example.

### Can I set custom headers on a browser WebSocket connection?

No. The browser `WebSocket` constructor accepts only a URL and
an optional subprotocol list. There is no parameter for custom
headers. This means you cannot send `Authorization`,
`X-API-Key`, or any other custom header. Use URL query
parameters, cookies, or first-message authentication instead.
See [workarounds](#workarounds) for code examples.

### What does the Sec- prefix mean on WebSocket headers?

The `Sec-` prefix marks headers that only the browser engine can
set. JavaScript cannot create, modify, or read `Sec-` headers
through `XMLHttpRequest` or `fetch()`. This prevents malicious
scripts from forging WebSocket handshakes. Server-side clients
are not restricted — they can set any header. See
[why the Sec- prefix exists](#the-sec--prefix-why-it-exists)
for details.

### Why does my WebSocket connection fail behind Nginx?

Nginx treats `Upgrade` and `Connection` as hop-by-hop headers
and strips them by default. Your backend receives a normal HTTP
GET, not a WebSocket upgrade request. Add
`proxy_http_version 1.1`, `proxy_set_header Upgrade`,
and `proxy_set_header Connection "Upgrade"` to your Nginx
location block. See the [Nginx config](#nginx) above for a
working example.

### What is Sec-WebSocket-Accept and how is it calculated?

The server concatenates the client's `Sec-WebSocket-Key` with
the magic GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, takes
the SHA-1 hash, and base64-encodes the result. This proves the
server intentionally processed the WebSocket upgrade. It is not
a security mechanism — it does not authenticate or encrypt
anything. It only prevents caching proxies from accidentally
completing a handshake they do not understand.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) — The
  browser API for creating and managing WebSocket connections
- [WebSocket Close Codes](/reference/close-codes/) — Status codes
  returned when a WebSocket connection closes
- [What Are WebSockets?](/guides/road-to-websockets/) — How
  WebSockets work, from HTTP to persistent connections
- [WebSocket Security Guide](/guides/security/) — TLS,
  authentication, and CSWSH prevention
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/)
  — Reverse proxy setup for WebSocket traffic

[ably-realtime]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=headers
