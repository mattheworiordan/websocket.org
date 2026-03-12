---
title: 'WebSocket Handshake Headers: Request & Response Explained'
description:
  'Every WebSocket handshake header explained: Upgrade, Connection,
  Sec-WebSocket-Key, Sec-WebSocket-Accept, Version, Protocol, and
  Extensions.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-12'
lastUpdated: 2026-03-12
category: reference
sidebar:
  order: 3
keywords:
  - websocket headers
  - websocket handshake headers
  - sec-websocket-key
  - sec-websocket-accept
  - websocket upgrade header
seo:
  keywords:
    - websocket headers
    - websocket handshake headers
    - sec-websocket-key
    - sec-websocket-accept
    - websocket upgrade header
    - websocket connection upgrade
faq:
  - q: 'What headers are required for a WebSocket handshake?'
    a:
      'The client must send Upgrade: websocket, Connection: Upgrade,
      Sec-WebSocket-Key (random base64 value), and
      Sec-WebSocket-Version: 13. The server responds with 101
      Switching Protocols, Upgrade: websocket, Connection: Upgrade,
      and Sec-WebSocket-Accept (hash of the client key).'
  - q: 'What is Sec-WebSocket-Key used for?'
    a:
      'Sec-WebSocket-Key is a random 16-byte base64-encoded value
      sent by the client. The server hashes it with a magic string
      and returns the result as Sec-WebSocket-Accept. This proves the
      server understands WebSocket and is not a caching proxy
      accidentally forwarding the request.'
  - q: 'What is Sec-WebSocket-Protocol used for?'
    a:
      'Sec-WebSocket-Protocol is an optional header where the client
      lists subprotocols it supports (e.g., graphql-ws, mqtt). The
      server picks one and returns it. This lets both sides agree on
      a message format before exchanging data.'
---

:::note[Quick Answer]
A WebSocket connection starts with an HTTP Upgrade request.
The client sends `Upgrade: websocket`, `Connection: Upgrade`,
a random `Sec-WebSocket-Key`, and `Sec-WebSocket-Version: 13`.
The server responds with `101 Switching Protocols` and a
`Sec-WebSocket-Accept` header that proves it understood the
request. After this handshake, the connection switches from
HTTP to the WebSocket binary frame protocol.
:::

## Client Request Headers

Every WebSocket handshake begins as an HTTP/1.1 GET request.
The browser (or client library) adds these headers automatically.

| Header | Required | Description |
| ------ | -------- | ----------- |
| `Upgrade: websocket` | Yes | Tells the server to switch from HTTP to the WebSocket protocol. |
| `Connection: Upgrade` | Yes | Signals that this is a connection upgrade, not a normal HTTP request. |
| `Sec-WebSocket-Key` | Yes | Random 16-byte value, base64-encoded. The server uses this to prove it understands WebSocket. |
| `Sec-WebSocket-Version: 13` | Yes | Protocol version. Always 13 per [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455). Other versions are obsolete. |
| `Sec-WebSocket-Protocol` | No | Comma-separated list of subprotocols the client supports (e.g., `graphql-ws`, `mqtt`). |
| `Sec-WebSocket-Extensions` | No | Requested extensions, most commonly `permessage-deflate` for compression. |
| `Origin` | No | The origin of the page initiating the connection. Browsers send this automatically; servers should validate it. |

## Handshake Example

Here is a real WebSocket handshake — the HTTP request from the
client, and the server's response:

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: graphql-ws
Origin: https://example.com
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: graphql-ws
```

After the server sends this response, both sides switch to the
WebSocket binary frame protocol. No more HTTP.

## Server Response Headers

The server must return exactly these headers to complete the
upgrade:

- **`HTTP/1.1 101 Switching Protocols`** — Any other status code
  means the handshake failed. A `200 OK` means the server treated
  it as a normal HTTP request.
- **`Upgrade: websocket`** — Confirms the protocol switch.
- **`Connection: Upgrade`** — Confirms the connection upgrade.
- **`Sec-WebSocket-Accept`** — A hash that proves the server
  processed the client's `Sec-WebSocket-Key`. Without this, the
  client rejects the connection.

## How Sec-WebSocket-Key and Accept Work

This is the part that confuses people. The mechanism exists to
prevent accidental WebSocket upgrades by caching proxies or
servers that do not actually understand the protocol.

1. The client generates a random 16-byte value and
   base64-encodes it. This becomes `Sec-WebSocket-Key`.
2. The server concatenates this value with the magic string
   `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` (defined in RFC 6455).
3. The server takes the SHA-1 hash of the result and
   base64-encodes it.
4. The server sends this as `Sec-WebSocket-Accept`.

The client checks the hash. If it does not match, the connection
is closed. This does not provide security — it is not
authentication or encryption. It only proves the server
intentionally processed the WebSocket upgrade rather than
blindly proxying the request.

Example calculation:

```text
Key:    dGhlIHNhbXBsZSBub25jZQ==
Concat: dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11
SHA-1:  b37a4f2cc0624f1690f64606cf385945b2bec4ea
Base64: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

## Optional Headers

### Sec-WebSocket-Protocol (Subprotocols)

The client lists which subprotocols it supports. The server picks
one and returns it. If the server does not support any of them, it
can omit the header entirely — the connection still opens, just
without an agreed subprotocol.

Common subprotocols:

- `graphql-ws` — GraphQL over WebSocket
- `mqtt` — MQTT messaging
- `wamp` — Web Application Messaging Protocol
- `soap` — SOAP over WebSocket

Use subprotocols when you need both sides to agree on a message
format _before_ exchanging data. Without one, you are relying on
application-level conventions that nothing enforces.

### Sec-WebSocket-Extensions

Extensions modify the WebSocket protocol itself — typically to add
compression. The most common extension is `permessage-deflate`,
which compresses each message using zlib.

```http
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

The trade-off: compression saves bandwidth but adds CPU overhead
and memory per connection (zlib keeps a sliding window). At
[Ably][ably-realtime], we have seen this matter at scale — tens of
thousands of connections with `permessage-deflate` enabled can
consume significant memory on the server. For small messages
(under 100 bytes), compression often makes them _larger_.

## Common Issues

### Proxy Stripping the Upgrade Header

This is the most common reason WebSocket connections fail in
production. Reverse proxies (Nginx, HAProxy, AWS ALB) do not
forward `Upgrade` and `Connection` headers by default. The
request arrives at your server as a normal HTTP GET, and the
handshake fails silently.

Nginx fix:

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

If you skip `proxy_http_version 1.1`, Nginx uses HTTP/1.0 which
does not support connection upgrades at all.

### Wrong Sec-WebSocket-Version

If the client sends a version other than `13`, the server must
reject the handshake with a `426 Upgrade Required` response and
include a `Sec-WebSocket-Version: 13` header telling the client
which version to use. In practice, every modern browser and
library sends version 13. You will only hit this with very old or
custom clients.

### Missing Origin Validation

Browsers automatically send the `Origin` header. Servers should
check it. If you do not, any website can open a WebSocket
connection to your server from a user's browser, using their
cookies and session. This is the WebSocket equivalent of CSRF. A
simple origin allowlist on the server prevents it.

## Frequently Asked Questions

### What headers are required for a WebSocket handshake?

Four client headers are mandatory: `Upgrade: websocket`,
`Connection: Upgrade`, `Sec-WebSocket-Key`, and
`Sec-WebSocket-Version: 13`. The server must respond with
`101 Switching Protocols`, plus `Upgrade: websocket`,
`Connection: Upgrade`, and `Sec-WebSocket-Accept`. If any of
these are missing, the handshake fails — the browser will fire
an `onerror` event and close the connection. See the
[handshake example](#handshake-example) above for the full
request and response.

### What is Sec-WebSocket-Key used for?

It prevents accidental upgrades. The client sends a random
base64-encoded value. The server hashes it with a fixed magic
string (defined in the RFC) and returns the result as
`Sec-WebSocket-Accept`. This proves the server intentionally
processed the WebSocket upgrade and is not a caching proxy
blindly forwarding requests. It is _not_ a security mechanism —
it does not authenticate or encrypt anything. See
[how Sec-WebSocket-Key and Accept work](#how-sec-websocket-key-and-accept-work)
for the full calculation.

### What is Sec-WebSocket-Protocol used for?

It lets the client and server agree on a message format before
exchanging data. The client lists subprotocols it supports
(e.g., `graphql-ws`, `mqtt`). The server picks one and returns
it. If neither side sends this header, the connection still
works — you just have no formal contract for what the messages
mean. See [subprotocols](#sec-websocket-protocol-subprotocols)
for common values.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) — The
  browser API for creating and managing WebSocket connections
- [WebSocket Close Codes](/reference/close-codes/) — Status codes
  returned when a WebSocket connection closes
- [What Are WebSockets?](/guides/road-to-websockets/) — How
  WebSockets work, from HTTP to persistent connections
- [WebSocket vs HTTP](/comparisons/http/) — When to use
  WebSockets instead of standard HTTP
- [WebSocket vs SSE](/comparisons/sse/) — Choosing between
  WebSockets and Server-Sent Events

[ably-realtime]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=websocket-headers
