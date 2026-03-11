---
title: 'WebSocket Protocol: RFC 6455 Handshake, Frames & More'
description:
  'How the WebSocket protocol works under the hood: the opening handshake, data
  framing, masking, ping/pong, close codes, extensions, and security. Covers
  HTTP/1.1, HTTP/2, and HTTP/3.'
author: Matthew O'Riordan
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
seo:
  keywords:
    - websocket protocol
    - rfc 6455
    - websocket handshake
    - websocket frame format
    - websocket data framing
    - websocket extensions
    - websocket subprotocols
    - websocket security
    - wss protocol
    - websocket over http2
tags:
  - websocket
  - protocol
  - rfc6455
  - specification
  - handshake
  - framing
faq:
  - q: 'What is the WebSocket protocol?'
    a:
      'The WebSocket protocol (RFC 6455) provides full-duplex, bidirectional
      communication over a single TCP connection. It starts with an HTTP upgrade
      handshake, then switches to a lightweight framed messaging format that
      supports text, binary, and control frames.'
  - q: 'How does the WebSocket handshake work?'
    a:
      'The client sends an HTTP GET request with Upgrade: websocket and a random
      Sec-WebSocket-Key. The server responds with HTTP 101 Switching Protocols
      and a Sec-WebSocket-Accept hash derived from that key. After this
      exchange, both sides communicate using WebSocket frames instead of HTTP.'
  - q: 'What is the difference between ws and wss?'
    a:
      'ws:// is unencrypted WebSocket traffic (default port 80), while wss:// is
      WebSocket over TLS (default port 443). Always use wss:// in production to
      protect data in transit and avoid issues with proxies that block
      unencrypted WebSocket connections.'
  - q: 'Do WebSockets work over HTTP/2 and HTTP/3?'
    a:
      'Yes. RFC 8441 defines WebSocket bootstrapping over HTTP/2 using the
      Extended CONNECT method, enabling multiple WebSocket connections over a
      single TCP connection. RFC 9220 extends this to HTTP/3 and QUIC, adding
      benefits like zero head-of-line blocking and 0-RTT resumption.'
  - q: 'Why are WebSocket frames masked from client to server?'
    a:
      'Client-to-server masking uses a random 32-bit key XORed with the payload
      to prevent cache-poisoning attacks on intermediary proxies.
      Server-to-client frames are not masked because the attack vector only
      applies to client-originated traffic.'
---

:::note[Quick Answer]
The WebSocket protocol (RFC 6455) upgrades an HTTP
connection to a persistent, full-duplex channel. After a handshake, client and
server exchange lightweight frames - text, binary, or control - with minimal
overhead. It works over HTTP/1.1, HTTP/2, and HTTP/3.
:::

In December 2011, the Internet Engineering Task Force (IETF) standardized the
WebSocket protocol through [RFC 6455](https://tools.ietf.org/html/rfc6455). In
coordination with IETF, the Internet Assigned Numbers Authority (IANA) maintains
the
[WebSocket Protocol Registries](https://www.iana.org/assignments/websocket/websocket.xml),
which define many of the codes and parameter identifiers used by the protocol.

This article covers key considerations related to the
[WebSocket protocol](https://ably.com/topic/websockets), as described in
RFC 6455. You'll find out how to establish a WebSocket connection and exchange
messages, what kind of data can be sent over WebSockets, what types of
extensions and subprotocols you can use to augment WebSockets.

## Protocol overview

The WebSocket protocol enables ongoing, full-duplex, bidirectional communication
between web servers and web clients over an underlying TCP connection.

In a nutshell, the base WebSocket protocol consists of an opening handshake
(upgrading the connection from HTTP to WebSockets), followed by data transfer.
After the client and server successfully negotiate the opening handshake, the
WebSocket connection acts as a persistent full-duplex communication channel
where each side can, independently, send data at will. Clients and servers
transfer data back and forth in conceptual units referred to as messages, which,
as we describe shortly, can consist of one or more frames. Once the WebSocket
connection has served its purpose, it can be terminated via a closing handshake.

```text
        ┌──────────┐                    ┌──────────┐
        │  Client  │                    │  Server  │
        └────┬─────┘                    └────┬─────┘
             │                               │
             │      Initial HTTP             │
             │       handshake               │
             ├──────────────────────────────►│
             │◄──────────────────────────────┤
             │                               │
             │      WebSockets               │
             │      full-duplex              │
             │      persistent               │
             │◄─────────────────────────────►│
             │                               │
             │         Close                 │
             ├──────────────────────────────►│
             │◄──────────────────────────────┤
```

## URI schemes and syntax

The WebSocket protocol defines two URI schemes for traffic between server and
client:

- **ws**, used for unencrypted connections.
- **wss**, used for secure, encrypted connections over Transport Layer Security
  (TLS).

The WebSocket URI schemes are analogous to the HTTP ones; the wss scheme uses
the same security mechanism as https to secure connections, while ws corresponds
to http.

The rest of the WebSocket URI follows a generic syntax, similar to HTTP. It
consists of several components: host, port, path, and query, as highlighted in
the example below.

```text
wss://example.com:443/websocket/demo?foo=bar
└─┘   └──────────┘ └─┘ └────────────┘ └─────┘
 │         │        │        │           │
 │         │        │        │           └── Query
 │         │        │        └───────────── Path
 │         │        └────────────────────── Port
 │         └─────────────────────────────── Host
 └───────────────────────────────────────── Scheme
```

It's worth mentioning that:

- The port component is optional; the default is port 80 for ws, and port 443
  for wss.
- Fragment identifiers are not allowed in WebSocket URIs.
- The hash character (#) must be escaped as %23.

## Opening handshake

The process of establishing a WebSocket connection is known as the opening
handshake. While originally designed for HTTP/1.1, WebSockets can now be
established over HTTP/1.1, HTTP/2, and HTTP/3, each with different mechanisms.

### HTTP/1.1 Upgrade Handshake

The traditional WebSocket handshake consists of an HTTP/1.1 request/response
exchange between the client and the server. The client issues a WebSocket
handshake request, which is a specially formatted HTTP GET request. The server,
if it supports the WebSocket protocol and is willing to establish a connection
with the client, responds with a WebSocket handshake response.

```text
   ┌──────────┐                              ┌──────────┐
   │  Client  │                              │  Server  │
   └──────┬───┘                              └──────┬───┘
         │                                          │
         │  GET /chat HTTP/1.1                      │
         │  Host: example.com                       │
         │  Upgrade: websocket                      │
         │  Connection: Upgrade                     │
         │  Sec-WebSocket-Key: [base64]             │
         │  Sec-WebSocket-Version: 13               │
         ├─────────────────────────────────────────►│
         │                                          │
         │  HTTP/1.1 101 Switching Protocols        │
         │  Upgrade: websocket                      │
         │  Connection: Upgrade                     │
         │  Sec-WebSocket-Accept: [hash]            │
         │◄─────────────────────────────────────────┤
         │                                          │
         │       WebSocket Connection               │
         │◄────────────────────────────────────────►│
         │                                          │
```

### Client handshake request

A WebSocket handshake request is a specially formatted HTTP GET request. Here's
a sample client WebSocket handshake request:

```http
GET /chat HTTP/1.1
Host: example.com:8000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

The request includes the following headers:

- `Upgrade: websocket` - indicates that the client wants to upgrade the
  connection to use the WebSocket protocol.
- `Connection: Upgrade` - tells proxies or other intermediaries to also upgrade
  the connection.
- `Sec-WebSocket-Key` - a Base64-encoded random value that helps the server
  prove it's a WebSocket-capable server.
- `Sec-WebSocket-Version` - the version of the WebSocket protocol the client
  wishes to use.

In addition to these mandatory headers, the client might also include:

- `Sec-WebSocket-Protocol` - a list of subprotocols that the client wishes to
  speak, ordered by preference.
- `Sec-WebSocket-Extensions` - a list of extensions the client wishes to use.

### Server handshake response

If the server understands the WebSocket protocol and accepts the request to
upgrade, it sends back a HTTP response like this:

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

The response includes:

- `HTTP/1.1 101 Switching Protocols` - indicates the successful upgrade from
  HTTP to WebSocket.
- `Upgrade: websocket` - confirms the protocol upgrade.
- `Connection: Upgrade` - indicates that the connection has been upgraded.
- `Sec-WebSocket-Accept` - a value calculated from the client's
  Sec-WebSocket-Key, which helps verify that the server understood the WebSocket
  handshake request.

If the client requested a subprotocol, the server includes the
`Sec-WebSocket-Protocol` header with the name of the chosen subprotocol. If the
client requested extensions, the server may include the
`Sec-WebSocket-Extensions` header with the extensions it has agreed to use.

### HTTP/2 WebSocket Bootstrapping (RFC 8441)

[RFC 8441](https://datatracker.ietf.org/doc/html/rfc8441) introduces WebSocket
support over HTTP/2 using the Extended CONNECT method. This mechanism allows
WebSocket connections to be multiplexed over a single HTTP/2 connection.

#### Extended CONNECT Method

HTTP/2 uses a different approach than HTTP/1.1's Upgrade mechanism:

1. The server advertises support via `SETTINGS_ENABLE_CONNECT_PROTOCOL = 1`
2. The client sends an Extended CONNECT request with `:protocol = websocket`
3. The server responds with a 200 status if successful

```text
   ┌──────────┐                              ┌──────────┐
   │  Client  │                              │  Server  │
   └──────┬───┘                              └──────┬───┘
         │                                          │
         │  SETTINGS                                │
         │  SETTINGS_ENABLE_CONNECT_PROTOCOL = 1    │
         │◄─────────────────────────────────────────┤
         │                                          │
         │  HEADERS                                 │
         │  :method = CONNECT                       │
         │  :protocol = websocket                   │
         │  :scheme = https                         │
         │  :path = /chat                           │
         │  :authority = example.com                │
         │  sec-websocket-version = 13              │
         │  sec-websocket-key = [base64]            │
         ├─────────────────────────────────────────►│
         │                                          │
         │  HEADERS                                 │
         │  :status = 200                           │
         │  sec-websocket-accept = [hash]           │
         │◄─────────────────────────────────────────┤
         │                                          │
         │   WebSocket over HTTP/2 Stream           │
         │◄────────────────────────────────────────►│
         │                                          │
```

#### Implementation Example

```javascript
// Node.js with HTTP/2 support
const http2 = require('http2');

// Client-side HTTP/2 WebSocket connection
const client = http2.connect('https://example.com');
const req = client.request({
  ':method': 'CONNECT',
  ':protocol': 'websocket',
  ':path': '/chat',
  'sec-websocket-version': '13',
  'sec-websocket-key': generateKey(),
});
```

Key benefits of HTTP/2 WebSockets:

- **Stream multiplexing**: Multiple WebSocket connections over one TCP
  connection
- **Header compression**: Reduced overhead with HPACK
- **No HOL blocking between streams**: Each stream is independent
- **Better proxy traversal**: Works better with HTTP/2-aware proxies

### HTTP/3 WebSocket Bootstrapping (RFC 9220)

[RFC 9220](https://datatracker.ietf.org/doc/html/rfc9220) defines how WebSockets
work over HTTP/3 and QUIC, providing even better performance and reliability.

#### QUIC Transport Benefits

HTTP/3 WebSockets leverage QUIC's advantages:

```text
   ┌──────────┐                              ┌──────────┐
   │  Client  │                              │  Server  │
   └──────┬───┘                              └──────┬───┘
         │                                          │
         │  SETTINGS (QUIC)                         │
         │  SETTINGS_ENABLE_WEBTRANSPORT = 1        │
         │  SETTINGS_H3_DATAGRAM = 1                │
         │◄─────────────────────────────────────────┤
         │                                          │
         │  Extended CONNECT (Stream 4)             │
         │  :method = CONNECT                       │
         │  :protocol = websocket                   │
         │  :scheme = https                         │
         │  :path = /chat                           │
         │  :authority = example.com                │
         ├─────────────────────────────────────────►│
         │                                          │
         │  200 OK (Stream 4)                       │
         │  sec-websocket-accept = [hash]           │
         │◄─────────────────────────────────────────┤
         │                                          │
         │   WebSocket over QUIC Stream             │
         │◄────────────────────────────────────────►│
         │                                          │
```

#### Stream Independence

QUIC provides true stream independence, eliminating TCP head-of-line blocking:

```text
QUIC Connection (UDP)
├── Stream 0: Control Stream
├── Stream 4: WebSocket Connection 1
├── Stream 8: WebSocket Connection 2
└── Stream 12: WebSocket Connection 3

Each stream:
- Independent flow control
- No blocking between streams
- Parallel processing
- 0-RTT connection resumption
```

#### Connection Coalescing

HTTP/3 allows connection coalescing for WebSockets:

- Multiple origins can share one QUIC connection
- Reduced connection overhead
- Better resource utilization
- Faster establishment with 0-RTT

## Data framing

Once the WebSocket connection is established, the client and server can send
WebSocket data frames back and forth in either direction. Each message consists
of one or more frames. There are different types of frames:

- Text frames - contain UTF-8 encoded text data
- Binary frames - contain binary data
- Control frames - used for protocol-level signaling, such as pings, pongs, and
  close frames

### WebSocket frame structure - Deep Dive

The WebSocket frame structure is designed for efficiency and flexibility. Here's
a detailed breakdown:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - - +
:                     Payload Data continued ...                :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                     Payload Data continued ...                |
+---------------------------------------------------------------+
```

#### Frame Components Explained

#### FIN bit (1 bit)

- `1`: Final fragment in a message
- `0`: More fragments follow

#### RSV1, RSV2, RSV3 bits (1 bit each)

- Reserved for WebSocket extensions
- `RSV1`: Used by permessage-deflate compression extension
- `RSV2, RSV3`: Reserved for future use
- Must be 0 if no extension using them is negotiated

**Opcode (4 bits)** Defines the interpretation of the payload data:

| Opcode  | Meaning      | Description                        |
| ------- | ------------ | ---------------------------------- |
| 0x0     | Continuation | Continuation of fragmented message |
| 0x1     | Text         | UTF-8 text data                    |
| 0x2     | Binary       | Binary data                        |
| 0x3-0x7 | Reserved     | Reserved for future data frames    |
| 0x8     | Close        | Connection close                   |
| 0x9     | Ping         | Ping frame                         |
| 0xA     | Pong         | Pong frame                         |
| 0xB-0xF | Reserved     | Reserved for future control frames |

#### MASK bit (1 bit)

- `1`: Payload is masked (required for client-to-server)
- `0`: Payload is unmasked (server-to-client)

**Payload Length Encoding** The payload length is encoded in a variable-length
format:

- **0-125**: The payload length is the 7-bit value
- **126**: The following 16 bits are the payload length (max 65,535 bytes)
- **127**: The following 64 bits are the payload length (max 2^63-1 bytes)

```javascript
// Payload length encoding example
function encodePayloadLength(length) {
  if (length <= 125) {
    return [length];
  } else if (length <= 65535) {
    return [126, (length >> 8) & 0xff, length & 0xff];
  } else {
    // For lengths > 65535, use 64-bit encoding
    return [127 /* 8 bytes of length */];
  }
}
```

#### Masking Key (0 or 4 bytes)

- Present only if MASK bit is 1
- 32-bit random value used to XOR the payload
- Security measure to prevent cache poisoning attacks

#### Masking Algorithm

```javascript
// Masking/unmasking payload data
function maskPayload(payload, maskingKey) {
  const masked = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ maskingKey[i % 4];
  }
  return masked;
}
```

## Message fragmentation

WebSocket messages can be split into multiple frames, which can be useful for
sending large messages without having to buffer the entire message on the
sender's side. When a message is fragmented:

1. The first frame has an opcode indicating the message type (text or binary).
2. Following frames have an opcode of 0 (continuation frame).
3. The final frame has the FIN bit set to 1.

## Control frames

Control frames are used for protocol-level signaling within the WebSocket
connection. They are always unfragmented (FIN bit set to 1) and have a maximum
payload length of 125 bytes. The most common control frames are:

### Ping/Pong frames

Ping (opcode 0x9) and Pong (opcode 0xA) frames are used for checking that the
connection is still alive or for measuring latency. When a peer receives a Ping
frame, it must send back a Pong frame with the same payload as soon as possible.

### Close frames

Close frames (opcode 0x8) are used to initiate the closing handshake, which
indicates the beginning of the process to terminate the WebSocket connection.

## Closing handshake

The closing handshake is initiated when either the client or server sends a
close frame. The peer that receives the close frame should send back another
close frame in response. After sending a close frame, the peer should not send
any more data frames. After both sides have exchanged close frames, the TCP
connection is closed.

```text
   ┌──────────┐                              ┌──────────┐
   │  Client  │                              │  Server  │
   └──────┬───┘                              └──────┬───┘
         │                                          │
         │        WebSocket Connection              │
         │◄────────────────────────────────────────►│
         │                                          │
         │  Close Frame (opcode 0x8)                │
         │  Status Code: 1000                       │
         │  Reason: "Normal Closure"                │
         ├─────────────────────────────────────────►│
         │                                          │
         │  Close Frame (opcode 0x8)                │
         │  Status Code: 1000                       │
         │◄─────────────────────────────────────────┤
         │                                          │
         │        TCP Connection Closed             │
         X──────────────────────────────────────────X
```

A close frame may contain a status code and a reason for closing in its payload.
The status code is a 16-bit unsigned integer. Some of the most common status
codes are:

- 1000: Normal closure
- 1001: Going away
- 1002: Protocol error
- 1003: Unsupported data
- 1008: Policy violation
- 1011: Internal error

## Protocol extensions

The WebSocket protocol can be extended through the use of extensions. Extensions
allow for additional capabilities or modifications to the base WebSocket
protocol. Extensions are negotiated during the opening handshake.

### Compression Extension (RFC 7692) - Security Considerations

[RFC 7692](https://datatracker.ietf.org/doc/html/rfc7692) defines the
permessage-deflate extension for WebSocket compression. While compression can
significantly reduce bandwidth, it comes with important security implications.

#### How Compression Works

The permessage-deflate extension uses the DEFLATE algorithm to compress
messages:

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

Server response:

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=15
```

#### ⚠️ CRIME/BREACH Vulnerability Warnings

**CRITICAL SECURITY WARNING**: Compression can make your application vulnerable
to CRIME (Compression Ratio Info-leak Made Easy) and BREACH (Browser
Reconnaissance and Exfiltration via Adaptive Compression of Hypertext) attacks.

**How the Attack Works:**

1. Attacker injects controlled data alongside secret data
2. Observes compressed message sizes
3. Deduces secret content based on compression ratios

```javascript
// VULNERABLE: Mixing secrets with user input
const message = {
  authToken: secretToken, // Secret
  userMessage: userInput, // Attacker-controlled
};
ws.send(JSON.stringify(message)); // Compressed together = vulnerable
```

#### When to Disable Compression

Disable compression when:

- **Mixing secrets with user input** in the same message
- **Transmitting authentication tokens** or session IDs
- **Sending sensitive personal data** alongside public data
- **High-security applications** where timing attacks are a concern

```javascript
// Safe approach 1: Disable compression for sensitive data
const ws = new WebSocket('wss://example.com', {
  perMessageDeflate: false, // Disable compression entirely
});

// Safe approach 2: Separate sensitive and public data
ws.send(JSON.stringify({ type: 'auth', token: secretToken })); // No compression
ws.send(JSON.stringify({ type: 'message', data: publicData })); // Can compress
```

#### Safe Compression Patterns

**DO:**

- Compress only public, non-sensitive data
- Use separate connections for sensitive vs. public data
- Apply compression selectively per message type
- Rate-limit to prevent timing analysis

**DON'T:**

- Mix secrets with attacker-controlled data
- Compress authentication headers or tokens
- Use compression for small messages (overhead > benefit)
- Ignore compression ratios in logs

#### Implementation Example with Security

```javascript
class SecureWebSocket {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.compressionEnabled = true;
  }

  send(data, options = {}) {
    const { sensitive = false } = options;

    if (sensitive) {
      // Disable compression for sensitive data
      this.ws.send(data, { compress: false });
    } else {
      // Safe to compress public data
      this.ws.send(data, { compress: this.compressionEnabled });
    }
  }

  sendAuth(token) {
    // Never compress authentication data
    this.send(JSON.stringify({ auth: token }), { sensitive: true });
  }

  sendPublicMessage(message) {
    // Safe to compress public messages
    this.send(JSON.stringify({ message }), { sensitive: false });
  }
}
```

### Other Extensions

- **Multiplexing extension** - allows multiple logical WebSocket connections to
  be multiplexed over a single transport connection (experimental)
- **Custom extensions** - applications can define their own extensions using the
  RSV bits and extension negotiation mechanism

## Subprotocols

Subprotocols define the high-level semantics of the communication over
WebSockets. They are application-specific protocols layered on top of
WebSockets. Common subprotocols include:

- **MQTT over WebSockets** - for IoT and messaging applications.
- **STOMP over WebSockets** - for messaging applications.
- **JSON-RPC over WebSockets** - for remote procedure calls.

## Security considerations

When using WebSockets, consider the following security aspects:

- Always use the secure WebSocket protocol (wss://) for production applications.
- Validate all incoming messages on the server to protect against malicious
  input.
- Implement proper authentication and authorization.
- Be aware of potential cross-site WebSocket hijacking (CSWSH) attacks.
- Configure appropriate timeouts and resource limits to prevent
  denial-of-service attacks.

## Browser compatibility

Modern browsers widely support the WebSocket protocol, including:

- Chrome 4+
- Firefox 4+
- Safari 5+
- Edge 12+
- Internet Explorer 10+
- Opera 10.7+

For older browsers that don't support WebSockets, polyfill libraries like SockJS
or Socket.IO can provide fallback transport mechanisms.

## WebSocket implementations

There are many server and client implementations of the WebSocket protocol
across various programming languages. Some popular ones include:

- **JavaScript**: [ws](https://github.com/websockets/ws) (Node.js), native
  Browser
  [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- **Python**: [websockets](https://github.com/python-websockets/websockets),
  [autobahn](https://github.com/crossbario/autobahn-python)
- **Java**: [Tyrus](https://eclipse-ee4j.github.io/tyrus/),
  [Jetty](https://www.eclipse.org/jetty/)
- **C#**: [SignalR](https://dotnet.microsoft.com/apps/aspnet/signalr),
  [WebSocketSharp](https://github.com/sta/websocket-sharp)
- **Go**: [Gorilla WebSocket](https://github.com/gorilla/websocket)
- **Ruby**: [EventMachine WebSocket](https://github.com/igrigorik/em-websocket)
- **PHP**: [Ratchet](http://socketo.me/)

When choosing an implementation, consider factors like performance, feature
completeness, active maintenance, and community support.

## FAQ

### What is the WebSocket protocol?

The WebSocket protocol (RFC 6455) provides full-duplex, bidirectional
communication over a single TCP connection. It starts with an HTTP upgrade
handshake, then switches to a lightweight framed messaging format that supports
text, binary, and control frames.

### How does the WebSocket handshake work?

The client sends an HTTP GET request with `Upgrade: websocket` and a random
`Sec-WebSocket-Key`. The server responds with HTTP 101 Switching Protocols and a
`Sec-WebSocket-Accept` hash derived from that key. After this exchange, both
sides communicate using WebSocket frames instead of HTTP.

### What is the difference between ws and wss?

`ws://` is unencrypted WebSocket traffic (default port 80), while `wss://` is
WebSocket over TLS (default port 443). Always use `wss://` in production to
protect data in transit and avoid issues with proxies that block unencrypted
WebSocket connections.

### Do WebSockets work over HTTP/2 and HTTP/3?

Yes. RFC 8441 defines WebSocket bootstrapping over HTTP/2 using the Extended
CONNECT method, enabling multiple WebSocket connections over a single TCP
connection. RFC 9220 extends this to HTTP/3 and QUIC, adding benefits like zero
head-of-line blocking and 0-RTT resumption.

### Why are WebSocket frames masked from client to server?

Client-to-server masking uses a random 32-bit key XORed with the payload to
prevent cache-poisoning attacks on intermediary proxies. Server-to-client frames
are not masked because the attack vector only applies to client-originated
traffic.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) - Complete browser API
  for working with WebSockets
- [WebSocket Close Codes](/reference/close-codes/) - All close status codes
  explained
- [WebSocket Security Guide](/guides/security/) - Authentication, encryption,
  and common vulnerabilities
- [WebSockets vs SSE](/comparisons/sse/) - When to use WebSockets vs Server-Sent
  Events
- [Building a WebSocket App](/guides/building-a-websocket-app/) - Practical
  guide to building your first WebSocket application
