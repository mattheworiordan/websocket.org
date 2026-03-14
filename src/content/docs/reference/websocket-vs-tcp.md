---
title: 'WebSocket vs TCP: How WebSocket Sits on Top of TCP'
description: >-
  WebSocket runs on top of TCP, not alongside it. Frame overhead numbers,
  head-of-line blocking explained, and when to use raw TCP or WebTransport
  instead.
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-04-02'
lastUpdated: 2026-04-02
category: reference
sidebar:
  order: 6
keywords:
  - websocket vs tcp
  - websocket tcp or udp
  - websocket tcp
  - websocket protocol layer
  - websocket frame overhead
seo:
  keywords:
    - websocket vs tcp
    - websocket tcp or udp
    - websocket tcp
    - is websocket tcp
    - websocket raw tcp
    - websocket protocol stack
    - websocket head of line blocking
faq:
  - q: 'Does WebSocket use TCP or UDP?'
    a: >-
      WebSocket uses TCP exclusively. It starts as an HTTP request
      over TCP, then upgrades to a persistent WebSocket connection
      on the same TCP connection. WebSocket does not use UDP.
      WebTransport is the protocol that uses QUIC over UDP.
  - q: 'Is WebSocket faster than TCP?'
    a: >-
      No. WebSocket runs on top of TCP, so it cannot be faster
      than TCP. WebSocket adds 2-14 bytes of framing per message.
      It is faster than HTTP because it eliminates per-request
      headers, but the transport underneath is always TCP.
  - q: 'What does WebSocket add over raw TCP?'
    a: >-
      WebSocket adds message framing (TCP is a byte stream with
      no message boundaries), an HTTP-compatible handshake that
      traverses proxies and load balancers, browser access via
      JavaScript, and a close handshake with status codes.
  - q: 'When should I use raw TCP instead of WebSocket?'
    a: >-
      Use raw TCP for server-to-server communication with custom
      binary protocols where you control both endpoints and do
      not need HTTP proxy traversal. Database protocols, game
      servers, and inter-service messaging are common cases.
  - q: 'What is head-of-line blocking in WebSocket?'
    a: >-
      Head-of-line blocking is inherited from TCP. If one TCP
      packet is lost, all subsequent packets wait for the
      retransmission, even if they contain independent messages.
      WebTransport over QUIC solves this with independent streams.
---

:::note[Quick Answer]
WebSocket is **not** an alternative to TCP. It runs on top of
TCP. A WebSocket connection is a TCP connection with message
framing, an HTTP-compatible handshake, and browser access added
on top. Saying "WebSocket vs TCP" is like saying "HTTP vs TCP"
--- they are different layers, not competing choices.
:::

## WebSocket IS TCP

The most common misconception: WebSocket is some alternative
to TCP. It is not. Every WebSocket connection is a TCP
connection. The bytes flow over the same reliable, ordered
stream that TCP has always provided.

What WebSocket adds is a protocol layer on top of that TCP
connection. It defines how to frame messages, how to open and
close connections, and how to interoperate with HTTP
infrastructure.

## The protocol stack

Here is what actually happens when you open a WebSocket
connection:

```text
┌─────────────────────────┐
│     Your Application    │
├─────────────────────────┤
│  WebSocket (RFC 6455)   │  ← message framing, ping/pong
├─────────────────────────┤
│     HTTP (upgrade)      │  ← handshake only, then gone
├─────────────────────────┤
│     TLS (optional)      │  ← wss:// connections
├─────────────────────────┤
│          TCP            │  ← reliable, ordered byte stream
├─────────────────────────┤
│          IP             │
└─────────────────────────┘
```

The HTTP layer is only used once, during the opening
handshake. The client sends an HTTP `Upgrade` request. The
server responds with `101 Switching Protocols`. After that,
HTTP is out of the picture. The rest of the connection is
WebSocket frames sent directly over TCP (or TLS over TCP).

## What WebSocket adds over raw TCP

TCP gives you a byte stream. WebSocket gives you messages.
That distinction solves real problems.

### Message framing

TCP has no concept of message boundaries. Send two 100-byte
messages on a raw TCP socket. The receiver might get one
200-byte chunk, three chunks of 80, 70, and 50 bytes, or any
other combination. You must implement your own length-prefix
or delimiter protocol to reconstruct messages.

WebSocket handles this. Every `send()` produces exactly one
`message` event on the other side.

```javascript
// With WebSocket: one send = one message. Always.
ws.send(JSON.stringify({ type: 'position', x: 10, y: 20 }));

// With raw TCP: you need your own framing
// 4-byte length prefix + payload
const payload = Buffer.from(JSON.stringify({ type: 'position', x: 10, y: 20 }));
const frame = Buffer.alloc(4 + payload.length);
frame.writeUInt32BE(payload.length, 0);
payload.copy(frame, 4);
socket.write(frame);
```

### HTTP-compatible handshake

WebSocket's upgrade handshake looks like a normal HTTP
request to proxies, CDNs, and load balancers. Raw TCP
connections on arbitrary ports get blocked by corporate
firewalls. WebSocket on port 443 passes through because the
initial handshake is valid HTTP.

### Browser access

Browsers expose a WebSocket API. They do not expose raw TCP
sockets. Letting arbitrary JavaScript open TCP connections to
any host would let malicious scripts port-scan internal
networks, connect to databases, and bypass firewalls.
WebSocket's origin-based security model prevents this.

### Close handshake

WebSocket defines close codes (1000 for normal, 1001 for
going away, 1008 for policy violation). Raw TCP has `FIN` and
`RST` but no application-level reason. When a connection
drops, you cannot tell the other side _why_.

## What WebSocket removes vs HTTP

WebSocket is not just "TCP plus extras." It also removes
significant overhead compared to HTTP.

| | HTTP/1.1 request | WebSocket frame |
| --- | --- | --- |
| **Headers per message** | 200-800 bytes (cookies, auth, etc.) | 0 bytes |
| **Frame overhead** | N/A | 2-14 bytes |
| **Direction** | Client-initiated only | Either direction |
| **Connection** | New or keep-alive pool | Single persistent |

An HTTP request carries headers on every single request.
Cookies, `Authorization`, `Accept`, `Content-Type` — these
add up. A typical request header block is 400-800 bytes. Over
1,000 messages per second, that is 400-800 KB/s of pure
overhead. A WebSocket frame header is 2 bytes for small
messages, 4 bytes for messages up to 65,535 bytes, and 10
bytes for larger payloads. Client-to-server frames add 4
bytes for the masking key, bringing the total to 6-14 bytes.

## Frame overhead: the actual numbers

People ask "what is the overhead of WebSocket?" Here are the
exact byte counts from RFC 6455:

```text
WebSocket frame header structure:

  0                   1
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7
 +-+-+-+-+-------+-+-------------+---+
 |F|R|R|R| opcode|M| Payload len |...|
 |I|S|S|S|  (4)  |A|   (7)      |   |
 |N|V|V|V|       |S|             |   |
 | |1|2|3|       |K|             |   |
 +-+-+-+-+-------+-+-------------+---+

Small message (≤125 bytes):   2 bytes header
Medium message (≤65535 bytes): 4 bytes header
Large message (>65535 bytes):  10 bytes header

Client → Server adds 4-byte masking key:
  Small: 6 bytes   Medium: 8 bytes   Large: 14 bytes
```

Compare this to TCP itself, which adds no application-layer
framing at all. TCP is a byte stream — zero framing overhead,
but zero message boundaries. The 2-14 bytes WebSocket adds
per frame is the cost of getting discrete messages instead
of a raw stream.

## The "WebSocket is faster than TCP" misconception

You will see benchmarks claiming WebSocket is faster than
some other protocol. That is a comparison against HTTP or
SSE, not against TCP. WebSocket cannot be faster than TCP
because it runs _on_ TCP. Every WebSocket byte travels
through the TCP stack.

What people actually mean: WebSocket has less overhead than
HTTP for repeated messages because it eliminates per-request
headers. After the initial handshake, a WebSocket message
adds 2-6 bytes of framing. An equivalent HTTP request adds
hundreds of bytes of headers. For high-frequency
communication, that difference is real.

But compared to raw TCP? WebSocket is strictly slower. It
adds framing, masking (client-to-server), and protocol
processing that raw TCP does not have. The overhead is tiny
--- microseconds per message --- but it exists.

## Head-of-line blocking

WebSocket inherits TCP's head-of-line blocking problem. If
one TCP packet is lost, every subsequent packet waits for the
retransmission, even if those packets contain completely
independent messages.

Consider a chat application sending messages from three
different channels over one WebSocket connection. A packet
carrying a message from channel A is lost. Messages from
channels B and C are already buffered in the kernel. They
wait. TCP will not deliver out-of-order data to the
application.

For most applications, this is fine. Packet loss on modern
networks is under 0.1%, and retransmission takes 10-30ms. But
for latency-sensitive applications — real-time gaming, live
audio, financial feeds — that stall matters.

Services like [Ably][ably-realtime], Pusher, and PubNub
handle this at the infrastructure level by maintaining
multiple connections across regions and using message
ordering at the application layer rather than relying solely
on TCP ordering. But the head-of-line blocking at the
protocol level is inherent to TCP, and therefore inherent to
WebSocket.

### WebTransport solves this

WebTransport uses QUIC, which runs over UDP. QUIC provides
independent streams — a lost packet on stream A does not
block streams B and C. If head-of-line blocking is a real
problem for your application (measure first, don't assume),
WebTransport is the better protocol choice.

The trade-off: WebTransport has limited browser support
compared to WebSocket. Chrome supports it. Firefox supports
it. Safari added support in 2025. But the ecosystem of
libraries, services, and documentation is years behind
WebSocket.

## When to use raw TCP instead

WebSocket exists because browsers need it. If your clients
are not browsers, you have more options.

**Server-to-server communication.** Two backend services
talking to each other do not need HTTP proxy traversal or
browser security. Raw TCP (or gRPC, which uses HTTP/2 over
TCP) removes the WebSocket framing overhead.

**Custom binary protocols.** Database wire protocols
(PostgreSQL, MySQL, Redis), message brokers (AMQP, MQTT
over TCP), and game servers define their own framing. Adding
WebSocket on top adds complexity without benefit.

**When you need UDP.** Multiplayer game state, voice/video
media streams, and DNS queries need UDP's fire-and-forget
semantics. WebSocket cannot provide this. Use raw UDP, QUIC,
or WebTransport depending on your client constraints.

**Maximum throughput.** If you are moving gigabytes between
servers and every microsecond matters, raw TCP avoids
WebSocket's per-frame masking and framing. In practice, this
matters only at extreme scale — the overhead is single-digit
microseconds per message.

## Why browsers block raw TCP

A question that comes up: "Why can't browsers just give me a
TCP socket?"

Because it would break the web security model. JavaScript
runs in a sandbox. If a script on `evil-site.com` could open
a TCP connection to `192.168.1.1:5432`, it could talk to your
internal PostgreSQL database. Or scan your local network. Or
connect to any service that assumes network-level access
control.

WebSocket prevents this through the HTTP handshake. The
server must explicitly accept the connection by responding
with `101 Switching Protocols` and validating the `Origin`
header. This puts the server in control of which origins can
connect — the same model as CORS for HTTP.

## WebSocket vs UDP

WebSocket and UDP are fundamentally different because
WebSocket sits on TCP:

| Property | WebSocket (TCP) | UDP |
| --- | --- | --- |
| **Delivery** | Guaranteed | Best-effort |
| **Ordering** | Guaranteed | None |
| **Connection** | Persistent, stateful | Connectionless |
| **Framing** | Built-in messages | Datagrams (you frame) |
| **Browser access** | Yes (WebSocket API) | No (WebTransport for QUIC) |
| **Head-of-line blocking** | Yes (TCP) | No |

If you need guaranteed delivery and ordering, WebSocket (via
TCP) gives you that for free. If you need low-latency
delivery where stale data is worse than missing data,
UDP-based protocols are the right choice.

## Frequently Asked Questions

### Does WebSocket use TCP or UDP?

TCP, exclusively. Every WebSocket connection is a TCP
connection with WebSocket framing on top. The confusion
comes from WebTransport, which uses QUIC (built on UDP).
WebSocket and WebTransport are separate protocols with
separate browser APIs. There is no UDP mode for WebSocket.

### Is WebSocket faster than TCP?

No. WebSocket runs on TCP, so it cannot be faster than
the transport underneath it. WebSocket is faster than
_HTTP_ for repeated messages because it eliminates
per-request headers. But compared to raw TCP, WebSocket
adds 2-14 bytes of framing overhead per message. The
difference is negligible for most applications.

### What does WebSocket add over raw TCP?

Four things: message framing (TCP is a byte stream with
no boundaries), an HTTP-compatible handshake (works
through proxies and firewalls), browser access via the
JavaScript WebSocket API, and a close handshake with
application-level status codes. See the
[protocol stack](#the-protocol-stack) section for the
full layer breakdown.

### When should I use raw TCP instead of WebSocket?

When you control both endpoints and do not need browser
compatibility or HTTP proxy traversal. Server-to-server
communication, custom binary protocols (database wire
formats, game protocols), and high-throughput data
pipelines are all cases where raw TCP or gRPC makes more
sense than WebSocket.

### What is head-of-line blocking in WebSocket?

A lost TCP packet blocks delivery of all subsequent
packets on that connection, even if they carry independent
messages. This is a TCP limitation that WebSocket
inherits. For most applications, retransmission takes
10-30ms and is barely noticeable. For latency-critical
systems, WebTransport over QUIC provides independent
streams that avoid this problem.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) — the
  browser API for creating and managing WebSocket connections
- [The Road to WebSockets](/guides/road-to-websockets/) — how
  WebSocket evolved from HTTP polling and long-polling
- [The WebSocket Protocol](/guides/websocket-protocol/) —
  deep dive into RFC 6455, framing, and the upgrade handshake
- [WebSockets at Scale](/guides/websockets-at-scale/) —
  running WebSocket infrastructure in production
- [The Future of WebSockets](/guides/future-of-websockets/)
  — WebTransport, HTTP/3, and what comes next

[ably-realtime]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=websocket-vs-tcp
