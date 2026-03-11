---
title: 'WebSocket API: Events, Methods & Properties'
description:
  'Browser WebSocket API reference with code examples: constructor, onopen,
  onmessage, onclose, onerror, send(), close(), readyState, bufferedAmount, and
  binary types.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2025-08-31T00:00:00.000Z
lastUpdated: 2026-03-10
category: reference
tags:
  - websocket
  - api
  - javascript
  - real-time
  - browser
seo:
  keywords:
    - websocket api
    - websocket javascript
    - websocket events
    - websocket onmessage
    - websocket onopen
    - websocket send
    - websocket close
    - websocket readystate
    - new websocket
    - websocket constructor
  canonical: https://websocket.org/reference/websocket-api
faq:
  - q: 'How do I create a WebSocket connection in JavaScript?'
    a:
      'Use the WebSocket constructor: const ws = new
      WebSocket("wss://example.com"). The single required argument is the URL.
      An optional second argument accepts one or more subprotocol strings. The
      connection attempt begins immediately on construction.'
  - q: 'What are the WebSocket readyState values?'
    a:
      'There are four readyState values: 0 (CONNECTING) means the connection is
      not yet open, 1 (OPEN) means it is ready to send and receive, 2 (CLOSING)
      means close() has been called, and 3 (CLOSED) means the connection is
      closed or could not be opened.'
  - q: 'How do I send binary data over a WebSocket?'
    a:
      'Set ws.binaryType to "arraybuffer" or "blob" before receiving, then call
      ws.send() with an ArrayBuffer, Blob, or typed array (like Uint8Array). The
      browser handles framing automatically. Check ws.bufferedAmount to monitor
      the send queue.'
  - q:
      'What is the difference between onmessage and addEventListener for
      WebSockets?'
    a:
      'onmessage sets a single handler that replaces any previous one.
      addEventListener("message", fn) can attach multiple listeners. Use
      addEventListener when you need multiple independent handlers or want to
      use removeEventListener for cleanup.'
  - q: 'How do I handle WebSocket reconnection?'
    a:
      'The browser WebSocket API has no built-in reconnection. Implement it
      yourself in the onclose handler using exponential backoff: start with a
      short delay (e.g., 1 second), double it on each retry, and cap at a
      maximum (e.g., 30 seconds). Libraries like reconnecting-websocket automate
      this.'
---

:::note[Quick Answer]
The browser WebSocket API lets you open a persistent
connection with `new WebSocket(url)`, send data with `ws.send()`, receive
messages via `ws.onmessage`, and close with `ws.close()`. It supports text and
binary data, has four readyState values (CONNECTING, OPEN, CLOSING, CLOSED), and
works in all modern browsers.
:::

## Quick Reference

### Creating a Connection

```javascript
const socket = new WebSocket('wss://echo.websocket.org');
```

### Essential Events

```javascript
socket.onopen = (event) => {
  /* Connection established */
};
socket.onmessage = (event) => {
  /* Message received */
};
socket.onerror = (event) => {
  /* Error occurred */
};
socket.onclose = (event) => {
  /* Connection closed */
};
```

### Sending Data

```javascript
socket.send('Hello server!'); // Text
socket.send(binaryData.buffer); // Binary
```

### Closing Connection

```javascript
socket.close(1000, 'Normal closure');
```

---

## The WebSocket API Overview

The [WebSocket API][ably-websockets] is an advanced technology
that enables persistent, bidirectional, full-duplex communication channels
between web clients and servers. Unlike traditional HTTP requests, WebSocket
connections remain open, allowing for real-time data exchange without the
overhead of HTTP polling.

### Key Benefits

- **Full-duplex communication**: Both client and server can send messages
  independently
- **Low latency**: No HTTP overhead for each message
- **Persistent connection**: Maintains state between messages
- **Event-driven**: Asynchronous, non-blocking communication model
- **Binary and text support**: Efficient transmission of different data types

## The WebSocket Interface

The WebSocket interface is the primary API for connecting to a WebSocket server
and exchanging data. It follows an asynchronous, event-driven programming model
where events are fired as the connection state changes and data is received.

### Constructor

```javascript
const socket = new WebSocket(url[, protocols]);
```

#### Parameters

- **`url`** (required): The WebSocket server URL
  - Must use `ws://` for unencrypted or `wss://` for encrypted connections
  - Can include path and query parameters
- **`protocols`** (optional): Subprotocol selection
  - Single string or array of strings
  - Server selects one from the provided list
  - Useful for versioning or feature negotiation

#### Examples

```javascript
// Basic connection to secure WebSocket server
const socket = new WebSocket('wss://echo.websocket.org');

// Connection with path and query parameters
const socket = new WebSocket('wss://api.example.com/v2/stream?token=abc123');

// Connection with single subprotocol
const socket = new WebSocket('wss://game.example.com', 'game-protocol-v2');

// Connection with multiple subprotocol options
const socket = new WebSocket('wss://chat.example.com', ['chat-v2', 'chat-v1']);
```

## Connection States

The WebSocket connection progresses through several states during its lifecycle:

| State      | Value | Constant               | Description                            |
| ---------- | ----- | ---------------------- | -------------------------------------- |
| CONNECTING | 0     | `WebSocket.CONNECTING` | Connection not yet established         |
| OPEN       | 1     | `WebSocket.OPEN`       | Connection established and ready       |
| CLOSING    | 2     | `WebSocket.CLOSING`    | Connection closing handshake initiated |
| CLOSED     | 3     | `WebSocket.CLOSED`     | Connection closed or failed            |

### Checking Connection State

```javascript
function sendMessage(socket, data) {
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      // Queue message for when connection opens
      console.log('Still connecting...');
      break;
    case WebSocket.OPEN:
      // Safe to send
      socket.send(data);
      break;
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      // Connection unavailable
      console.log('Connection is closed');
      break;
  }
}
```

## Properties

### Read-Only Properties

#### `url`

Returns the absolute URL of the WebSocket connection.

```javascript
console.log(socket.url); // "wss://echo.websocket.org/"
```

#### `protocol`

Returns the selected subprotocol, if any.

```javascript
console.log(socket.protocol); // "chat-v2" or empty string
```

#### `readyState`

Returns the current connection state (0-3).

```javascript
if (socket.readyState === WebSocket.OPEN) {
  socket.send('Ready to communicate!');
}
```

#### `bufferedAmount`

Returns bytes queued but not yet transmitted. Useful for backpressure handling.

```javascript
if (socket.bufferedAmount > 1024 * 1024) {
  // 1MB threshold
  // Too much data queued, pause sending
  console.warn('Buffer full, pausing sends');
}
```

#### `extensions`

Returns negotiated extensions (e.g., compression).

```javascript
console.log(socket.extensions); // "permessage-deflate; client_max_window_bits"
```

### Configurable Properties

#### `binaryType`

Controls how binary data is exposed to JavaScript.

```javascript
socket.binaryType = 'arraybuffer'; // Default, recommended
// or
socket.binaryType = 'blob'; // For file-like data
```

## Methods

### `send(data)`

Transmits data to the server. Queues data if connection is still opening.

#### Parameters

- **`data`**: String, ArrayBuffer, Blob, or ArrayBufferView

#### Examples

```javascript
// Text message
socket.send('Hello, server!');

// JSON message
socket.send(JSON.stringify({ type: 'chat', message: 'Hi!' }));

// Binary data
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
view.setInt32(0, 42);
socket.send(buffer);

// Typed array
const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
socket.send(bytes);
```

### `close([code][, reason])`

Initiates the closing handshake or closes the connection.

#### Parameters

- **`code`** (optional): Status code (default: 1000)
- **`reason`** (optional): Human-readable close reason (max 123 bytes UTF-8)

#### Examples

```javascript
// Normal closure
socket.close();

// With code and reason
socket.close(1000, 'Work complete');

// Custom application code (4000-4999 range)
socket.close(4001, 'Idle timeout');
```

## Events

WebSocket programming follows an asynchronous, event-driven model. Events can be
handled using `onevent` properties or `addEventListener()`.

### Event Types

The WebSocket API supports four event types:

- **`open`**: Connection established
- **`message`**: Data received from server
- **`error`**: Error occurred (connection failures, protocol errors)
- **`close`**: Connection closed

**Important Note**: In JavaScript, WebSocket events can be handled using
"onevent" properties (like `onopen`) or using `addEventListener()`. Either
approach works, but `addEventListener()` allows multiple handlers for the same
event.

### `open` Event

Fired when the WebSocket connection is successfully established.

```javascript
// Using onevent property
socket.onopen = function (event) {
  console.log('Connected to server');
  console.log('Protocol:', socket.protocol);
  console.log('Extensions:', socket.extensions);

  // Connection is ready, safe to send
  socket.send('Hello, server!');
};

// Using addEventListener (allows multiple handlers)
socket.addEventListener('open', function (event) {
  console.log('WebSocket ready state:', socket.readyState); // Will be 1 (OPEN)
});
```

### `message` Event

Fired when data is received from the server. The `event.data` contains the
message payload.

```javascript
socket.onmessage = function (event) {
  // Check data type
  if (typeof event.data === 'string') {
    // Text message
    console.log('Text message:', event.data);

    // Parse JSON if expected
    try {
      const json = JSON.parse(event.data);
      processMessage(json);
    } catch (e) {
      processText(event.data);
    }
  } else if (event.data instanceof ArrayBuffer) {
    // Binary message (when binaryType = 'arraybuffer')
    const view = new DataView(event.data);
    console.log('Binary message, first byte:', view.getUint8(0));
  } else if (event.data instanceof Blob) {
    // Binary message (when binaryType = 'blob')
    event.data.arrayBuffer().then((buffer) => {
      processArrayBuffer(buffer);
    });
  }
};
```

### `error` Event

Fired when an error occurs. Note that the error event doesn't provide detailed
error information for security reasons.

```javascript
socket.onerror = function (event) {
  console.error('WebSocket error observed');
  // The error event doesn't contain details about what went wrong
  // Check readyState and wait for close event for more information
};

// Errors typically result in connection closure
socket.addEventListener('error', function (event) {
  console.log('Connection will close due to error');
});
```

**Important**: The error event is always followed shortly by a close event,
which provides more information through the close code and reason.

### `close` Event

Fired when the connection is closed. The event contains valuable debugging
information.

```javascript
socket.onclose = function (event) {
  console.log('Connection closed');
  console.log('Code:', event.code);
  console.log('Reason:', event.reason);
  console.log('Was clean?', event.wasClean);

  // Handle different close scenarios
  if (event.code === 1000) {
    console.log('Normal closure');
  } else if (event.code === 1006) {
    console.log('Abnormal closure, no close frame');
  } else if (event.code >= 4000 && event.code <= 4999) {
    console.log('Application-specific close code:', event.code);
  }

  // Implement reconnection logic if needed
  if (!event.wasClean) {
    setTimeout(() => reconnect(), 5000);
  }
};
```

## Practical Usage Patterns

### Reconnection Strategy

Implementing automatic reconnection with exponential backoff:

```javascript
class ReconnectingWebSocket {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = null; // Infinite
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url, this.protocols);

    this.ws.onopen = (event) => {
      console.log('Connected');
      this.reconnectDelay = 1000; // Reset delay on successful connection
      this.reconnectAttempts = 0;
      this.onopen?.(event);
    };

    this.ws.onmessage = (event) => {
      this.onmessage?.(event);
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error');
      this.onerror?.(event);
    };

    this.ws.onclose = (event) => {
      console.log(`Connection closed: ${event.code} - ${event.reason}`);
      this.onclose?.(event);

      // Attempt reconnection for abnormal closures
      if (!event.wasClean && this.shouldReconnect()) {
        setTimeout(() => {
          console.log(
            `Reconnecting... (attempt ${this.reconnectAttempts + 1})`
          );
          this.reconnectAttempts++;
          this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            this.maxReconnectDelay
          );
          this.connect();
        }, this.reconnectDelay);
      }
    };
  }

  shouldReconnect() {
    return (
      this.maxReconnectAttempts === null ||
      this.reconnectAttempts < this.maxReconnectAttempts
    );
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocket not open. Current state:', this.ws.readyState);
    }
  }

  close(code = 1000, reason = '') {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws.close(code, reason);
  }
}

// Usage
const socket = new ReconnectingWebSocket('wss://echo.websocket.org');
socket.onmessage = (event) => console.log('Received:', event.data);
```

### Heartbeat/Ping-Pong Pattern

Keep connections alive and detect stale connections:

```javascript
class HeartbeatWebSocket {
  constructor(url) {
    this.url = url;
    this.pingInterval = 30000; // 30 seconds
    this.pongTimeout = 10000; // 10 seconds to respond
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected, starting heartbeat');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      // Reset heartbeat on any message
      this.startHeartbeat();

      // Check for pong response
      if (event.data === 'pong') {
        console.log('Received pong');
        return;
      }

      // Handle regular messages
      this.onmessage?.(event);
    };

    this.ws.onclose = () => {
      console.log('Connection closed');
      this.stopHeartbeat();
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();

    this.pingTimer = setTimeout(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        console.log('Sending ping');
        this.ws.send('ping');

        // Expect pong within timeout
        this.pongTimer = setTimeout(() => {
          console.warn('Pong timeout, closing connection');
          this.ws.close(4000, 'Ping timeout');
        }, this.pongTimeout);
      }
    }, this.pingInterval);
  }

  stopHeartbeat() {
    clearTimeout(this.pingTimer);
    clearTimeout(this.pongTimer);
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      this.startHeartbeat(); // Reset heartbeat on send
    }
  }

  close() {
    this.stopHeartbeat();
    this.ws.close();
  }
}
```

### Error Handling Best Practices

Comprehensive error handling and recovery:

```javascript
class RobustWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      ...options,
    };

    this.messageQueue = [];
    this.isReconnecting = false;
    this.connectionAttempts = 0;

    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = (event) => {
      console.log('Connection established');
      this.connectionAttempts = 0;
      this.isReconnecting = false;

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.send(message);
      }

      this.onopen?.(event);
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        // Attempt to parse JSON messages
        if (
          typeof event.data === 'string' &&
          (event.data.startsWith('{') || event.data.startsWith('['))
        ) {
          const parsed = JSON.parse(event.data);
          this.onmessage?.({ ...event, parsedData: parsed });
        } else {
          this.onmessage?.(event);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        this.onerror?.({ type: 'message_processing', error, data: event.data });
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error occurred');
      this.onerror?.(event);
    };

    this.ws.onclose = (event) => {
      console.log(`Connection closed: ${event.code} - ${event.reason}`);
      this.stopHeartbeat();

      // Determine if we should reconnect
      if (this.shouldReconnect(event)) {
        this.scheduleReconnect();
      } else {
        this.onclose?.(event);
      }
    };
  }

  shouldReconnect(closeEvent) {
    // Don't reconnect for normal closure
    if (closeEvent.code === 1000) return false;

    // Don't reconnect if max attempts reached
    if (this.connectionAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return false;
    }

    // Don't reconnect for certain error codes
    const noReconnectCodes = [
      1002, 1003, 1005, 1006, 1007, 1008, 1009, 1010, 1011,
    ];
    if (noReconnectCodes.includes(closeEvent.code)) {
      console.error(`Not reconnecting due to close code: ${closeEvent.code}`);
      return false;
    }

    return true;
  }

  scheduleReconnect() {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.connectionAttempts++;

    const delay =
      this.options.reconnectInterval * Math.pow(2, this.connectionAttempts - 1);
    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.connectionAttempts})`
    );

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, delay);
  }

  send(data) {
    // Convert objects to JSON
    const message = typeof data === 'object' ? JSON.stringify(data) : data;

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
        return true;
      } catch (error) {
        console.error('Send failed:', error);
        this.queueMessage(message);
        return false;
      }
    } else {
      // Queue message if not connected
      this.queueMessage(message);
      return false;
    }
  }

  queueMessage(message) {
    if (this.messageQueue.length >= this.options.messageQueueSize) {
      console.warn('Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, this.options.heartbeatInterval);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
  }

  close(code = 1000, reason = 'Normal closure') {
    this.stopHeartbeat();
    this.messageQueue = [];
    this.options.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws.close(code, reason);
  }

  getState() {
    return {
      readyState: this.ws?.readyState,
      isReconnecting: this.isReconnecting,
      queuedMessages: this.messageQueue.length,
      connectionAttempts: this.connectionAttempts,
    };
  }
}

// Usage
const socket = new RobustWebSocket('wss://echo.websocket.org', {
  maxReconnectAttempts: 10,
  reconnectInterval: 2000,
  heartbeatInterval: 45000,
});

socket.onmessage = (event) => {
  if (event.parsedData) {
    console.log('Received JSON:', event.parsedData);
  } else {
    console.log('Received:', event.data);
  }
};

socket.onerror = (error) => {
  console.error('Socket error:', error);
};
```

## Common Use Cases

### Chat Application

```javascript
class ChatWebSocket {
  constructor(url, username) {
    this.username = username;
    this.ws = new WebSocket(url);
    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onopen = () => {
      this.send({
        type: 'join',
        username: this.username,
        timestamp: Date.now(),
      });
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'chat':
        this.onChatMessage?.(message);
        break;
      case 'user_joined':
        this.onUserJoined?.(message);
        break;
      case 'user_left':
        this.onUserLeft?.(message);
        break;
      case 'typing':
        this.onTyping?.(message);
        break;
    }
  }

  sendChat(text) {
    this.send({
      type: 'chat',
      text,
      username: this.username,
      timestamp: Date.now(),
    });
  }

  sendTyping() {
    this.send({
      type: 'typing',
      username: this.username,
    });
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

### Live Data Streaming

```javascript
class DataStreamWebSocket {
  constructor(url, symbols) {
    this.url = url;
    this.symbols = symbols;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      // Subscribe to data streams
      this.ws.send(
        JSON.stringify({
          action: 'subscribe',
          symbols: this.symbols,
        })
      );
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle different data types
      if (data.type === 'price_update') {
        this.onPriceUpdate?.(data);
      } else if (data.type === 'volume_update') {
        this.onVolumeUpdate?.(data);
      }
    };

    this.ws.onerror = () => {
      console.error('Stream error, reconnecting...');
      setTimeout(() => this.connect(), 5000);
    };
  }

  addSymbol(symbol) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'subscribe',
          symbols: [symbol],
        })
      );
      this.symbols.push(symbol);
    }
  }

  removeSymbol(symbol) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          symbols: [symbol],
        })
      );
      this.symbols = this.symbols.filter((s) => s !== symbol);
    }
  }
}

// Usage
const stream = new DataStreamWebSocket('wss://stream.example.com', [
  'AAPL',
  'GOOGL',
]);
stream.onPriceUpdate = (data) => {
  console.log(`${data.symbol}: $${data.price}`);
};
```

### Gaming and Real-time Collaboration

```javascript
class GameWebSocket {
  constructor(url, playerId) {
    this.playerId = playerId;
    this.ws = new WebSocket(url);
    this.latency = 0;
    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onopen = () => {
      // Join game
      this.send({
        type: 'join',
        playerId: this.playerId,
      });

      // Start latency monitoring
      this.measureLatency();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle ping response for latency measurement
      if (message.type === 'pong') {
        this.latency = Date.now() - message.timestamp;
        return;
      }

      // Handle game events
      this.handleGameEvent(message);
    };
  }

  handleGameEvent(event) {
    switch (event.type) {
      case 'player_move':
        this.onPlayerMove?.(event);
        break;
      case 'game_state':
        this.onGameState?.(event);
        break;
      case 'player_action':
        this.onPlayerAction?.(event);
        break;
    }
  }

  sendMove(x, y) {
    this.send({
      type: 'move',
      playerId: this.playerId,
      x,
      y,
      timestamp: Date.now(),
    });
  }

  sendAction(action, data) {
    this.send({
      type: 'action',
      playerId: this.playerId,
      action,
      data,
      timestamp: Date.now(),
    });
  }

  measureLatency() {
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, 5000);
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  getLatency() {
    return this.latency;
  }
}
```

## Performance Considerations

### Message Size and Frequency

- **Keep messages small**: Large messages increase latency and memory usage
- **Batch when possible**: Combine multiple small updates into single messages
- **Use binary for large data**: More efficient than base64-encoded text
- **Implement rate limiting**: Prevent overwhelming server or network

### Buffer Management

```javascript
class BufferedWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.maxBufferSize = options.maxBufferSize || 1024 * 1024; // 1MB default
    this.flushInterval = options.flushInterval || 100; // 100ms default
    this.buffer = [];
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.startFlushing();
    this.ws.onclose = () => this.stopFlushing();
  }

  send(data) {
    // Check WebSocket buffer
    if (this.ws.bufferedAmount > this.maxBufferSize) {
      console.warn('WebSocket buffer full, dropping message');
      return false;
    }

    // Add to internal buffer
    this.buffer.push(data);

    // Flush immediately if buffer is large
    if (JSON.stringify(this.buffer).length > this.maxBufferSize / 2) {
      this.flush();
    }

    return true;
  }

  flush() {
    if (this.buffer.length === 0) return;
    if (this.ws.readyState !== WebSocket.OPEN) return;

    // Send batched message
    this.ws.send(
      JSON.stringify({
        type: 'batch',
        messages: this.buffer,
        timestamp: Date.now(),
      })
    );

    this.buffer = [];
  }

  startFlushing() {
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }

  stopFlushing() {
    clearInterval(this.flushTimer);
  }
}
```

### Connection Pooling

```javascript
class WebSocketPool {
  constructor(url, poolSize = 3) {
    this.url = url;
    this.poolSize = poolSize;
    this.connections = [];
    this.currentIndex = 0;

    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const ws = new WebSocket(this.url);
      ws.onopen = () => console.log(`Pool connection ${i} ready`);
      this.connections.push(ws);
    }
  }

  getConnection() {
    // Round-robin selection
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.poolSize;
    return connection;
  }

  send(data) {
    const ws = this.getConnection();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      return true;
    }
    return false;
  }

  broadcast(data) {
    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  close() {
    this.connections.forEach((ws) => ws.close());
  }
}
```

## TypeScript Support

### Type Definitions

TypeScript includes built-in type definitions for the WebSocket API:

```typescript
// WebSocket constructor
const socket: WebSocket = new WebSocket(url: string | URL, protocols?: string | string[]);

// WebSocket properties
const state: number = socket.readyState;
const url: string = socket.url;
const protocol: string = socket.protocol;
const bufferedAmount: number = socket.bufferedAmount;
const binaryType: BinaryType = socket.binaryType; // 'blob' | 'arraybuffer'
const extensions: string = socket.extensions;

// WebSocket methods
socket.send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
socket.close(code?: number, reason?: string): void;

// WebSocket events
socket.onopen = (event: Event) => void;
socket.onmessage = (event: MessageEvent) => void;
socket.onerror = (event: Event) => void;
socket.onclose = (event: CloseEvent) => void;
```

### Typed Message Interfaces

Define custom types for your WebSocket messages:

```typescript
// Define message types
interface ChatMessage {
  type: 'chat';
  username: string;
  text: string;
  timestamp: number;
}

interface UserJoinedMessage {
  type: 'user_joined';
  username: string;
  timestamp: number;
}

interface UserLeftMessage {
  type: 'user_left';
  username: string;
  timestamp: number;
}

type WebSocketMessage = ChatMessage | UserJoinedMessage | UserLeftMessage;

// Type guard functions
function isChatMessage(msg: WebSocketMessage): msg is ChatMessage {
  return msg.type === 'chat';
}

function isUserJoinedMessage(msg: WebSocketMessage): msg is UserJoinedMessage {
  return msg.type === 'user_joined';
}

// Usage with type safety
socket.onmessage = (event: MessageEvent) => {
  const message: WebSocketMessage = JSON.parse(event.data);

  if (isChatMessage(message)) {
    console.log(`${message.username}: ${message.text}`);
  } else if (isUserJoinedMessage(message)) {
    console.log(`${message.username} joined the chat`);
  }
};
```

### Typed WebSocket Wrapper Class

Create a fully typed WebSocket wrapper with generics:

```typescript
interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketEvents<T> {
  onOpen?: (event: Event) => void;
  onMessage?: (data: T) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

class TypedWebSocket<TSend, TReceive> {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private events: WebSocketEvents<TReceive> = {};
  private reconnectAttempts = 0;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      protocols: undefined,
      ...config,
    };
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event: Event) => {
      this.reconnectAttempts = 0;
      this.events.onOpen?.(event);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: TReceive = JSON.parse(event.data);
        this.events.onMessage?.(data);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.ws.onerror = (event: Event) => {
      this.events.onError?.(event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.events.onClose?.(event);
      if (this.config.reconnect && !event.wasClean) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => this.connect(), this.config.reconnectInterval);
  }

  public send(data: TSend): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not open');
    }
  }

  public close(code?: number, reason?: string): void {
    this.config.reconnect = false;
    this.ws?.close(code, reason);
  }

  public on<K extends keyof WebSocketEvents<TReceive>>(
    event: K,
    handler: WebSocketEvents<TReceive>[K]
  ): void {
    this.events[event] = handler;
  }

  public get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  public get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Usage with type safety
interface ClientMessage {
  action: 'subscribe' | 'unsubscribe';
  channel: string;
}

interface ServerMessage {
  type: 'update' | 'error';
  data: any;
  timestamp: number;
}

const typedSocket = new TypedWebSocket<ClientMessage, ServerMessage>({
  url: 'wss://api.example.com',
  reconnect: true,
  maxReconnectAttempts: 10,
});

typedSocket.on('onMessage', (message) => {
  // message is typed as ServerMessage
  if (message.type === 'update') {
    console.log('Update received:', message.data);
  }
});

// Send is type-safe
typedSocket.send({
  action: 'subscribe',
  channel: 'news',
});
```

### Enum-based State Management

Using TypeScript enums for better state management:

```typescript
enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

enum CloseCode {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  NO_STATUS_RECEIVED = 1005,
  ABNORMAL_CLOSURE = 1006,
  INVALID_FRAME_PAYLOAD = 1007,
  POLICY_VIOLATION = 1008,
  MESSAGE_TOO_BIG = 1009,
  MANDATORY_EXTENSION = 1010,
  INTERNAL_ERROR = 1011,
  TLS_HANDSHAKE = 1015,
}

class WebSocketManager {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  public getState(): WebSocketState {
    return this.ws.readyState as WebSocketState;
  }

  public isState(state: WebSocketState): boolean {
    return this.ws.readyState === state;
  }

  public close(
    code: CloseCode = CloseCode.NORMAL_CLOSURE,
    reason?: string
  ): void {
    this.ws.close(code, reason);
  }

  public waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isState(WebSocketState.OPEN)) {
        resolve();
        return;
      }

      const handleOpen = () => {
        this.ws.removeEventListener('open', handleOpen);
        this.ws.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = (error: Event) => {
        this.ws.removeEventListener('open', handleOpen);
        this.ws.removeEventListener('error', handleError);
        reject(error);
      };

      this.ws.addEventListener('open', handleOpen);
      this.ws.addEventListener('error', handleError);
    });
  }
}
```

### Async/Await Pattern with TypeScript

Modern async patterns with proper typing:

```typescript
class AsyncWebSocket {
  private ws: WebSocket;

  constructor(private url: string) {
    this.ws = new WebSocket(url);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
    });
  }

  async send<T>(data: T): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    this.ws.send(JSON.stringify(data));
  }

  async receive<T>(): Promise<T> {
    return new Promise((resolve, reject) => {
      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data: T = JSON.parse(event.data);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      this.ws.onerror = (error) => reject(error);
    });
  }

  async request<TRequest, TResponse>(data: TRequest): Promise<TResponse> {
    await this.send(data);
    return this.receive<TResponse>();
  }

  close(): void {
    this.ws.close();
  }
}

// Usage with async/await
async function main() {
  const ws = new AsyncWebSocket('wss://api.example.com');

  try {
    await ws.connect();

    const response = await ws.request<
      { action: string; id: number },
      { status: string; result: any }
    >({
      action: 'getData',
      id: 123,
    });

    console.log('Response:', response);
  } catch (error) {
    console.error('WebSocket error:', error);
  } finally {
    ws.close();
  }
}
```

## Working with Binary Data

### Sending Binary Data

```javascript
// ArrayBuffer
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
view.setFloat32(0, 3.14159);
view.setInt32(4, 42);
socket.send(buffer);

// Typed Arrays
const floats = new Float32Array([1.1, 2.2, 3.3]);
socket.send(floats.buffer);

// Uint8Array for bytes
const bytes = new Uint8Array([0xff, 0x00, 0xab, 0xcd]);
socket.send(bytes);

// Blob (for file-like data)
const blob = new Blob(['Binary data'], { type: 'application/octet-stream' });
socket.send(blob);
```

### Receiving Binary Data

```javascript
socket.binaryType = 'arraybuffer'; // Default and recommended

socket.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Process binary data
    const view = new DataView(event.data);
    const messageType = view.getUint8(0);

    switch (messageType) {
      case 0x01: // Position update
        const x = view.getFloat32(1);
        const y = view.getFloat32(5);
        updatePosition(x, y);
        break;
      case 0x02: // Data packet
        const length = view.getUint32(1);
        const data = new Uint8Array(event.data, 5, length);
        processDataPacket(data);
        break;
    }
  }
};
```

## Browser Compatibility

### Current Browser Support

The WebSocket API has excellent support across all modern browsers:

| Browser          | Minimum Version | Notes                          |
| ---------------- | --------------- | ------------------------------ |
| Chrome           | 16+             | Full support, best performance |
| Firefox          | 11+             | Full support                   |
| Safari           | 7+              | Full support                   |
| Edge             | 12+             | Full support                   |
| Opera            | 12.1+           | Full support                   |
| iOS Safari       | 6+              | Full support                   |
| Android Browser  | 4.4+            | Full support                   |
| Samsung Internet | 4+              | Full support                   |

### Feature Detection

```javascript
if ('WebSocket' in window) {
  // WebSocket is supported
  const socket = new WebSocket('wss://echo.websocket.org');
} else {
  // Fallback for older browsers
  console.log('WebSocket not supported');
  // Consider using a polyfill or alternative transport
}
```

### Browser-Specific Considerations

- **Mobile browsers**: May close connections when app is backgrounded
- **Safari**: Stricter certificate validation for wss:// connections
- **Firefox**: Better error messages in developer console
- **Chrome**: Best DevTools support for WebSocket debugging

## Security Considerations

### Always Use Secure WebSockets (WSS)

```javascript
// Bad - unencrypted
const socket = new WebSocket('ws://api.example.com');

// Good - encrypted
const socket = new WebSocket('wss://api.example.com');
```

### Validate Origin

Servers should validate the Origin header to prevent CSWSH attacks.

### Input Validation

```javascript
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Validate message structure
    if (!data.type || typeof data.type !== 'string') {
      throw new Error('Invalid message format');
    }

    // Sanitize user-generated content
    if (data.html) {
      data.html = DOMPurify.sanitize(data.html);
    }

    processMessage(data);
  } catch (error) {
    console.error('Invalid message received:', error);
  }
};
```

### Authentication

```javascript
// Option 1: Token in URL (visible in logs)
const socket = new WebSocket('wss://api.example.com/ws?token=' + authToken);

// Option 2: Send auth message after connection
const socket = new WebSocket('wss://api.example.com/ws');
socket.onopen = () => {
  socket.send(
    JSON.stringify({
      type: 'auth',
      token: authToken,
    })
  );
};

// Option 3: Use cookies (must be set with Secure and SameSite flags)
// Cookies are automatically sent with the WebSocket handshake
```

### Rate Limiting

```javascript
class RateLimitedWebSocket {
  constructor(url, maxMessagesPerSecond = 10) {
    this.ws = new WebSocket(url);
    this.maxRate = maxMessagesPerSecond;
    this.messageTimestamps = [];
  }

  send(data) {
    const now = Date.now();

    // Remove timestamps older than 1 second
    this.messageTimestamps = this.messageTimestamps.filter(
      (t) => now - t < 1000
    );

    // Check rate limit
    if (this.messageTimestamps.length >= this.maxRate) {
      console.warn('Rate limit exceeded');
      return false;
    }

    // Send message and record timestamp
    this.messageTimestamps.push(now);
    this.ws.send(data);
    return true;
  }
}
```

## Common Gotchas

### `bufferedAmount` and Backpressure

The `bufferedAmount` property shows data queued but not yet sent. Monitor this
to implement backpressure:

```javascript
function safeSend(socket, data) {
  // Prevent memory issues from unbounded buffering
  const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

  if (socket.bufferedAmount > MAX_BUFFER) {
    console.error('Buffer full, message dropped');
    return false;
  }

  socket.send(data);
  return true;
}
```

### Message Size Limits

Different browsers and servers have different limits:

- **Chrome**: ~100MB per message
- **Firefox**: ~2GB per message
- **Safari**: ~100MB per message
- **Most servers**: Configurable, often 64KB-10MB default

Always handle large data appropriately:

```javascript
function sendLargeData(socket, data) {
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks
  const json = JSON.stringify(data);

  if (json.length > CHUNK_SIZE) {
    // Split into chunks
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      socket.send(
        JSON.stringify({
          type: 'chunk',
          id: Date.now(),
          index: Math.floor(i / CHUNK_SIZE),
          total: Math.ceil(json.length / CHUNK_SIZE),
          data: json.substr(i, CHUNK_SIZE),
        })
      );
    }
  } else {
    socket.send(json);
  }
}
```

### Close Codes and Their Meanings

Not all close codes are equal. Some indicate errors, others normal operation:

```javascript
socket.onclose = (event) => {
  const errorCodes = [
    1002, 1003, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1015,
  ];

  if (errorCodes.includes(event.code)) {
    console.error(`Connection error: ${event.code} - ${event.reason}`);
    // Implement error recovery
  } else if (event.code === 1000 || event.code === 1001) {
    console.log('Normal connection closure');
  }
};
```

### `onerror` Limitations

The error event provides no details about what went wrong for security reasons:

```javascript
socket.onerror = (event) => {
  // event doesn't contain error details
  // Can't determine what went wrong from this event alone
  console.error('WebSocket error occurred');

  // Check other indicators
  console.log('ReadyState:', socket.readyState);
  console.log('URL:', socket.url);

  // Wait for close event for more information
};
```

### `lastEventId` Irrelevance

The `MessageEvent.lastEventId` property is inherited from Server-Sent Events and
is always empty for WebSockets:

```javascript
socket.onmessage = (event) => {
  console.log(event.lastEventId); // Always empty string ""
  // Don't rely on this - implement your own message IDs if needed
};
```

### `binaryType` Configuration

Must be set before receiving binary data:

```javascript
// Set BEFORE receiving any binary messages
socket.binaryType = 'arraybuffer'; // or 'blob'

socket.onopen = () => {
  // Safe to receive binary data now
};

// Changing binaryType only affects future messages
socket.binaryType = 'blob';
// Previously received ArrayBuffers don't change to Blobs
```

## Related Interfaces

### CloseEvent

The CloseEvent provides information about why a connection was closed:

```javascript
socket.onclose = (event) => {
  // CloseEvent properties
  console.log('Code:', event.code); // Numeric close code
  console.log('Reason:', event.reason); // Human-readable reason
  console.log('Clean:', event.wasClean); // Was it a clean close?

  // Inherited Event properties
  console.log('Type:', event.type); // "close"
  console.log('Target:', event.target); // The WebSocket object
};
```

### MessageEvent

The MessageEvent delivers data from the server:

```javascript
socket.onmessage = (event) => {
  // MessageEvent properties
  console.log('Data:', event.data); // The message payload
  console.log('Origin:', event.origin); // Origin of the message
  console.log('LastEventId:', event.lastEventId); // Always "" for WebSocket
  console.log('Source:', event.source); // null for WebSocket
  console.log('Ports:', event.ports); // [] for WebSocket

  // Inherited Event properties
  console.log('Type:', event.type); // "message"
  console.log('Target:', event.target); // The WebSocket object
};
```

## WebSocket Close Codes

### Standard Codes (1000-1015)

| Code | Name                  | Description                                  | Action Required                       |
| ---- | --------------------- | -------------------------------------------- | ------------------------------------- |
| 1000 | Normal Closure        | Standard closing of connection               | None                                  |
| 1001 | Going Away            | Server going down or browser navigating away | Reconnect to different endpoint       |
| 1002 | Protocol Error        | Protocol error detected                      | Fix protocol implementation           |
| 1003 | Unsupported Data      | Received data type cannot be accepted        | Check data format                     |
| 1005 | No Status Received    | No status code in close frame                | Treat as abnormal closure             |
| 1006 | Abnormal Closure      | Connection lost without close frame          | Check network, implement reconnection |
| 1007 | Invalid Frame Payload | Message data was inconsistent                | Validate message encoding             |
| 1008 | Policy Violation      | Generic policy violation                     | Review server requirements            |
| 1009 | Message Too Big       | Message exceeds size limits                  | Reduce message size                   |
| 1010 | Mandatory Extension   | Required extension not supported             | Negotiate supported extensions        |
| 1011 | Internal Error        | Server encountered unexpected condition      | Retry with backoff                    |
| 1015 | TLS Handshake         | TLS/SSL handshake failure                    | Check certificates                    |

### Application Codes (4000-4999)

Reserved for application-specific use:

```javascript
// Define your own application codes
const APP_CLOSE_CODES = {
  IDLE_TIMEOUT: 4000,
  USER_LOGOUT: 4001,
  DUPLICATE_CONNECTION: 4002,
  RATE_LIMIT_EXCEEDED: 4003,
  AUTHENTICATION_FAILED: 4004,
  SUBSCRIPTION_EXPIRED: 4005,
};

// Use them when closing
socket.close(APP_CLOSE_CODES.IDLE_TIMEOUT, 'Idle for too long');
```

## IoT and Mobile Considerations

### Battery Optimization

```javascript
class MobileWebSocket {
  constructor(url) {
    this.url = url;
    this.isBackground = false;

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onBackground();
      } else {
        this.onForeground();
      }
    });

    this.connect();
  }

  onBackground() {
    this.isBackground = true;
    // Reduce heartbeat frequency
    this.heartbeatInterval = 60000; // 1 minute

    // Or close connection to save battery
    if (this.aggressive) {
      this.ws.close(1000, 'App backgrounded');
    }
  }

  onForeground() {
    this.isBackground = false;
    // Restore normal heartbeat
    this.heartbeatInterval = 30000; // 30 seconds

    // Reconnect if needed
    if (this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  connect() {
    this.ws = new WebSocket(this.url);
    // ... setup handlers
  }
}
```

## Live Streaming Patterns

### Adaptive Bitrate Streaming

```javascript
class AdaptiveWebSocket {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.measureBandwidth();
  }

  measureBandwidth() {
    let lastTime = Date.now();
    let bytesReceived = 0;

    this.ws.onmessage = (event) => {
      const now = Date.now();
      const data = event.data;

      // Measure throughput
      if (data instanceof ArrayBuffer) {
        bytesReceived += data.byteLength;
      } else {
        bytesReceived += data.length * 2; // Approximate for UTF-16
      }

      const elapsed = now - lastTime;
      if (elapsed > 1000) {
        // Every second
        const throughput = ((bytesReceived * 8) / elapsed) * 1000; // bits per second
        this.adjustQuality(throughput);

        // Reset counters
        bytesReceived = 0;
        lastTime = now;
      }

      // Handle message normally
      this.ondata?.(event);
    };
  }

  adjustQuality(bitsPerSecond) {
    let quality;
    if (bitsPerSecond > 5000000)
      quality = 'high'; // > 5 Mbps
    else if (bitsPerSecond > 1000000)
      quality = 'medium'; // > 1 Mbps
    else quality = 'low';

    if (this.currentQuality !== quality) {
      this.currentQuality = quality;
      this.ws.send(
        JSON.stringify({
          type: 'quality',
          quality: quality,
        })
      );
    }
  }
}
```

## Further Reading

### Specifications and Standards

- [WHATWG HTML Living Standard - WebSockets](https://html.spec.whatwg.org/multipage/web-sockets.html) -
  The official WebSocket API specification
- [RFC 6455 - The WebSocket Protocol](https://tools.ietf.org/html/rfc6455) -
  IETF protocol specification
- [RFC 7692 - Compression Extensions](https://tools.ietf.org/html/rfc7692) -
  WebSocket compression
- [RFC 8441 - Bootstrapping WebSockets with HTTP/2](https://tools.ietf.org/html/rfc8441) -
  HTTP/2 support

### WebSocket.org Resources

- [WebSocket Protocol Guide](/guides/websocket-protocol) - Deep dive into the
  protocol
- [Building WebSocket Applications](/guides/building-a-websocket-app) -
  Practical implementation guide
- [WebSockets at Scale](/guides/websockets-at-scale) - Scaling strategies and
  patterns
- [Future of WebSockets](/guides/future-of-websockets) - HTTP/3 and upcoming
  features

### Developer Resources

- [MDN WebSocket Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) -
  Mozilla's comprehensive guide
- [Chrome DevTools WebSocket Debugging](https://developer.chrome.com/docs/devtools/network/#websocket) -
  Debug WebSocket connections
- [Can I Use WebSocket](https://caniuse.com/websockets) - Browser compatibility
  data

### Testing Tools

- [WebSocket Echo Server](/tools/websocket-echo-server) - Test server for
  development
- [Online WebSocket Test](https://www.websocket.org/echo.html) - Browser-based
  testing tool

### Libraries and Frameworks

- [Socket.IO](https://socket.io/) - Real-time engine with fallbacks
- [ws](https://github.com/websockets/ws) - Popular Node.js WebSocket library
- [Ably](https://ably.com?utm_source=websocket-org&utm_medium=websocket-api) - Enterprise-grade WebSocket infrastructure

## FAQ

### How do I create a WebSocket connection in JavaScript?

Use the WebSocket constructor: `const ws = new WebSocket("wss://example.com")`.
The single required argument is the URL. An optional second argument accepts one
or more subprotocol strings. The connection attempt begins immediately on
construction.

### What are the WebSocket readyState values?

There are four readyState values: `0` (CONNECTING) means the connection is not
yet open, `1` (OPEN) means it is ready to send and receive, `2` (CLOSING) means
`close()` has been called, and `3` (CLOSED) means the connection is closed or
could not be opened.

### How do I send binary data over a WebSocket?

Set `ws.binaryType` to `"arraybuffer"` or `"blob"` before receiving, then call
`ws.send()` with an ArrayBuffer, Blob, or typed array (like Uint8Array). The
browser handles framing automatically. Check `ws.bufferedAmount` to monitor the
send queue.

### What is the difference between onmessage and addEventListener?

`onmessage` sets a single handler that replaces any previous one.
`addEventListener("message", fn)` can attach multiple listeners. Use
`addEventListener` when you need multiple independent handlers or want to use
`removeEventListener` for cleanup.

### How do I handle WebSocket reconnection?

The browser WebSocket API has no built-in reconnection. Implement it yourself in
the `onclose` handler using exponential backoff: start with a short delay (e.g.,
1 second), double it on each retry, and cap at a maximum (e.g., 30 seconds).
Libraries like reconnecting-websocket automate this.

## Related Content

- [WebSocket Protocol Guide](/guides/websocket-protocol/) - How the protocol
  works under the hood (handshake, framing, extensions)
- [WebSocket Close Codes](/reference/close-codes/) - Complete reference for all
  close status codes
- [Building a WebSocket App](/guides/building-a-websocket-app/) - Step-by-step
  guide to building your first app
- [WebSocket Security Guide](/guides/security/) - Authentication, encryption,
  and common vulnerabilities
- [WebSocket Echo Server](/tools/websocket-echo-server/) - Test your WebSocket
  code against a live echo server

[ably-websockets]: https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=websocket-api
