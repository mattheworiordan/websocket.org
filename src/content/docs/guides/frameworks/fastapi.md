---
title: 'WebSocket with FastAPI: Async Connections & Scaling'
description:
  'Build WebSocket servers with FastAPI using Starlette. Connection
  management, authentication, multi-worker scaling with Redis,
  and production deployment.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-23
lastUpdated: 2026-03-23
category: guide
keywords:
  - fastapi websocket
  - fastapi websocket server
  - starlette websocket
  - python websocket async
  - fastapi realtime
seo:
  keywords:
    - fastapi websocket
    - fastapi websocket server
    - starlette websocket
    - fastapi websocket authentication
    - uvicorn websocket
    - fastapi websocket redis
    - python async websocket
faq:
  - q: 'Does FastAPI support WebSockets natively?'
    a:
      'Yes. FastAPI inherits WebSocket support from Starlette. You define
      endpoints with @app.websocket, accept connections, and send/receive
      messages with async/await. No extra library is needed beyond
      FastAPI itself.'
  - q: 'How do I authenticate WebSocket connections in FastAPI?'
    a:
      'Use query parameters or cookie-based auth. Browsers cannot set
      custom headers on WebSocket connections, so token-in-header
      approaches fail. Validate credentials after accept() or use
      a first-message authentication pattern for sensitive applications.'
  - q: 'Can FastAPI handle multiple WebSocket workers?'
    a:
      'Uvicorn workers do not share memory. Each worker has its own
      connection set, so broadcasting to all clients requires an external
      message broker like Redis pub/sub. Run a single async worker for
      simple apps, or add Redis when you need horizontal scaling.'
  - q: 'How do I test FastAPI WebSocket endpoints?'
    a:
      'Use Starlette TestClient with the websocket_connect context
      manager. It creates an in-process connection without needing a
      running server. Assert on received messages and test disconnection
      handling with explicit close calls.'
  - q: 'When should I use a managed service instead of FastAPI WebSockets?'
    a:
      'When you need rooms, presence, message history, or guaranteed
      delivery. FastAPI gives you raw connections. Building pub/sub
      routing, connection state recovery, and multi-region failover on
      top of it is months of work. Services like Ably or Pusher handle
      this out of the box.'
---

:::note[Quick Answer]
FastAPI has built-in WebSocket support via Starlette. Define an
endpoint with `@app.websocket("/ws")`, call `await websocket.accept()`,
then loop over `receive_text()` and `send_text()`. No extra library
needed. For multi-worker deployments, add Redis pub/sub --- Uvicorn
workers do not share memory, so in-process state is per-worker only.
:::

FastAPI gets WebSocket support from Starlette, and it works well
for most real-time use cases. You get async/await, dependency
injection, and the same routing you already know. The catch:
FastAPI gives you raw connections, not a messaging system. There
are no rooms, no presence, no message history. You build those
yourself or reach for a managed service.

## Basic WebSocket endpoint

Every FastAPI WebSocket endpoint follows the same pattern: accept
the connection, loop over incoming messages, handle disconnection.
The `WebSocketDisconnect` exception is how Starlette tells you the
client is gone.

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        print("Client disconnected")
```

That `try/except` is not optional. Without it, a client closing
their browser tab crashes the handler with an unhandled exception.
Every WebSocket endpoint needs this pattern.

## Connection manager for broadcasting

The moment you need to send a message to multiple clients, you need
to track connections. This pattern shows up in every FastAPI WebSocket
tutorial, but most skip the error handling that matters in production.

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active.remove(websocket)

    async def broadcast(self, message: str):
        dead = []
        for conn in self.active:
            try:
                await conn.send_text(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.active.remove(conn)

manager = ConnectionManager()
```

The `broadcast` method catches send failures and cleans up dead
connections. Without this, a single disconnected client that hasn't
triggered `WebSocketDisconnect` yet blocks the entire broadcast
loop. This happens more than you'd think -- mobile clients on
flaky networks go silent without closing the connection.

```python
@app.websocket("/ws/chat")
async def chat(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

## Authentication

Browsers cannot set custom headers on WebSocket connections. This
catches every developer who tries to reuse their HTTP Bearer token
pattern. You have three options, and they're not equally good.

**Query parameters** -- the simplest approach. The token appears in
server logs and browser history, so use short-lived tokens:

```python
@app.websocket("/ws")
async def authenticated_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not verify_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    # ... handle messages
```

**Cookies** work if your frontend and WebSocket server share a
domain. The browser sends cookies automatically on the upgrade
request. This is the best option for same-origin applications.

**First-message auth** -- accept the connection, then require the
first message to be a credentials payload. Reject and close if
it's invalid. This is the most flexible approach but adds latency:

```python
@app.websocket("/ws")
async def first_message_auth(websocket: WebSocket):
    await websocket.accept()
    try:
        auth_msg = await asyncio.wait_for(
            websocket.receive_json(), timeout=5.0
        )
        if not verify_credentials(auth_msg):
            await websocket.close(code=4001)
            return
    except asyncio.TimeoutError:
        await websocket.close(code=4002, reason="Auth timeout")
        return
    # Authenticated -- proceed with message loop
```

For most applications, query params with a short-lived JWT is the
right call. It's simple, stateless, and the token expires before
log rotation matters.

## Dependency injection in WebSocket routes

FastAPI's dependency injection works in WebSocket routes, but with
a key difference: you can't return HTTP error responses. If a
dependency raises `HTTPException`, it won't produce a nice JSON
error -- it'll crash the WebSocket handler.

```python
from fastapi import Depends, Query

async def get_user(token: str = Query(None)):
    if not token:
        return None
    return await lookup_user(token)

@app.websocket("/ws")
async def ws_with_deps(
    websocket: WebSocket,
    user=Depends(get_user),
):
    if user is None:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    # user is available here
```

Handle validation failures by closing the WebSocket with a custom
close code, not by raising exceptions. Custom codes in the
4000-4999 range are reserved for application use -- define a clear
set and document them.

## Background tasks with WebSocket connections

Sometimes you need to push data to a client without waiting for
them to send a message first -- stock prices, notifications, or
sensor readings. Use `asyncio.create_task` to run a producer
alongside the receive loop.

```python
import asyncio

@app.websocket("/ws/feed")
async def live_feed(websocket: WebSocket):
    await websocket.accept()

    async def send_updates():
        while True:
            data = await get_latest_data()
            await websocket.send_json(data)
            await asyncio.sleep(1)

    task = asyncio.create_task(send_updates())
    try:
        while True:
            msg = await websocket.receive_text()
            # Handle client commands
    except WebSocketDisconnect:
        task.cancel()
```

The `task.cancel()` in the except block is critical. Without it,
the background task keeps running after the client disconnects,
trying to send to a dead connection and leaking resources. This
is one of the most common FastAPI WebSocket bugs.

## Multi-worker scaling with Redis

Here's where most FastAPI WebSocket tutorials fall apart. Run
`uvicorn main:app --workers 4` and your connection manager breaks
immediately. Each worker process has its own memory. Client A
connects to worker 1, client B connects to worker 3 -- the
broadcast method in worker 1 has no idea client B exists.

The fix is Redis pub/sub as a message bus between workers:

```python
import redis.asyncio as redis

class RedisConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.redis = redis.from_url("redis://localhost")
        self.pubsub = self.redis.pubsub()

    async def start(self):
        await self.pubsub.subscribe("chat")
        asyncio.create_task(self._relay())

    async def _relay(self):
        async for msg in self.pubsub.listen():
            if msg["type"] == "message":
                data = msg["data"].decode()
                for conn in self.active:
                    try:
                        await conn.send_text(data)
                    except Exception:
                        self.active.remove(conn)

    async def publish(self, message: str):
        await self.redis.publish("chat", message)
```

Every worker subscribes to the same Redis channel. When any worker
receives a message from a client, it publishes to Redis. Every
worker then relays it to their local connections. This pattern
scales horizontally, but it adds a dependency and ~1ms latency
per message.

## Testing WebSocket endpoints

Starlette's `TestClient` handles WebSocket testing without needing
a running server. The `websocket_connect` context manager gives
you a test WebSocket you can send to and receive from:

```python
from fastapi.testclient import TestClient

def test_echo():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text("hello")
        data = ws.receive_text()
        assert data == "Echo: hello"

def test_disconnect_cleanup():
    client = TestClient(app)
    with client.websocket_connect("/ws/chat") as ws:
        ws.send_text("join")
    # Connection closed on context exit
    assert len(manager.active) == 0
```

Test the unhappy paths too: authentication failures, malformed
messages, disconnections mid-broadcast. The bugs you'll find in
production are almost never in the happy path.

## Performance tuning

FastAPI's async model means a single worker can handle thousands
of concurrent WebSocket connections -- as long as you don't block
the event loop. One synchronous database call blocks every
connection on that worker.

**Use uvloop** for a free performance boost. It replaces the
default asyncio event loop with a libuv-based implementation and
roughly doubles throughput:

```bash
pip install uvloop
uvicorn main:app --loop uvloop
```

**Single worker vs. multiple workers**: A single async worker with
uvloop handles ~10K concurrent connections on a modern server. If
you need more, add workers -- but then you need Redis for state
sharing. Start with one worker. Add complexity when you have the
traffic to justify it.

**Avoid these common blockers**:

- Synchronous ORM calls in WebSocket handlers (use async drivers)
- `time.sleep()` instead of `asyncio.sleep()`
- CPU-heavy work in the event loop (offload to a thread pool)
- Large message serialization on the main thread

## When FastAPI WebSockets aren't enough

FastAPI gives you a WebSocket transport layer. That's it. You
write the messaging logic, connection tracking, authentication,
error recovery, and scaling infrastructure yourself. For a chat
between two users, that's fine. For anything more, you're building
a real-time messaging platform from scratch.

Signs you've outgrown raw WebSocket endpoints:

- You're building room/channel routing logic
- You need message history or delivery guarantees
- Clients need to know who else is connected (presence)
- You're managing WebSocket state across multiple regions
- Connection recovery after deploys requires custom code

At that point, you want a purpose-built service.
[Ably](https://ably.com/docs/api/realtime-sdk?utm_source=websocket-org&utm_medium=fastapi)
handles pub/sub, presence, message history, and multi-region
failover. [Pusher](https://pusher.com/) and
[PubNub](https://www.pubnub.com/) cover similar ground. The cost
of these services is almost always less than the engineering time
to build and maintain the equivalent functionality yourself.

## Frequently Asked Questions

### Does FastAPI support WebSockets natively?

Yes, and this confuses people because the support comes from
Starlette, not FastAPI itself. FastAPI is built on top of
Starlette, which implements the ASGI spec including WebSocket
handling. You don't install anything extra -- `pip install fastapi`
gives you everything. The `@app.websocket()` decorator, the
`WebSocket` object, and `WebSocketDisconnect` are all re-exported
from Starlette. This matters when you're debugging: the actual
WebSocket implementation code lives in the
[Starlette repository](https://github.com/encode/starlette),
not FastAPI's.

### How do I authenticate WebSocket connections in FastAPI?

The browser WebSocket API does not support custom headers. This
means your `Authorization: Bearer <token>` pattern from HTTP
endpoints won't work. Use query parameters with a short-lived
token (`ws://host/ws?token=xyz`), cookies if you control the
domain, or a first-message pattern where the client sends
credentials as the first payload after connection. Query params
are the most common approach in practice. The token shows up in
logs, so keep its lifetime short -- 60 seconds is enough for the
connection handshake.

### Can FastAPI handle multiple WebSocket workers?

Uvicorn workers are separate OS processes with isolated memory.
Your in-memory `ConnectionManager` only knows about connections
to its own worker. To broadcast across all workers, add Redis
pub/sub as a message bus. Each worker subscribes to a Redis
channel and relays messages to its local connections. This adds
roughly 1ms of latency but lets you scale horizontally. For
applications under 10K connections, a single async worker with
uvloop is simpler and performs well.

### How do I test FastAPI WebSocket endpoints?

Use `TestClient` from `fastapi.testclient` (which wraps
Starlette's test client). Call `client.websocket_connect("/ws")`
as a context manager. Inside the block, use `ws.send_text()` and
`ws.receive_text()` to interact with your endpoint. The test
runs in-process with no network involved. Test disconnection by
exiting the context manager and verify your cleanup logic runs.
Test auth failures by connecting without valid credentials and
asserting the connection closes with the expected code.

### When should I use a managed service instead of FastAPI?

When you catch yourself building infrastructure instead of
features. If you're writing code for room management, presence
tracking, message ordering, delivery confirmation, or
reconnection with state recovery -- stop. You're building a
real-time platform, not a feature. Services like Ably, Pusher,
and PubNub exist because this infrastructure is genuinely hard
to get right at scale, especially across multiple regions and
during partial failures.

## Related Content

- [Python WebSocket Guide](/guides/languages/python/) --
  The `websockets` library for standalone Python servers
- [WebSocket Authentication](/guides/authentication/) --
  Token patterns and security for WebSocket connections
- [WebSockets at Scale](/guides/websockets-at-scale/) --
  Horizontal scaling, load balancing, and state management
- [WebSocket Reconnection](/guides/reconnection/) --
  Exponential backoff and connection recovery patterns
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/) --
  Reverse proxy setup for WebSocket servers
