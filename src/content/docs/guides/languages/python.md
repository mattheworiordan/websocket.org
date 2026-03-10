---
title: 'Python WebSocket: asyncio Client & Server Guide'
description:
  'Build Python WebSocket apps with asyncio. Covers the websockets library,
  FastAPI integration, reconnection, rooms, testing, and production deployment
  patterns.'
sidebar:
  order: 2
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - python websocket
  - python websocket server
  - python websocket client
  - websockets library python
  - asyncio websocket
  - fastapi websocket
seo:
  keywords:
    - python websocket
    - python websocket server
    - python websocket client
    - websockets library
    - asyncio websocket
    - fastapi websocket
    - django channels websocket
    - python realtime
faq:
  - q: 'What is the best Python WebSocket library?'
    a:
      'The websockets library is the most popular choice for async Python
      WebSocket applications. It supports asyncio natively and handles the
      protocol correctly. For Django, use Django Channels. For FastAPI, use its
      built-in WebSocket support.'
  - q: 'How do I handle reconnection in a Python WebSocket client?'
    a:
      'Implement a reconnection loop with exponential backoff. Catch
      ConnectionClosed exceptions, wait with increasing delays, then call
      connect() again. Queue messages during disconnection so they can be sent
      once the connection is restored.'
  - q: 'Can Python handle thousands of WebSocket connections?'
    a:
      'Yes. Python asyncio can handle thousands of concurrent WebSocket
      connections in a single process because WebSocket workloads are I/O-bound.
      The event loop efficiently multiplexes connections without needing one
      thread per connection.'
  - q: 'How do I add WebSockets to a Django application?'
    a:
      'Use Django Channels, which extends Django to handle WebSockets and other
      async protocols. It adds a channel layer (typically backed by Redis) for
      message routing between consumers. Install channels, configure ASGI, and
      create WebSocket consumers.'
---

:::note[Quick Answer] Use the **websockets** library for async Python WebSocket
apps. Install with `pip install websockets`, create a server with
`websockets.serve()`, and connect from clients with `websockets.connect()`. For
Django, use **Django Channels**. For FastAPI, use its built-in WebSocket
support. :::

## Introduction to WebSockets in Python

Python's simplicity and extensive ecosystem make it an excellent choice for
WebSocket development. The language offers multiple mature libraries for
WebSocket implementation, with `websockets` being the most popular for async
applications and `python-socketio` providing excellent Socket.IO compatibility.
Python's async/await syntax, introduced in Python 3.5, provides clean and
readable code for handling concurrent WebSocket connections.

The evolution of Python's async capabilities represents one of the most
significant improvements to the language in recent years. The introduction of
asyncio fundamentally changed how Python developers approach concurrent
programming, making it possible to handle thousands of simultaneous WebSocket
connections efficiently within a single process. This transformation addressed
one of Python's historical weaknesses in real-time applications, where the
Global Interpreter Lock (GIL) traditionally limited concurrent execution.

Python's approach to WebSocket development emphasizes developer productivity and
code maintainability. The language's philosophy of "batteries included" means
that many common WebSocket patterns have well-established libraries and
frameworks, reducing the amount of boilerplate code developers need to write.
This productivity advantage makes Python particularly attractive for rapid
prototyping of real-time applications, data science projects that require
real-time visualization, and educational contexts where clear, readable code is
essential.

The Python WebSocket ecosystem benefits from the language's strong community and
comprehensive standard library. Whether you're building a simple chat
application or a complex real-time data pipeline, Python provides the tools and
libraries necessary for production-ready WebSocket implementations. The
extensive ecosystem also means excellent integration with popular Python
frameworks for web development, data analysis, and machine learning, enabling
developers to build sophisticated applications that combine real-time
communication with advanced data processing capabilities.

## Why Choose Python for WebSockets

Python excels in WebSocket development due to its readable syntax and powerful
async capabilities. The asyncio library provides a robust foundation for
handling thousands of concurrent connections efficiently. Python's dynamic
typing and high-level abstractions allow for rapid development and prototyping,
while still maintaining good performance for most real-time applications.

The performance characteristics of Python's asyncio make it surprisingly
competitive for WebSocket applications. While Python may not match the raw
throughput of compiled languages like Rust or Go, the asyncio event loop is
highly optimized for I/O-bound operations, which constitute the majority of
WebSocket server workload. For many applications, the development velocity and
maintainability advantages of Python far outweigh any minor performance
differences, especially when combined with proper architecture and caching
strategies.

Python's dynamic nature also provides unique advantages for WebSocket
applications that need to adapt to changing requirements. The ability to modify
message handlers, add new event types, and adjust protocol behavior at runtime
makes Python ideal for applications that require frequent updates or
customization. This flexibility is particularly valuable in prototyping
environments, research applications, and systems that need to integrate with
rapidly evolving APIs or data sources.

The extensive ecosystem of Python libraries means you can easily integrate
WebSocket functionality with web frameworks like Django and Flask, data science
tools like NumPy and Pandas, or machine learning frameworks like TensorFlow and
PyTorch. This makes Python particularly attractive for building real-time data
visualization dashboards, collaborative tools, and AI-powered applications. The
ability to seamlessly combine real-time communication with sophisticated data
processing capabilities enables use cases like live model training dashboards,
real-time sentiment analysis of chat messages, or collaborative data exploration
tools that would be much more complex to implement in other languages.

## Setting Up Your Python WebSocket Project

Start by creating a virtual environment and installing the necessary
dependencies. Python's package management system makes it easy to manage project
dependencies and ensure consistent environments across development and
production.

The use of virtual environments is particularly important for WebSocket
applications because they often rely on specific versions of async libraries
that may conflict with system-wide installations. Virtual environments also
enable precise dependency management, which is crucial when deploying WebSocket
applications to production environments where version mismatches can cause
subtle but critical failures in connection handling or message processing.

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install websockets aiohttp python-socketio fastapi uvicorn
```

## Building a WebSocket Server with websockets Library

Here's a comprehensive WebSocket server implementation using the popular
websockets library. This server demonstrates connection management, message
broadcasting, and error handling.

The server implementation showcases several important patterns for production
WebSocket applications. The use of dictionaries to track clients and rooms
represents a simple but effective approach to managing connection state. In
production environments, this state would typically be persisted in a database
or cache to enable horizontal scaling, but the in-memory approach shown here is
perfect for understanding the fundamental concepts.

```python
import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Set, Dict
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    def __init__(self):
        self.clients: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.rooms: Dict[str, Set[str]] = {}

    async def register_client(self, websocket, client_id: str):
        """Register a new client connection"""
        self.clients[client_id] = websocket
        logger.info(f"Client {client_id} connected. Total clients: {len(self.clients)}")

        # Send welcome message
        await websocket.send(json.dumps({
            "type": "welcome",
            "client_id": client_id,
            "timestamp": datetime.now().isoformat()
        }))

    async def unregister_client(self, client_id: str):
        """Remove client from registry"""
        if client_id in self.clients:
            del self.clients[client_id]

            # Remove from all rooms
            for room in self.rooms.values():
                room.discard(client_id)

            logger.info(f"Client {client_id} disconnected. Remaining clients: {len(self.clients)}")

    async def broadcast_message(self, message: dict, exclude_client: str = None):
        """Broadcast message to all connected clients"""
        if self.clients:
            message_str = json.dumps(message)
            tasks = []

            for client_id, websocket in self.clients.items():
                if client_id != exclude_client:
                    tasks.append(websocket.send(message_str))

            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def handle_client(self, websocket, path):
        """Handle individual client connection"""
        client_id = str(uuid.uuid4())

        try:
            await self.register_client(websocket, client_id)

            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(client_id, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }))
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} connection closed")
        finally:
            await self.unregister_client(client_id)

    async def process_message(self, client_id: str, data: dict):
        """Process incoming client messages"""
        message_type = data.get("type")

        if message_type == "broadcast":
            await self.broadcast_message({
                "type": "message",
                "from": client_id,
                "content": data.get("content"),
                "timestamp": datetime.now().isoformat()
            }, exclude_client=client_id)

        elif message_type == "join_room":
            room_name = data.get("room")
            if room_name:
                if room_name not in self.rooms:
                    self.rooms[room_name] = set()
                self.rooms[room_name].add(client_id)

                await self.clients[client_id].send(json.dumps({
                    "type": "room_joined",
                    "room": room_name
                }))

        elif message_type == "room_message":
            room_name = data.get("room")
            if room_name in self.rooms:
                message = {
                    "type": "room_message",
                    "room": room_name,
                    "from": client_id,
                    "content": data.get("content"),
                    "timestamp": datetime.now().isoformat()
                }

                for member_id in self.rooms[room_name]:
                    if member_id in self.clients and member_id != client_id:
                        await self.clients[member_id].send(json.dumps(message))

    async def start_server(self, host="localhost", port=8765):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on {host}:{port}")
        async with websockets.serve(self.handle_client, host, port):
            await asyncio.Future()  # Run forever

# Run the server
if __name__ == "__main__":
    server = WebSocketServer()
    asyncio.run(server.start_server())
```

## Building a WebSocket Client

Creating a robust WebSocket client with automatic reconnection and message
queuing ensures reliable communication even in unstable network conditions.

The client implementation demonstrates several critical patterns for production
WebSocket clients. The message queue with size limits prevents memory exhaustion
during extended disconnections, while the automatic reconnection logic ensures
that temporary network issues don't permanently break the connection. The
separation of connection management from message handling allows the client to
gracefully handle various failure scenarios without losing application state.

```python
import asyncio
import websockets
import json
import logging
from typing import Optional, Callable
from collections import deque

class WebSocketClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.client_id: Optional[str] = None
        self.message_queue = deque(maxlen=1000)
        self.running = False
        self.reconnect_interval = 5
        self.logger = logging.getLogger(__name__)

    async def connect(self):
        """Establish WebSocket connection"""
        try:
            self.websocket = await websockets.connect(self.uri)
            self.logger.info(f"Connected to {self.uri}")

            # Process any queued messages
            while self.message_queue and self.websocket:
                message = self.message_queue.popleft()
                await self.websocket.send(message)

            return True
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            return False

    async def disconnect(self):
        """Close WebSocket connection"""
        self.running = False
        if self.websocket:
            await self.websocket.close()
            self.websocket = None

    async def send_message(self, message: dict):
        """Send message with automatic queuing if disconnected"""
        message_str = json.dumps(message)

        if self.websocket and not self.websocket.closed:
            try:
                await self.websocket.send(message_str)
            except websockets.exceptions.ConnectionClosed:
                self.logger.warning("Connection lost, queuing message")
                self.message_queue.append(message_str)
        else:
            self.message_queue.append(message_str)

    async def receive_messages(self, message_handler: Callable):
        """Receive and process messages"""
        while self.running:
            try:
                if not self.websocket or self.websocket.closed:
                    if await self.connect():
                        continue
                    else:
                        await asyncio.sleep(self.reconnect_interval)
                        continue

                message = await self.websocket.recv()
                data = json.loads(message)

                # Handle welcome message
                if data.get("type") == "welcome":
                    self.client_id = data.get("client_id")
                    self.logger.info(f"Received client ID: {self.client_id}")

                # Process message with handler
                await message_handler(data)

            except websockets.exceptions.ConnectionClosed:
                self.logger.warning("Connection closed, attempting reconnection")
                self.websocket = None
                await asyncio.sleep(self.reconnect_interval)

            except json.JSONDecodeError as e:
                self.logger.error(f"Invalid JSON received: {e}")

            except Exception as e:
                self.logger.error(f"Error receiving message: {e}")
                await asyncio.sleep(1)

    async def start(self, message_handler: Callable):
        """Start the client with automatic reconnection"""
        self.running = True
        await self.receive_messages(message_handler)

# Example usage
async def handle_message(data: dict):
    print(f"Received: {data}")

async def main():
    client = WebSocketClient("ws://localhost:8765")

    # Start receiving messages in background
    receive_task = asyncio.create_task(client.start(handle_message))

    # Send some messages
    await asyncio.sleep(1)
    await client.send_message({"type": "broadcast", "content": "Hello, World!"})

    # Keep running
    await receive_task

if __name__ == "__main__":
    asyncio.run(main())
```

## Integration with Web Frameworks

Python's web frameworks provide excellent WebSocket support. Here's how to
integrate WebSockets with FastAPI, one of the most modern Python web frameworks.

FastAPI's WebSocket support represents the modern approach to building real-time
web applications in Python. Unlike older frameworks that required complex
configuration or third-party extensions, FastAPI provides native WebSocket
support with automatic documentation generation and type validation. This
integration makes it easy to build APIs that combine traditional HTTP endpoints
with real-time WebSocket functionality, enabling hybrid applications that serve
both traditional web requests and real-time updates from a single codebase.

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json
from typing import List

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/")
async def get():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Chat</title>
    </head>
    <body>
        <h1>WebSocket Chat</h1>
        <form id="messageForm">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send</button>
        </form>
        <ul id="messages"></ul>
        <script>
            const ws = new WebSocket("ws://localhost:8000/ws/client123");

            ws.onmessage = function(event) {
                const messages = document.getElementById('messages');
                const message = document.createElement('li');
                message.textContent = event.data;
                messages.appendChild(message);
            };

            document.getElementById("messageForm").onsubmit = function(event) {
                event.preventDefault();
                const input = document.getElementById("messageText");
                ws.send(input.value);
                input.value = '';
            };
        </script>
    </body>
    </html>
    """)

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    await manager.broadcast(f"Client #{client_id} joined the chat")

    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"Client #{client_id}: {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client #{client_id} left the chat")
```

## Performance Optimization

Python WebSocket applications can achieve excellent performance with proper
optimization. Key strategies include using connection pooling, implementing
efficient message serialization, and leveraging async I/O effectively.

Performance optimization in Python WebSocket applications often focuses on
minimizing the overhead of the async event loop and optimizing message
processing pipelines. Techniques like message batching, where multiple small
messages are combined into larger payloads, can significantly reduce the
per-message overhead. Similarly, using binary message formats like MessagePack
or Protocol Buffers instead of JSON can provide substantial performance
improvements, especially for high-frequency applications.

Memory management is crucial for long-running WebSocket servers. Use weak
references for client tracking when appropriate, implement message size limits,
and regularly clean up disconnected clients. Python's garbage collector handles
most memory management automatically, but being mindful of reference cycles and
large data structures can prevent memory leaks. For applications handling
thousands of connections, monitoring memory usage patterns and implementing
connection limits can prevent resource exhaustion and ensure stable operation
under varying load conditions.

## Testing WebSocket Applications

Comprehensive testing ensures reliability. Python's unittest and pytest
frameworks, combined with websockets testing utilities, provide excellent
testing capabilities.

```python
import pytest
import asyncio
import websockets
import json

@pytest.mark.asyncio
async def test_websocket_connection():
    """Test basic WebSocket connection"""
    uri = "ws://localhost:8765"

    async with websockets.connect(uri) as websocket:
        # Test connection
        assert websocket.open

        # Test sending message
        await websocket.send(json.dumps({"type": "ping"}))

        # Test receiving message
        response = await websocket.recv()
        data = json.loads(response)
        assert data["type"] == "welcome"

@pytest.mark.asyncio
async def test_broadcast_message():
    """Test message broadcasting"""
    uri = "ws://localhost:8765"

    # Connect two clients
    async with websockets.connect(uri) as ws1, websockets.connect(uri) as ws2:
        # Client 1 sends broadcast
        await ws1.send(json.dumps({
            "type": "broadcast",
            "content": "Test message"
        }))

        # Client 2 should receive the message
        response = await ws2.recv()
        data = json.loads(response)
        assert data["type"] == "message"
        assert data["content"] == "Test message"
```

## Production Deployment

Deploying Python WebSocket applications requires careful consideration of server
configuration, process management, and monitoring. Use production-grade ASGI
servers like Uvicorn or Daphne for serving WebSocket applications. Implement
proper logging, monitoring, and alerting to maintain system health.

Container deployment with Docker simplifies deployment and scaling. Use process
managers like systemd or supervisor to ensure your WebSocket server stays
running. Implement health checks that verify WebSocket connectivity, not just
HTTP endpoints.

## Security Best Practices

Security is paramount in WebSocket applications. Implement proper authentication
using JWT tokens or session-based authentication. Validate all incoming messages
and implement rate limiting to prevent abuse. Use WSS (WebSocket Secure) in
production to encrypt all communication.

Origin validation prevents cross-site WebSocket hijacking. Always validate the
Origin header during the handshake phase. Implement message size limits to
prevent memory exhaustion attacks. Use parameterized queries when integrating
with databases to prevent SQL injection.

## Conclusion

Python provides an excellent platform for building WebSocket applications,
combining ease of development with good performance. The rich ecosystem of
libraries and frameworks makes it possible to build everything from simple chat
applications to complex real-time data processing systems. With proper
architecture, testing, and deployment practices, Python WebSocket applications
can scale to handle thousands of concurrent connections while maintaining code
readability and maintainability.

## Python's Unique Position in the WebSocket Ecosystem

Python occupies a unique position in the WebSocket ecosystem, bridging the gap
between rapid prototyping and production deployment. The language's extensive
scientific computing libraries make it particularly valuable for WebSocket
applications that involve real-time data analysis or machine learning. Imagine a
WebSocket server that not only handles connections but also performs real-time
sentiment analysis on chat messages using natural language processing libraries,
or one that streams live predictions from a machine learning model.

The Python Package Index (PyPI) contains thousands of packages that can enhance
WebSocket applications. From authentication libraries to database connectors,
from monitoring tools to message queue integrations, Python's ecosystem provides
pre-built solutions for common challenges. This rich ecosystem means that Python
WebSocket applications can quickly incorporate sophisticated functionality that
would take significantly longer to implement in lower-level languages.

Furthermore, Python's popularity in education and research means that there's a
constant influx of developers familiar with the language. This talent
availability is a significant consideration for organizations building real-time
applications, as it affects both initial development and long-term maintenance
costs.

## Frequently Asked Questions

### What is the best Python WebSocket library?

The websockets library is the most popular choice for async Python WebSocket
applications. It supports asyncio natively and handles the protocol correctly.
For Django, use Django Channels. For FastAPI, use its built-in WebSocket
support.

### How do I handle reconnection in a Python WebSocket client?

Implement a reconnection loop with exponential backoff. Catch ConnectionClosed
exceptions, wait with increasing delays, then call connect() again. Queue
messages during disconnection so they can be sent once the connection is
restored.

### Can Python handle thousands of WebSocket connections?

Yes. Python asyncio can handle thousands of concurrent WebSocket connections in
a single process because WebSocket workloads are I/O-bound. The event loop
efficiently multiplexes connections without needing one thread per connection.

### How do I add WebSockets to a Django application?

Use Django Channels, which extends Django to handle WebSockets and other async
protocols. It adds a channel layer (typically backed by Redis) for message
routing between consumers. Install channels, configure ASGI, and create
WebSocket consumers.

## Related Content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) -
  The protocol underlying all WebSocket libraries
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) -
  Browser API reference for client-side WebSocket code
- [WebSocket Libraries, Tools & Specs by Language](/resources/websocket-resources/) -
  Curated list of libraries across all languages
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  for scaling Python WebSocket servers
- [WebSocket Close Codes](/reference/close-codes/) - Understanding close codes
  for error handling
