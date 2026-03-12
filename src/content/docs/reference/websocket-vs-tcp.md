---
title: 'WebSocket vs TCP: How WebSocket Runs on Top of TCP'
description: 'WebSocket runs on top of TCP — it is not an alternative. WebSocket adds message framing and browser compatibility to a TCP connection. It does not use UDP.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-12'
lastUpdated: 2026-03-12
category: reference
sidebar:
  order: 6
keywords:
  - websocket vs tcp
  - websocket tcp or udp
  - websocket tcp
  - websocket protocol layer
seo:
  keywords:
    - websocket vs tcp
    - websocket tcp or udp
    - websocket tcp
    - is websocket tcp
    - websocket raw tcp
    - websocket protocol stack
faq:
  - q: 'Does WebSocket use TCP or UDP?'
    a: 'WebSocket uses TCP. It starts as an HTTP request over TCP, then upgrades to a persistent WebSocket connection on the same TCP connection. WebSocket does not use UDP. WebTransport (a different protocol) uses QUIC over UDP.'
  - q: 'What is the difference between WebSocket and TCP?'
    a: 'TCP is a transport protocol that provides reliable byte streams. WebSocket is an application protocol that runs on top of TCP. WebSocket adds message framing, an HTTP-compatible handshake, and works through web proxies — things raw TCP does not provide.'
  - q: 'When should I use raw TCP instead of WebSocket?'
    a: 'Use raw TCP for custom binary protocols between non-browser clients where you need maximum control and minimum overhead. Use WebSocket when you need browser compatibility, HTTP proxy traversal, or when your clients connect through web infrastructure.'
---

:::note[Quick Answer]
WebSocket is **not** an alternative to TCP. It runs on top of TCP.
A WebSocket connection starts as an HTTP request over TCP, then
upgrades to a persistent, full-duplex channel — still on the same
TCP connection. WebSocket does not use UDP.
:::

## The protocol stack

WebSocket sits between your application and TCP. Here is the
full picture:

```text
┌─────────────────────────┐
│     Your Application    │
├─────────────────────────┤
│  WebSocket (RFC 6455)   │  ← framing, handshake
├─────────────────────────┤
│     HTTP (upgrade)      │  ← initial handshake only
├─────────────────────────┤
│     TLS (optional)      │  ← wss:// connections
├─────────────────────────┤
│          TCP            │  ← reliable, ordered delivery
├─────────────────────────┤
│          IP             │
└─────────────────────────┘
```

TCP provides a reliable byte stream — bytes arrive in order, and
lost packets are retransmitted. HTTP runs on TCP. WebSocket
starts as an HTTP request on that TCP connection, sends an
`Upgrade` header, and both sides switch to the WebSocket
protocol. The underlying TCP connection stays open.

## What WebSocket adds over raw TCP

TCP gives you a byte stream. WebSocket gives you messages. That
distinction matters more than it sounds.

**Message framing.** TCP has no concept of message boundaries. If
you send two 100-byte messages on a raw TCP socket, the receiver
might get one 200-byte chunk, or three chunks of 80, 70, and 50
bytes. You have to implement your own length-prefixing or
delimiter protocol to figure out where one message ends and the
next begins. WebSocket handles this for you — every `send()`
produces exactly one message event on the other side.

**HTTP-compatible handshake.** WebSocket's upgrade handshake
looks like a normal HTTP request. This means it works through
corporate proxies, CDNs, and load balancers that would block raw
TCP connections. For anything going through web infrastructure,
this is not optional.

**Browser access.** Browsers expose a WebSocket API. They do not
expose raw TCP sockets, and for good reason — letting arbitrary
JavaScript open TCP connections to any host would be a security
disaster. WebSocket's origin-based security model makes
browser-to-server communication safe.

**Built-in close handshake.** WebSocket defines a clean shutdown
sequence with status codes. Raw TCP has `FIN` and `RST`, but no
application-level semantics — you cannot tell the other side
_why_ you are disconnecting.

## WebSocket is not UDP

This comes up frequently, so let's be explicit: **WebSocket uses
TCP, not UDP.** The confusion usually comes from WebTransport,
which is a different protocol entirely. WebTransport uses QUIC,
and QUIC runs over UDP. But WebSocket and WebTransport are
separate protocols with different APIs and different browser
support.

Why does WebSocket use TCP and not UDP? Because WebSocket needs
reliable, ordered delivery. If a message is lost in transit, TCP
retransmits it. If packets arrive out of order, TCP reorders
them. With UDP, you would have to build all of that yourself.
WebSocket's design assumes the transport handles reliability, and
TCP does exactly that.

If you genuinely need unreliable or unordered delivery — say, for
a fast-paced multiplayer game where a stale position update is
worse than a missing one — WebSocket is not the right tool. Look
at WebTransport, or use raw UDP from a native client.

## When to use which

**Use WebSocket when:**

- Your clients are browsers. You have no other choice for
  persistent bidirectional connections from a browser (apart from
  WebTransport, which has limited support).
- Traffic passes through HTTP infrastructure — proxies, CDNs,
  load balancers. WebSocket's HTTP upgrade handshake gets through
  where raw TCP gets blocked.
- You want message-level framing without building your own wire
  protocol.

**Use raw TCP when:**

- You are building a custom binary protocol between servers or
  native clients where you control both ends.
- You need absolute minimum overhead and cannot afford even
  WebSocket's 2–6 byte frame header.
- You are building game servers, database protocols, or other
  systems where the wire format is already defined and does not
  need HTTP compatibility.

**Use WebTransport when:**

- You need unreliable or unordered delivery (datagrams).
- You want multiplexed streams without head-of-line blocking.
- Your clients support it (browser support is still limited as
  of early 2026).

## Frequently asked questions

### Does WebSocket use TCP or UDP?

TCP — exclusively. There is no UDP variant of WebSocket.
The confusion usually comes from WebTransport, which uses
QUIC (built on UDP) and has a completely separate browser
API. If you need unreliable or unordered delivery, look at
WebTransport, not WebSocket.

### What is the difference between WebSocket and TCP?

Different layers. TCP gives you a reliable byte stream with
no concept of messages — you must implement your own
framing. WebSocket gives you discrete messages, an HTTP
Upgrade handshake that traverses proxies, browser access
via a JavaScript API, and application-level close codes.
See the [protocol stack](#the-protocol-stack) and
[what WebSocket adds](#what-websocket-adds-over-raw-tcp)
sections above for the full breakdown.

### When should I use raw TCP instead of WebSocket?

When you control both ends, don't need HTTP compatibility,
and have a custom wire format already defined — database
protocols, inter-service messaging, game servers with
custom serialization. If any client is a browser, use
WebSocket. Browsers cannot open raw TCP connections.

## Related content

- [WebSocket API reference](/reference/websocket-api/) — the
  browser API for working with WebSocket connections
- [The road to WebSockets](/guides/road-to-websockets/) — how
  WebSocket evolved from HTTP polling and long-polling
- [The WebSocket protocol](/guides/websocket-protocol/) — deep
  dive into RFC 6455, framing, and the upgrade handshake
- [WebSockets at scale](/guides/websockets-at-scale/) — running
  WebSocket infrastructure in production
- [The future of WebSockets](/guides/future-of-websockets/) —
  WebTransport, HTTP/3, and what comes next
