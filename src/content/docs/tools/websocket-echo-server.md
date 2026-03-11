---
title: 'Free WebSocket Echo Server: Test Connections at echo.websocket.org'
description:
  'Test WebSocket connections with our free echo server at echo.websocket.org.
  Supports WSS, SSE, and HTTP. Send any message and get it echoed back instantly
  for debugging.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: 2024-09-02T00:00:00.000Z
lastUpdated: 2026-03-10
category: tool
keywords:
  - websocket echo server
  - echo.websocket.org
  - websocket test server
  - websocket debugging tool
seo:
  keywords:
    - websocket echo server
    - echo.websocket.org
    - websocket test server
    - websocket debugging tool
    - free websocket endpoint
    - websocket connection test
faq:
  - q: 'What is a WebSocket echo server?'
    a:
      'A WebSocket echo server sends back every message it receives. It is used
      for testing WebSocket client implementations, proxy configurations, and
      connection debugging. The free server at echo.websocket.org supports WSS,
      SSE, and HTTP protocols.'
  - q: 'How do I test a WebSocket connection?'
    a:
      'Connect to wss://echo.websocket.org using any WebSocket client. Send a
      message and verify you receive it back. This confirms your client,
      network, and any proxies are correctly handling WebSocket traffic.'
  - q: 'Is echo.websocket.org free to use?'
    a:
      'Yes, echo.websocket.org is a free public testing endpoint sponsored by
      Ably. It supports WebSocket (WSS), Server-Sent Events, and HTTP echo.
      Messages are limited to 64KB and connections timeout after 10 minutes of
      inactivity.'
---

:::note[Quick Answer]
Connect to `wss://echo.websocket.org` to test your
WebSocket client. Every message you send is echoed back instantly. Free, public,
and supports WSS, SSE, and HTTP — no signup required.
:::

## Overview

The WebSocket Echo Server at [`echo.websocket.org`](https://echo.websocket.org)
is a free, publicly available testing endpoint that has become an essential tool
for developers working with real-time web technologies. This server provides
instant echo responses for WebSocket connections, Server-Sent Events (SSE), and
standard HTTP requests, making it invaluable for testing, debugging, and
validating real-time implementations.

Unlike production WebSocket servers that implement complex business logic, our
echo server provides a clean, predictable environment where every message sent
is immediately echoed back. This simplicity makes it perfect for isolating
connection issues, testing client libraries, validating proxy configurations,
and debugging protocol-level problems.

## Key Features

### Multi-Protocol Support

The echo server supports three primary protocols, each accessible through
different endpoints:

- **WebSocket Protocol**: Full-duplex communication at
  `wss://echo.websocket.org`
- **Server-Sent Events**: One-way streaming at
  [`https://echo.websocket.org/.sse`](https://echo.websocket.org/.sse)
- **HTTP Echo**: Standard HTTP request/response at any other path
- **Browser UI**: Interactive testing interface at
  [`https://echo.websocket.org/.ws`](https://echo.websocket.org/.ws)

### Testing Capabilities

Our echo server excels at several testing scenarios:

1. **Connection Testing**: Verify WebSocket handshake and connection
   establishment
2. **Message Round-Trip**: Test message sending and receiving with guaranteed
   echo
3. **Proxy Validation**: Confirm WebSocket traffic passes through corporate
   proxies
4. **Library Testing**: Validate WebSocket client library implementations
5. **Performance Testing**: Measure round-trip latency and throughput
6. **Protocol Debugging**: Inspect frames and connection behavior

## How to Use the Echo Server

### Quick WebSocket Test with JavaScript

Here's a simple example to test the WebSocket echo server from any browser
console:

```javascript
// Connect to the WebSocket echo server
const socket = new WebSocket('wss://echo.websocket.org');

// Connection opened
socket.addEventListener('open', (event) => {
  console.log('Connected to echo server');

  // Send a test message
  socket.send('Hello, WebSocket Echo Server!');

  // Send JSON data
  socket.send(
    JSON.stringify({
      type: 'test',
      timestamp: Date.now(),
      message: 'Testing echo functionality',
    })
  );
});

// Listen for echoed messages
socket.addEventListener('message', (event) => {
  console.log('Echoed back:', event.data);

  // Parse JSON if needed
  try {
    const data = JSON.parse(event.data);
    console.log('Received JSON:', data);
  } catch (e) {
    console.log('Received text:', event.data);
  }
});

// Handle errors
socket.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
});

// Connection closed
socket.addEventListener('close', (event) => {
  console.log('Disconnected from echo server');
  console.log('Close code:', event.code);
  console.log('Close reason:', event.reason);
});
```

### Testing with Command Line Tools

You can also test the echo server using command-line tools like `wscat`:

```bash
# Install wscat globally
npm install -g wscat

# Connect to the echo server
wscat -c wss://echo.websocket.org

# Type messages and see them echoed back
> Hello from wscat!
< Hello from wscat!
```

### Server-Sent Events Testing

For SSE testing, you can use this JavaScript example:

```javascript
// Create EventSource connection
const eventSource = new EventSource('https://echo.websocket.org/.sse');

// Listen for messages
eventSource.onmessage = (event) => {
  console.log('SSE message received:', event.data);
};

// Handle connection open
eventSource.onopen = () => {
  console.log('SSE connection established');
};

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('SSE connection closed');
  }
};
```

## Technical Specifications

### Connection Details

- **Protocol**: WebSocket Protocol Version 13 (RFC 6455)
- **Secure Connection**: TLS 1.2+ required for WSS
- **Maximum Message Size**: 64 KB per message
- **Timeout**: Connections timeout after 10 minutes of inactivity
- **Concurrent Connections**: Reasonable limits apply to prevent abuse

### Endpoint Behavior

The echo server implements these specific behaviors:

- **Immediate Echo**: Messages are echoed back with minimal latency
- **Message Preservation**: Binary and text messages maintain their type
- **No Message History**: Each connection is independent with no persistence
- **Clean Close**: Proper WebSocket close handshake on disconnection

## Frequently Asked Questions

### What is a WebSocket echo server?

A WebSocket echo server sends back every message it receives. It is used for
testing WebSocket client implementations, proxy configurations, and connection
debugging. The free server at echo.websocket.org supports WSS, SSE, and HTTP
protocols.

### How do I test a WebSocket connection?

Connect to `wss://echo.websocket.org` using any WebSocket client. Send a message
and verify you receive it back. This confirms your client, network, and any
proxies are correctly handling WebSocket traffic.

### Is echo.websocket.org free to use?

Yes, echo.websocket.org is a free public testing endpoint sponsored by Ably. It
supports WebSocket (WSS), Server-Sent Events, and HTTP echo. Messages are
limited to 64KB and connections timeout after 10 minutes of inactivity.

## Related Content

- [Building a WebSocket Application](/guides/building-a-websocket-app/) —
  hands-on tutorial with cursor sharing
- [WebSocket Libraries & Tools](/resources/websocket-resources/) — client and
  server implementations by language
- [JavaScript WebSocket Guide](/guides/languages/javascript/) — browser API and
  Node.js WebSocket patterns
- [WebSocket Security Guide](/guides/security/) — securing WebSocket connections
  with TLS and authentication
- [Autobahn TestSuite Guide](/guides/testing/autobahn/) — RFC 6455 protocol
  compliance testing

## Sponsored by Ably

This echo server is sponsored by [Ably](https://ably.com/?utm_source=websocket-org&utm_medium=echo-server), a realtime data
delivery platform that provides scalable, reliable and secure
[WebSocket infrastructure](https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=echo-server) for apps and
services.
