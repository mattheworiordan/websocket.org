---
title: 'WebSocket Handshake: HTTP Upgrade at Protocol Level'
description:
  'How the WebSocket handshake works: HTTP upgrade request,
  Sec-WebSocket-Accept calculation, failure modes, proxy issues,
  and subprotocol negotiation.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-28'
lastUpdated: 2026-03-28
category: reference
sidebar:
  order: 4
keywords:
  - websocket handshake
  - websocket upgrade
  - http upgrade websocket
  - 101 switching protocols
  - sec-websocket-accept
seo:
  keywords:
    - websocket handshake
    - websocket http upgrade
    - 101 switching protocols
    - sec-websocket-accept calculation
    - websocket connection upgrade
    - websocket proxy issues
faq:
  - q: 'Why does the WebSocket handshake use HTTP?'
    a:
      'WebSocket uses HTTP for the initial handshake because HTTP
      traffic passes through firewalls, proxies, and load balancers
      that would block raw TCP on non-standard ports. By starting
      as an HTTP request, WebSocket connections reach servers through
      the same infrastructure as normal web traffic.'
  - q: 'What is the WebSocket magic GUID string?'
    a:
      'The magic GUID is 258EAFA5-E914-47DA-95CA-C5AB0DC85B11,
      defined in RFC 6455. The server concatenates the client key
      with this string, hashes it with SHA-1, and base64 encodes
      the result. It proves the server intentionally processed the
      WebSocket upgrade rather than blindly proxying the request.'
  - q: 'What causes a WebSocket handshake to fail?'
    a:
      'Common failures: 400 Bad Request (malformed headers), 401
      Unauthorized (missing auth token), 403 Forbidden (origin
      rejected), 426 Upgrade Required (wrong protocol version). The
      most frequent production failure is a proxy stripping the
      Upgrade header before it reaches the server.'
  - q: 'Does TLS happen before or after the WebSocket handshake?'
    a:
      'TLS completes first. With wss://, the client performs the
      full TLS handshake to establish an encrypted channel. Only
      then does the HTTP upgrade request travel over that encrypted
      connection. The WebSocket frames that follow are also
      encrypted by the same TLS session.'
  - q: 'How does WebSocket subprotocol negotiation work?'
    a:
      'The client sends a Sec-WebSocket-Protocol header listing
      subprotocols it supports. The server picks exactly one and
      returns it. If the server does not support any, it omits the
      header and the connection opens without an agreed subprotocol.
      Common subprotocols include graphql-ws and mqtt.'
---

:::note[Quick Answer]
The WebSocket handshake is a single HTTP request-response exchange.
The client sends a `GET` with `Upgrade: websocket`. The server
replies with `101 Switching Protocols`. After that, both sides
switch to the WebSocket binary frame protocol. The entire
handshake is one round trip on top of the TCP (and optionally
TLS) connection.
:::

## Why HTTP?

WebSocket could have been a raw TCP protocol. It was not, and
the reason is pragmatic: firewalls and proxies.

Corporate firewalls block outbound connections on non-standard
ports. HTTP proxies only forward HTTP traffic. If WebSocket used
its own TCP handshake on port 4000, it would be blocked by most
enterprise networks. By starting as an HTTP request on port 80
or 443, WebSocket piggybacks on existing HTTP infrastructure. The
connection looks like normal web traffic until the upgrade
completes.

This is also why `wss://` works better than `ws://` in practice.
TLS-encrypted traffic on port 443 passes through nearly every
proxy and firewall without inspection. Unencrypted `ws://` on
port 80 can be intercepted, inspected, and broken by
intermediaries that do not understand the Upgrade mechanism.

## The Upgrade Request

Every WebSocket connection starts as an HTTP/1.1 GET request.
The client adds headers that signal the protocol switch:

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
Sec-WebSocket-Version: 13
Origin: https://example.com
```

Four headers are required:

- **`Upgrade: websocket`** -- Tells the server which protocol
  to switch to.
- **`Connection: Upgrade`** -- Tells HTTP intermediaries this
  is a protocol switch, not a normal request.
- **`Sec-WebSocket-Key`** -- A random 16-byte value,
  base64-encoded. The server uses it to prove it understands
  WebSocket (explained below).
- **`Sec-WebSocket-Version: 13`** -- The only version in use.
  RFC 6455 defines version 13. Versions 8 and earlier are
  obsolete and no browser supports them.

The request must be HTTP/1.1. HTTP/1.0 does not support
connection upgrades. HTTP/2 uses a different mechanism
([RFC 8441](https://datatracker.ietf.org/doc/html/rfc8441)).

## The Server Response

If the server accepts the upgrade, it responds with exactly:

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
```

Any status code other than `101` means the handshake failed.
A `200 OK` means the server treated it as a normal HTTP GET and
ignored the upgrade entirely.

After this response, both sides stop speaking HTTP. Every byte
that follows uses the WebSocket binary frame protocol. There is
no HTTP response body.

## The Sec-WebSocket-Accept Calculation

The server must prove it intentionally processed the WebSocket
upgrade. Here is how:

1. Take the client's `Sec-WebSocket-Key` value.
2. Concatenate it with the magic GUID:
   `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`.
3. Compute the SHA-1 hash of the concatenated string.
4. Base64-encode the 20-byte hash.
5. Return the result as `Sec-WebSocket-Accept`.

```text
Key:    x3JJHMbDL1EzLkh9GBhXDw==
GUID:   258EAFA5-E914-47DA-95CA-C5AB0DC85B11
Concat: x3JJHMbDL1EzLkh9GBhXDw==258EAFA5-E914-47DA-95CA-C5AB0DC85B11
SHA-1:  1d29ab734b0c9585240069a6e4e3e91b61da1969
Base64: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
```

The client checks the returned value. If it does not match,
the connection is immediately closed.

### Why the magic GUID exists

The GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` is a fixed
constant from [RFC 6455, section 4.2.2][rfc-6455-sec-4]. It has
no cryptographic significance. It exists for one reason: to
prevent HTTP servers and caching proxies that do not understand
WebSocket from accidentally completing the handshake.

Without the GUID check, a proxy could receive the upgrade
request, cache the response, and replay it later. The fixed
GUID means only a server that has WebSocket code compiled in
will produce the correct `Sec-WebSocket-Accept`. This is not
security -- it does not authenticate anything. It is a protocol
correctness check.

## Subprotocol Negotiation

Subprotocols define what the messages _mean_ after the
connection opens. The WebSocket protocol itself only defines
frames. It says nothing about the content.

```http
GET /api HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: graphql-ws, graphql-transport-ws
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: graphql-ws
```

The server picks exactly one. If it does not support any of the
client's choices, it omits the header. The connection still
opens -- just without an agreed message format. This is fine for
custom protocols but a problem for standardized ones like MQTT
or GraphQL where both sides need the same framing.

Use subprotocols when you need interoperability. Skip them when
you control both the client and server and have your own message
format.

## Extension Negotiation

Extensions modify the WebSocket protocol itself. The most common
is `permessage-deflate`, which compresses each message with
zlib:

```http
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

The server can accept, modify, or reject extensions. If it
accepts `permessage-deflate`, both sides compress every message
before framing.

The trade-off is real. Compression saves 60-80% bandwidth on
text-heavy messages. But it costs 300KB+ of memory per
connection for the zlib sliding window. At 50,000 connections,
that is 15GB of RAM just for compression state. For small
messages under 100 bytes, compression often makes them larger
due to zlib framing overhead.

At [Ably][ably-link], we selectively enable compression based on
message size and client type -- mobile clients on cellular
connections benefit from the bandwidth savings, while
server-to-server links on fast networks do not. Services like
[Pusher](https://pusher.com) and
[PubNub](https://www.pubnub.com) make similar trade-offs.

## TLS and the Handshake

For `wss://` connections, TLS completes _before_ the HTTP
upgrade:

```text
Client                           Server
  |                                |
  |--- TCP SYN ------------------->|
  |<-- TCP SYN-ACK ----------------|
  |--- TCP ACK ------------------->|
  |                                |
  |--- TLS ClientHello ----------->|
  |<-- TLS ServerHello ------------|
  |<-- TLS Certificate ------------|
  |--- TLS Key Exchange ---------->|
  |<-- TLS Finished ---------------|
  |--- TLS Finished -------------->|
  |                                |
  |--- HTTP GET (Upgrade) -------->|
  |<-- HTTP 101 (Switching) -------|
  |                                |
  |<== WebSocket Frames ===========>|
```

The HTTP upgrade request travels over the encrypted TLS channel.
Every WebSocket frame after that is also encrypted. The server
never sees unencrypted WebSocket data.

This ordering matters for proxies. A TLS-encrypted connection
to port 443 uses the CONNECT method to tunnel through HTTP
proxies. The proxy cannot inspect the contents, so it cannot
strip the `Upgrade` header. This is why `wss://` is far more
reliable than `ws://` through corporate networks.

## Common Handshake Failures

### 400 Bad Request

The client sent malformed headers. Missing `Upgrade`, wrong
`Sec-WebSocket-Key` length, or garbage in a required field.
Check your client library version -- this usually means
something is constructing the request incorrectly.

### 401 Unauthorized

The server requires authentication before allowing the
upgrade. WebSocket does not have its own auth mechanism, so
authentication happens via:

- A query string token: `wss://example.com/ws?token=abc123`
- A cookie sent with the upgrade request
- A custom header (only works with non-browser clients)

Browsers cannot set custom headers on WebSocket connections.
If you need token auth from a browser, put the token in the
URL or use a cookie.

### 403 Forbidden

The server rejected the `Origin` header. This is the WebSocket
equivalent of a CORS rejection. The server has an allowlist of
origins and yours is not on it. This is correct behavior -- a
server that does not check origins allows any website to open
WebSocket connections using a visitor's cookies.

### 426 Upgrade Required

The client sent a `Sec-WebSocket-Version` other than 13. The
server responds with:

```http
HTTP/1.1 426 Upgrade Required
Sec-WebSocket-Version: 13
```

In practice, you only hit this with very old clients or broken
custom implementations. Every modern browser sends version 13.

### Connection closed with no response

The most common production failure. A proxy or load balancer
between the client and server does not understand the `Upgrade`
header. It either strips the header (server gets a normal GET)
or closes the connection entirely.

## How Proxies Break the Handshake

HTTP proxies are designed for request-response patterns. A
WebSocket upgrade violates that assumption. Here is what goes
wrong:

**Forward proxies** (corporate HTTP proxies) inspect traffic on
port 80. They see `Connection: Upgrade` and either strip it
(they are not supposed to forward hop-by-hop headers) or reject
it. This is why `ws://` fails in many office networks while
`wss://` works -- TLS tunneling bypasses the proxy inspection.

**Reverse proxies** (Nginx, HAProxy, AWS ALB) sit in front of
your server. Most default configurations do not forward the
`Upgrade` and `Connection` headers to the backend. The fix for
Nginx:

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

Three things go wrong here regularly:

1. **Missing `proxy_http_version 1.1`** -- Nginx defaults to
   HTTP/1.0 for upstream connections. HTTP/1.0 cannot upgrade.
2. **Missing `Connection "Upgrade"`** -- Nginx strips hop-by-hop
   headers by default. You must explicitly set this.
3. **Idle timeout** -- Nginx closes idle connections after 60
   seconds. WebSocket connections that send pings less frequently
   will be terminated. Set `proxy_read_timeout 3600s` or higher.

**CDNs** (Cloudflare, AWS CloudFront) generally support
WebSocket upgrades but may add latency, enforce connection
limits, or buffer frames. Cloudflare supports WebSocket on all
plans. CloudFront does not support WebSocket at all -- use an
ALB instead.

## The Full Connection Timeline

From the client's perspective, connecting to
`wss://example.com/ws` involves:

1. **DNS resolution** -- Resolve `example.com`. Typically 10-50ms
   unless cached.
2. **TCP handshake** -- SYN, SYN-ACK, ACK. One round trip,
   typically 10-100ms depending on distance.
3. **TLS handshake** -- One to two additional round trips for
   TLS 1.2, one for TLS 1.3. Adds 30-200ms.
4. **HTTP upgrade** -- One round trip. The GET request and the
   101 response. Typically under 10ms of server processing.
5. **WebSocket open** -- The `onopen` event fires. Total time
   from calling `new WebSocket()` to `onopen`: typically
   50-350ms.

The handshake itself (step 4) is fast. The latency is dominated
by TCP and TLS setup. This is why reconnection strategies
should try to keep existing TCP connections alive when possible.

## Frequently Asked Questions

### Why does the WebSocket handshake use HTTP?

Pragmatism. The early WebSocket drafts experimented with custom
TCP handshakes. They did not work in practice because corporate
firewalls block unknown protocols on non-standard ports, and
HTTP proxies refuse to forward non-HTTP traffic.

By using HTTP for the initial request, WebSocket connections
travel through the same ports (80 and 443) and the same
infrastructure (proxies, load balancers, CDNs) as normal web
traffic. The cost is one extra round trip and a few hundred
bytes of HTTP headers. The benefit is that WebSocket works
almost everywhere the web works.

### What is the WebSocket magic GUID string?

The string `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` is a constant
defined in [RFC 6455][rfc-6455-sec-4]. The server concatenates
it with the client's `Sec-WebSocket-Key`, hashes the result
with SHA-1, and returns the base64-encoded hash as
`Sec-WebSocket-Accept`.

It is not a secret. It is not cryptographic. It exists solely
to ensure the server has actual WebSocket code rather than an
HTTP server accidentally returning 101 to an Upgrade request it
does not understand. A caching proxy would not know to perform
this calculation, so the client can detect when a response is
fake.

### What causes a WebSocket handshake to fail?

The five most common causes, in order of frequency:

1. A proxy stripping the `Upgrade` header before it reaches
   the server. Use `wss://` and check your Nginx/ALB config.
2. Authentication failure (401). The token in the URL or cookie
   was missing or expired.
3. Origin rejection (403). The server's origin allowlist does
   not include your domain.
4. Malformed request (400). Usually a broken client library or
   manual header construction gone wrong.
5. Wrong version (426). Almost never happens with modern
   clients.

### Does TLS happen before or after the WebSocket handshake?

Before. Always before. The sequence is: TCP handshake, TLS
handshake, HTTP upgrade request, WebSocket frames. The HTTP
upgrade travels over the already-encrypted TLS connection. This
means a network observer sees only TLS-encrypted traffic and
cannot tell that a WebSocket upgrade is happening inside it.

### How does WebSocket subprotocol negotiation work?

The client lists supported subprotocols in the
`Sec-WebSocket-Protocol` header, comma-separated. The server
picks one and returns it in its 101 response. The server must
pick exactly one -- returning multiple is a protocol violation.

If the server does not support any of the listed subprotocols,
it omits the header entirely. The connection still opens, but
without a formal message format agreement. For protocols like
MQTT over WebSocket, the subprotocol header is mandatory -- the
MQTT broker will reject connections that do not specify it.

## Related Content

- [WebSocket Headers Reference](/reference/headers/) -- Every
  handshake header explained in detail
- [WebSocket Close Codes](/reference/close-codes/) -- Status
  codes when connections close
- [WebSocket Ports](/reference/ports/) -- Default ports, TLS,
  and firewall configuration
- [wss vs ws](/reference/wss-vs-ws/) -- When and why to use
  encrypted WebSocket connections
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/)
  -- Production proxy setup for WebSocket

[ably-link]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=handshake
[rfc-6455-sec-4]:
  https://datatracker.ietf.org/doc/html/rfc6455#section-4.2.2
