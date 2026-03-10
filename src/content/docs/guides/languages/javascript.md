---
title: 'JavaScript WebSocket: Browser API & Node.js Guide'
description:
  'Build WebSocket apps in JavaScript. Covers the browser WebSocket API, ws
  library for Node.js, reconnection, binary data, and production patterns for
  real-time applications.'
sidebar:
  order: 1
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - javascript websocket
  - websocket api javascript
  - nodejs websocket
  - ws library
  - browser websocket
seo:
  keywords:
    - javascript websocket
    - websocket api javascript
    - nodejs websocket
    - ws library
    - browser websocket
    - websocket client javascript
    - websocket server nodejs
    - real-time javascript
faq:
  - q: 'How do I create a WebSocket connection in JavaScript?'
    a:
      'Use the native WebSocket API: const ws = new
      WebSocket("wss://example.com"). Listen for events with ws.onopen,
      ws.onmessage, ws.onerror, and ws.onclose. The browser handles the HTTP
      upgrade automatically.'
  - q: 'What is the best WebSocket library for Node.js?'
    a:
      'The ws library is the most popular and performant choice for Node.js
      WebSocket servers. It is fast, well-maintained, and closely follows the
      WebSocket specification. For additional features like rooms and fallbacks,
      use Socket.IO.'
  - q: 'How do I handle WebSocket reconnection in JavaScript?'
    a:
      'Implement a reconnection loop with exponential backoff. On the close
      event, wait an increasing delay before calling new WebSocket() again. Cap
      the maximum delay and reset it after a successful connection.'
  - q: 'Can I send binary data over WebSockets in JavaScript?'
    a:
      'Yes. Set ws.binaryType to "arraybuffer" or "blob" before receiving. Send
      binary data with ws.send(arrayBuffer) or ws.send(blob). The WebSocket API
      handles framing automatically.'
tags:
  - websocket
  - javascript
  - nodejs
  - browser
  - websocket-javascript
  - programming
  - tutorial
  - implementation
  - guide
  - how-to
---

:::note[Quick Answer] In the browser, use the native API:
`new WebSocket("wss://example.com")`. For Node.js servers, use the **ws**
library (`npm install ws`). Handle events with `onopen`, `onmessage`, `onerror`,
and `onclose`. Add reconnection with exponential backoff for production use. :::

## Introduction to WebSockets in JavaScript

JavaScript stands at the heart of WebSocket development, being the native
language of the web browser where the WebSocket API was first implemented. The
seamless integration between JavaScript and WebSockets has made real-time web
applications not just possible, but commonplace. From the browser's built-in
WebSocket API to Node.js server implementations, JavaScript provides the most
direct and widely-supported path to WebSocket development.

The WebSocket API in JavaScript is remarkably simple yet powerful. Unlike HTTP
requests that require libraries or complex XMLHttpRequest code, WebSocket
connections are first-class citizens in the browser, with a clean API that
follows JavaScript's event-driven paradigm. This native support means that any
modern browser can establish WebSocket connections without additional libraries,
making it the most accessible way to add real-time capabilities to web
applications.

The JavaScript ecosystem's maturity around WebSockets is unparalleled. Whether
you're building a simple chat application or a complex real-time collaboration
platform, you'll find battle-tested libraries, comprehensive documentation, and
a vast community of developers who have solved similar problems. This ecosystem
extends from the browser to the server, with Node.js providing excellent
WebSocket server capabilities through libraries like ws and Socket.IO.

## Why JavaScript for WebSockets

JavaScript's event-driven, non-blocking nature makes it perfectly suited for
WebSocket programming. The language's asynchronous capabilities, whether through
callbacks, promises, or async/await, align naturally with the asynchronous
nature of WebSocket communication. This alignment means that handling multiple
concurrent connections, managing connection state, and processing messages feels
intuitive and requires less boilerplate than many other languages.

The ubiquity of JavaScript across the web development stack provides unique
advantages. You can share code between client and server, use the same data
validation logic on both ends, and maintain consistency in your message formats
and business logic. This code reuse significantly reduces development time and
eliminates the bugs that often arise from reimplementing the same logic in
different languages.

Furthermore, JavaScript's dynamic typing and flexible object model make it easy
to work with the varied message formats common in WebSocket applications.
Whether you're sending JSON, binary data, or plain text, JavaScript handles
these formats naturally. The built-in JSON support means that most WebSocket
applications can serialize and deserialize messages with a single function call,
making real-time data exchange remarkably straightforward.

## Browser WebSocket API

The browser WebSocket API provides everything you need to establish and manage
WebSocket connections from client-side JavaScript. Here's a comprehensive
example showing all the key features:

```javascript
class WebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...options,
    };
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.eventHandlers = {};
    this.isConnected = false;

    this.connect();
  }

  connect() {
    console.log(`Connecting to ${this.url}...`);

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
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.send(message);
      }

      // Start heartbeat
      this.startHeartbeat();

      // Trigger custom open handlers
      this.trigger('open', event);
    };

    this.ws.onmessage = (event) => {
      console.log('Message received:', event.data);

      // Try to parse JSON messages
      let data = event.data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        // Not JSON, use as-is
      }

      // Handle ping/pong for heartbeat
      if (data.type === 'pong') {
        this.lastPong = Date.now();
        return;
      }

      // Trigger custom message handlers
      this.trigger('message', data);

      // Trigger typed message handlers
      if (data.type) {
        this.trigger(data.type, data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.trigger('error', error);
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
      this.isConnected = false;
      this.stopHeartbeat();

      // Trigger custom close handlers
      this.trigger('close', event);

      // Attempt to reconnect if not a normal closure
      if (event.code !== 1000 && event.code !== 1001) {
        this.scheduleReconnect();
      }
    };
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data =
        typeof message === 'object' ? JSON.stringify(message) : message;
      this.ws.send(data);
    } else {
      // Queue message if not connected
      console.log('WebSocket not connected, queuing message');
      this.messageQueue.push(message);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });

        // Check for pong timeout
        setTimeout(() => {
          const timeSinceLastPong = Date.now() - (this.lastPong || 0);
          if (timeSinceLastPong > this.options.heartbeatInterval * 2) {
            console.log('Heartbeat timeout, reconnecting...');
            this.ws.close();
          }
        }, 5000);
      }
    }, this.options.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.trigger('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(
        (h) => h !== handler
      );
    }
  }

  trigger(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  close() {
    this.reconnectAttempts = this.options.maxReconnectAttempts;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client closing connection');
    }
  }
}

// Usage example
const client = new WebSocketClient('wss://echo.websocket.org');

client.on('open', () => {
  console.log('Connected and ready!');
  client.send({ type: 'hello', user: 'JavaScript Client' });
});

client.on('message', (data) => {
  console.log('Received:', data);
});

client.on('error', (error) => {
  console.error('Connection error:', error);
});

client.on('close', (event) => {
  console.log('Connection closed:', event.code, event.reason);
});
```

## Node.js WebSocket Server

Building WebSocket servers in Node.js leverages the platform's excellent
networking capabilities and event-driven architecture. The ws library is the
most popular choice for production WebSocket servers:

```javascript
const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class WebSocketServer {
  constructor(port = 8080) {
    this.port = port;
    this.clients = new Map();
    this.rooms = new Map();

    // Create HTTP server
    this.server = http.createServer();

    // Create WebSocket server
    this.wss = new WebSocket.Server({
      server: this.server,
      clientTracking: true,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        threshold: 1024,
      },
    });

    this.setupWebSocketServer();
    this.setupHttpServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const clientIp = request.socket.remoteAddress;

      console.log(`New client connected: ${clientId} from ${clientIp}`);

      // Store client information
      this.clients.set(clientId, {
        ws,
        id: clientId,
        ip: clientIp,
        connectedAt: new Date(),
        rooms: new Set(),
        metadata: {},
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        timestamp: Date.now(),
      });

      // Set up client event handlers
      this.setupClientHandlers(ws, clientId);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  setupClientHandlers(ws, clientId) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error(`Invalid message from ${clientId}:`, error);
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Client ${clientId} disconnected: ${code} - ${reason}`);
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
    });
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`Message from ${clientId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
        break;

      case 'join':
        this.joinRoom(clientId, message.room);
        break;

      case 'leave':
        this.leaveRoom(clientId, message.room);
        break;

      case 'broadcast':
        this.broadcast(message.data, clientId);
        break;

      case 'room_message':
        this.sendToRoom(message.room, message.data, clientId);
        break;

      case 'private_message':
        this.sendToClient(message.to, {
          type: 'private_message',
          from: clientId,
          data: message.data,
        });
        break;

      case 'set_metadata':
        client.metadata = { ...client.metadata, ...message.metadata };
        this.sendToClient(clientId, {
          type: 'metadata_updated',
          metadata: client.metadata,
        });
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  joinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }

    const room = this.rooms.get(roomName);
    room.add(clientId);
    client.rooms.add(roomName);

    // Notify client
    this.sendToClient(clientId, {
      type: 'joined_room',
      room: roomName,
      members: Array.from(room),
    });

    // Notify room members
    this.sendToRoom(
      roomName,
      {
        type: 'member_joined',
        room: roomName,
        clientId,
      },
      clientId
    );

    console.log(`Client ${clientId} joined room ${roomName}`);
  }

  leaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(clientId);
      client.rooms.delete(roomName);

      if (room.size === 0) {
        this.rooms.delete(roomName);
      } else {
        // Notify room members
        this.sendToRoom(roomName, {
          type: 'member_left',
          room: roomName,
          clientId,
        });
      }
    }

    console.log(`Client ${clientId} left room ${roomName}`);
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  sendToRoom(roomName, message, excludeClientId = null) {
    const room = this.rooms.get(roomName);
    if (room) {
      room.forEach((clientId) => {
        if (clientId !== excludeClientId) {
          this.sendToClient(clientId, message);
        }
      });
    }
  }

  broadcast(message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Leave all rooms
      client.rooms.forEach((roomName) => {
        this.leaveRoom(clientId, roomName);
      });

      // Remove client
      this.clients.delete(clientId);
    }
  }

  setupHttpServer() {
    // Health check endpoint
    this.server.on('request', (req, res) => {
      const pathname = url.parse(req.url).pathname;

      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            clients: this.clients.size,
            rooms: this.rooms.size,
            uptime: process.uptime(),
          })
        );
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
  }

  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.isAlive === false) {
          console.log(`Client ${clientId} failed heartbeat, disconnecting`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
        } else {
          client.isAlive = false;
          client.ws.ping();
        }
      });
    }, 30000);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`WebSocket server running on port ${this.port}`);
      this.startHeartbeat();
    });
  }
}

// Start the server
const server = new WebSocketServer(8080);
server.start();
```

## Working with Binary Data

JavaScript WebSockets support both text and binary data transmission. Binary
data is particularly useful for sending images, audio, video, or any other
non-text data efficiently:

```javascript
// Client-side binary handling
class BinaryWebSocketClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer'; // or 'blob'

    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      } else if (event.data instanceof Blob) {
        this.handleBlobMessage(event.data);
      } else {
        this.handleTextMessage(event.data);
      }
    };
  }

  handleBinaryMessage(buffer) {
    // Example: Parse a custom binary protocol
    const view = new DataView(buffer);

    // Read message type (1 byte)
    const messageType = view.getUint8(0);

    // Read timestamp (8 bytes)
    const timestamp = view.getBigUint64(1);

    // Read payload length (4 bytes)
    const payloadLength = view.getUint32(9);

    // Read payload
    const payload = new Uint8Array(buffer, 13, payloadLength);

    console.log('Binary message:', {
      type: messageType,
      timestamp: timestamp.toString(),
      payload: payload,
    });
  }

  handleBlobMessage(blob) {
    // Convert Blob to ArrayBuffer
    blob.arrayBuffer().then((buffer) => {
      this.handleBinaryMessage(buffer);
    });
  }

  sendBinary(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      // Send as ArrayBuffer
      const buffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(buffer);
      view.set(data);
      this.ws.send(buffer);
    }
  }

  sendFile(file) {
    if (this.ws.readyState === WebSocket.OPEN) {
      // Send file metadata first
      this.ws.send(
        JSON.stringify({
          type: 'file_start',
          name: file.name,
          size: file.size,
          type: file.type,
        })
      );

      // Send file data as binary
      const reader = new FileReader();
      reader.onload = (event) => {
        this.ws.send(event.target.result);

        // Send completion message
        this.ws.send(
          JSON.stringify({
            type: 'file_end',
            name: file.name,
          })
        );
      };
      reader.readAsArrayBuffer(file);
    }
  }
}
```

## Socket.IO: Enhanced WebSocket Experience

While pure WebSockets are powerful, Socket.IO provides additional features like
automatic reconnection, room management, and fallback transports. Here's how to
build a feature-rich real-time application with Socket.IO:

```javascript
// Server-side with Socket.IO
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (validateToken(token)) {
    socket.userId = getUserIdFromToken(token);
    next();
  } else {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);

  // Join user's personal room
  socket.join(`user:${socket.userId}`);

  // Handle joining rooms
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit('user_joined', {
      userId: socket.userId,
      roomName,
    });
  });

  // Handle leaving rooms
  socket.on('leave_room', (roomName) => {
    socket.leave(roomName);
    socket.to(roomName).emit('user_left', {
      userId: socket.userId,
      roomName,
    });
  });

  // Handle messages
  socket.on('message', (data) => {
    // Broadcast to room
    if (data.room) {
      socket.to(data.room).emit('message', {
        from: socket.userId,
        ...data,
      });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (roomName) => {
    socket.to(roomName).emit('user_typing', {
      userId: socket.userId,
    });
  });

  socket.on('typing_stop', (roomName) => {
    socket.to(roomName).emit('user_stopped_typing', {
      userId: socket.userId,
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.userId} disconnected: ${reason}`);

    // Notify all rooms the user was in
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.to(room).emit('user_disconnected', {
          userId: socket.userId,
        });
      }
    });
  });
});

httpServer.listen(3000);

// Client-side with Socket.IO
class SocketIOClient {
  constructor(url, token) {
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.onConnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us, manually reconnect
        this.socket.connect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
  }

  joinRoom(roomName) {
    this.socket.emit('join_room', roomName);
  }

  sendMessage(message, room = null) {
    this.socket.emit('message', { ...message, room });
  }

  startTyping(roomName) {
    this.socket.emit('typing_start', roomName);
  }

  stopTyping(roomName) {
    this.socket.emit('typing_stop', roomName);
  }
}
```

## Performance Optimization

JavaScript WebSocket applications can achieve excellent performance with proper
optimization techniques. The single-threaded nature of JavaScript requires
careful consideration of blocking operations and efficient message processing:

```javascript
// Optimized message batching
class BatchingWebSocketClient {
  constructor(url, batchInterval = 50) {
    this.ws = new WebSocket(url);
    this.batchInterval = batchInterval;
    this.messageBuffer = [];
    this.batchTimer = null;

    this.setupBatching();
  }

  setupBatching() {
    this.ws.onopen = () => {
      this.startBatching();
    };

    this.ws.onclose = () => {
      this.stopBatching();
    };
  }

  send(message) {
    this.messageBuffer.push(message);

    // Send immediately if buffer is getting large
    if (this.messageBuffer.length >= 100) {
      this.flush();
    }
  }

  flush() {
    if (
      this.messageBuffer.length > 0 &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      // Send as batch
      this.ws.send(
        JSON.stringify({
          type: 'batch',
          messages: this.messageBuffer,
        })
      );
      this.messageBuffer = [];
    }
  }

  startBatching() {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.batchInterval);
  }

  stopBatching() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flush(); // Send any remaining messages
  }
}

// Worker-based processing for CPU-intensive operations
class WorkerWebSocketClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.worker = new Worker('message-processor.js');

    this.setupHandlers();
  }

  setupHandlers() {
    this.ws.onmessage = (event) => {
      // Offload processing to worker
      this.worker.postMessage({
        type: 'process',
        data: event.data,
      });
    };

    this.worker.onmessage = (event) => {
      // Handle processed message
      this.handleProcessedMessage(event.data);
    };
  }

  handleProcessedMessage(data) {
    // Update UI or trigger actions based on processed data
    console.log('Processed:', data);
  }
}
```

## Testing WebSocket Applications

Testing WebSocket functionality requires specialized approaches. Here's a
comprehensive testing setup using popular JavaScript testing frameworks:

```javascript
// Jest test example
const WebSocket = require('ws');
const { WebSocketServer } = require('./websocket-server');

describe('WebSocket Server', () => {
  let server;
  let client;

  beforeAll((done) => {
    server = new WebSocketServer(8080);
    server.start();
    setTimeout(done, 100);
  });

  afterAll((done) => {
    server.close();
    setTimeout(done, 100);
  });

  beforeEach((done) => {
    client = new WebSocket('ws://localhost:8080');
    client.on('open', done);
  });

  afterEach(() => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  test('should receive welcome message on connection', (done) => {
    client.on('message', (data) => {
      const message = JSON.parse(data);
      expect(message.type).toBe('welcome');
      expect(message.clientId).toBeDefined();
      done();
    });
  });

  test('should echo ping with pong', (done) => {
    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'pong') {
        expect(message.timestamp).toBeDefined();
        done();
      }
    });

    client.send(JSON.stringify({ type: 'ping' }));
  });

  test('should handle room joining', (done) => {
    const roomName = 'test-room';

    client.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'joined_room') {
        expect(message.room).toBe(roomName);
        expect(message.members).toBeInstanceOf(Array);
        done();
      }
    });

    client.send(
      JSON.stringify({
        type: 'join',
        room: roomName,
      })
    );
  });
});

// E2E testing with Puppeteer
const puppeteer = require('puppeteer');

describe('WebSocket E2E Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should establish WebSocket connection', async () => {
    await page.goto('http://localhost:3000');

    // Evaluate WebSocket connection in browser context
    const isConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });

    expect(isConnected).toBe(true);
  });
});
```

## Security Considerations

Security is paramount when implementing WebSocket applications in JavaScript.
The persistent nature of WebSocket connections and the ability to execute
JavaScript in the browser require careful attention to security practices:

```javascript
// Secure WebSocket implementation
class SecureWebSocketServer {
  constructor() {
    this.rateLimiter = new Map();
    this.blacklist = new Set();
  }

  validateOrigin(origin, request) {
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }

    return allowedOrigins.includes(origin);
  }

  authenticateConnection(request) {
    const token = this.extractToken(request);

    if (!token) {
      return false;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.userId;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  extractToken(request) {
    // Try Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const url = new URL(request.url, `http://${request.headers.host}`);
    return url.searchParams.get('token');
  }

  checkRateLimit(clientId) {
    const now = Date.now();
    const limit = 100; // messages per minute
    const window = 60000; // 1 minute

    if (!this.rateLimiter.has(clientId)) {
      this.rateLimiter.set(clientId, []);
    }

    const timestamps = this.rateLimiter.get(clientId);

    // Remove old timestamps
    const validTimestamps = timestamps.filter((t) => now - t < window);

    if (validTimestamps.length >= limit) {
      return false;
    }

    validTimestamps.push(now);
    this.rateLimiter.set(clientId, validTimestamps);

    return true;
  }

  sanitizeMessage(message) {
    // Prevent XSS in messages
    if (typeof message === 'string') {
      return message
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    if (typeof message === 'object') {
      const sanitized = {};
      for (const key in message) {
        if (message.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeMessage(message[key]);
        }
      }
      return sanitized;
    }

    return message;
  }
}
```

## Production Deployment

Deploying JavaScript WebSocket applications to production requires careful
consideration of scalability, monitoring, and reliability. The event-driven
nature of Node.js makes it well-suited for handling thousands of concurrent
WebSocket connections, but proper configuration and monitoring are essential:

Production deployment considerations include process management with PM2 or
similar tools, implementing proper logging and monitoring, setting up health
checks and auto-restart mechanisms, and configuring reverse proxies correctly.
Load balancing WebSocket connections requires sticky sessions or a shared
session store to ensure clients can maintain their connections across server
restarts or scaling events.

The use of clustering in Node.js allows you to utilize multiple CPU cores
effectively. However, WebSocket connections are stateful, so you need to
implement proper inter-process communication or use a message broker like Redis
to share state between cluster workers. This architectural decision
significantly impacts how you scale your WebSocket application horizontally.

## Browser Compatibility and Polyfills

While WebSocket support is excellent in modern browsers, you may need to
consider fallback options for older browsers or restrictive network
environments. Libraries like Socket.IO provide automatic fallback to HTTP
long-polling, while SockJS offers multiple fallback transports. Understanding
these fallback mechanisms helps ensure your application remains accessible to
all users:

The key to broad compatibility is progressive enhancement. Start with a basic
HTTP-based implementation that works everywhere, then enhance it with WebSocket
support where available. This approach ensures that your application remains
functional even in environments where WebSockets are blocked or unavailable,
while still providing the best possible experience for users with modern
browsers.

## Advanced Patterns and Best Practices

Several advanced patterns can improve the robustness and maintainability of
JavaScript WebSocket applications. The event emitter pattern, already central to
Node.js, works excellently with WebSockets for organizing message handling.
Implementing a message queue ensures that messages aren't lost during temporary
disconnections. Using TypeScript adds type safety to your WebSocket messages,
catching errors at compile time rather than runtime.

State management becomes crucial as your WebSocket application grows. Whether
you're using Redux, MobX, or another state management solution, integrating
WebSocket events with your application state requires careful consideration. The
key is to treat WebSocket messages as actions that update your application
state, maintaining a unidirectional data flow that makes your application
predictable and debuggable.

## Monitoring and Debugging

Effective monitoring and debugging are essential for maintaining production
WebSocket applications. Browser developer tools provide excellent WebSocket
inspection capabilities, showing all frames sent and received. For Node.js
applications, tools like the Chrome DevTools can be attached to inspect
WebSocket connections and debug server-side code.

Implementing comprehensive logging is crucial for debugging production issues.
Log connection events, message types, error conditions, and performance metrics.
Use correlation IDs to trace messages across your system, making it easier to
debug issues in distributed WebSocket applications. Tools like Sentry or
LogRocket can capture WebSocket events alongside other application telemetry,
providing a complete picture of your application's behavior.

The Chrome DevTools Network tab includes a dedicated WebSocket section that
displays all WebSocket connections, their status, and a detailed frame-by-frame
view of all messages. This visibility is invaluable during development, allowing
you to see exactly what data is being sent and received. You can filter frames
by type (text or binary), search within message contents, and export the data
for further analysis. This level of debugging capability makes Chrome DevTools
an essential tool for WebSocket development.

For production monitoring, implementing custom metrics and dashboards becomes
crucial. Track metrics like connection count, message throughput, average
message size, and connection duration. These metrics help identify performance
bottlenecks and usage patterns. Implementing alerting based on these metrics
ensures you're notified of issues before they impact users. For example, a
sudden spike in disconnections might indicate network issues, while increasing
message latency could suggest server performance problems.

## The Future of WebSockets in JavaScript

The future of WebSockets in JavaScript looks bright with ongoing developments in
both the browser and Node.js ecosystems. The WebTransport API promises to bring
QUIC-based transport to the browser, offering improved performance and
reliability. WebAssembly opens new possibilities for high-performance message
processing directly in the browser. The continued evolution of JavaScript
itself, with features like top-level await and improved async iteration, makes
WebSocket programming even more intuitive.

As real-time features become standard in web applications, the importance of
WebSocket expertise continues to grow. The patterns and practices established in
JavaScript WebSocket development influence other languages and platforms,
cementing JavaScript's position as the primary language for real-time web
development. Whether you're building a simple chat application or a complex
collaborative platform, JavaScript provides all the tools necessary for
successful WebSocket implementation.

## Conclusion

JavaScript's central role in web development makes it the most important
language for WebSocket programming. From the native browser API to sophisticated
Node.js servers, JavaScript provides a complete ecosystem for building real-time
applications. The language's event-driven nature, combined with excellent
library support and a vast community, makes it the ideal choice for WebSocket
development.

The examples and patterns presented in this guide provide a foundation for
building production-ready WebSocket applications. Remember that successful
WebSocket implementations require careful attention to connection management,
error handling, security, and scalability. With JavaScript's continued evolution
and the growing importance of real-time features, mastering WebSocket
development in JavaScript is an essential skill for modern web developers.

The combination of JavaScript's accessibility, powerful features, and extensive
ecosystem ensures that it will remain the primary language for WebSocket
development. Whether you're building your first WebSocket application or
architecting a complex real-time system, JavaScript provides the flexibility and
power needed to create exceptional real-time experiences on the web.

## Frequently Asked Questions

### How do I create a WebSocket connection in JavaScript?

Use the native WebSocket API: `const ws = new WebSocket("wss://example.com")`.
Listen for events with `ws.onopen`, `ws.onmessage`, `ws.onerror`, and
`ws.onclose`. The browser handles the HTTP upgrade automatically.

### What is the best WebSocket library for Node.js?

The ws library is the most popular and performant choice for Node.js WebSocket
servers. It is fast, well-maintained, and closely follows the WebSocket
specification. For additional features like rooms and fallbacks, use Socket.IO.

### How do I handle WebSocket reconnection in JavaScript?

Implement a reconnection loop with exponential backoff. On the close event, wait
an increasing delay before calling `new WebSocket()` again. Cap the maximum
delay and reset it after a successful connection.

### Can I send binary data over WebSockets in JavaScript?

Yes. Set `ws.binaryType` to `"arraybuffer"` or `"blob"` before receiving. Send
binary data with `ws.send(arrayBuffer)` or `ws.send(blob)`. The WebSocket API
handles framing automatically.

## Related Content

- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Complete browser API reference
- [WebSocket Protocol: RFC 6455](/guides/websocket-protocol/) - The protocol
  behind the JavaScript WebSocket API
- [Python WebSocket Guide](/guides/languages/python/) - Compare JavaScript
  patterns with Python asyncio
- [WebSocket Libraries, Tools & Specs](/resources/websocket-resources/) -
  Curated list including ws, Socket.IO, and uWebSockets.js
- [WebSocket Close Codes](/reference/close-codes/) - Understanding close codes
  for error handling
