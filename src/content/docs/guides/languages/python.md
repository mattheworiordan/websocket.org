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

:::note[Quick Answer]
Use the **websockets** library for async Python WebSocket
apps. Install with `pip install websockets`, create a server with
`websockets.serve()`, and connect from clients with `websockets.connect()`. For
Django, use **Django Channels**. For FastAPI, use its built-in WebSocket
support.
:::

The `websockets` library is the default choice for async Python WebSocket work.
It handles the protocol correctly, integrates with asyncio, and stays out of
your way. If you're already in Django, use Django Channels. If you're in
FastAPI, use its built-in WebSocket support. Here's a server:

## Server with echo and broadcast

This server tracks connected clients, echoes messages back, and broadcasts to
all others. The `finally` block matters: without it, crashed connections leak
memory because the client set grows forever.

```python
import asyncio
import websockets
import json
import signal

CLIENTS = set()

async def handler(websocket):
    CLIENTS.add(websocket)
    try:
        async for message in websocket:
            # Echo back to sender
            await websocket.send(f"echo: {message}")

            # Broadcast to everyone else
            others = CLIENTS - {websocket}
            data = json.dumps({"from": id(websocket), "msg": message})
            websockets.broadcast(others, data)
    except websockets.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(websocket)

async def main():
    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

    async with websockets.serve(handler, "localhost", 8765):
        await stop  # Run until SIGTERM

if __name__ == "__main__":
    asyncio.run(main())
```

Key details: `websockets.broadcast()` is a library helper that sends to
multiple clients concurrently and silently drops failed sends. The signal
handler gives you graceful shutdown instead of killing connections mid-message.

## Client with reconnection

Clients disconnect. Networks fail. Mobile devices switch from Wi-Fi to
cellular. Your client needs to handle all of this without losing messages.

The pattern below uses exponential backoff with a cap. Without the cap,
a client that's been offline for an hour would wait over 30 minutes before
its next retry.

```python
import asyncio
import websockets
import random

async def connect_with_backoff(uri):
    delay = 1
    while True:
        try:
            async with websockets.connect(uri) as ws:
                delay = 1  # Reset on successful connection
                print("Connected")
                async for message in ws:
                    print(f"Received: {message}")
        except (websockets.ConnectionClosed, OSError) as e:
            jitter = random.uniform(0, delay * 0.5)
            wait = min(delay + jitter, 30)  # Cap at 30s
            print(f"Disconnected ({e}), retrying in {wait:.1f}s")
            await asyncio.sleep(wait)
            delay = min(delay * 2, 30)

asyncio.run(connect_with_backoff("ws://localhost:8765"))
```

Note what this doesn't do: it doesn't queue messages during disconnection,
it doesn't track which messages the server acknowledged, and it doesn't
resume from where it left off. These are real problems in production, which
is why most teams end up adding a protocol layer on top (see
[the protocol gap](#the-protocol-gap) below).

## FastAPI integration

If you're already using FastAPI, don't add the `websockets` library
separately. FastAPI has built-in WebSocket support through Starlette.

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()
clients: list[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            for client in clients:
                if client != websocket:
                    await client.send_text(data)
    except WebSocketDisconnect:
        clients.remove(websocket)
```

Run with `uvicorn app:app`. In production, run multiple workers behind a
load balancer: `uvicorn app:app --workers 4`. Each worker gets its own
process and its own set of WebSocket connections, so you'll need an
external pub/sub layer (Redis, NATS) to broadcast across workers.

## The protocol gap

WebSockets give you a bidirectional pipe. That's it. In practice, you
quickly discover you need things on top of that pipe:

- **Reconnection with message continuity** -- the client reconnects, but
  what about the 14 messages it missed while offline?
- **Message acknowledgment** -- did the server actually process this, or
  did it vanish?
- **Presence** -- who else is connected right now?
- **Authentication handshake** -- how do you validate tokens before
  accepting the WebSocket upgrade?

You can build these yourself. Many teams do, and then spend months
maintaining them. The open-source option is
[Socket.IO](https://socket.io/), which handles reconnection,
namespaces, and rooms. For a managed service,
[Ably](https://ably.com/?utm_source=websocket-org&utm_medium=python-websocket)
handles reconnection with message resume, presence, authentication, and
guaranteed delivery -- so you don't have to build or operate the
infrastructure yourself.

The decision depends on your scale and how much operational overhead
you want to own. For a hackathon, raw `websockets` is fine. For a
product with users who will complain about dropped messages, you need
a protocol layer.

## Python-specific gotchas

**The GIL doesn't matter for WebSockets.** WebSocket workloads are
I/O-bound. The GIL only blocks CPU-bound threads, and asyncio doesn't
use threads for I/O. However, if you're doing CPU-heavy work per message
(image processing, ML inference), the GIL will serialize that work.
Offload it to a process pool:

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

pool = ProcessPoolExecutor(max_workers=4)

async def handler(websocket):
    async for message in websocket:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(pool, cpu_heavy_work, message)
        await websocket.send(result)
```

**Throughput ceiling is around 10K concurrent connections per core** with
the standard asyncio event loop. For more, install `uvloop`:

```python
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
```

This typically doubles throughput. Beyond that, you're hitting Python's
per-process limits and need to run multiple worker processes.

**Deployment: use uvicorn with multiple workers.** A single Python
process cannot use multiple CPU cores. Run
`uvicorn app:app --workers $(nproc)` to get one process per core.
Each process handles its own connections independently.

## When not to use Python

Python is a good default for WebSocket servers up to moderate scale.
But if you need more than about 50K concurrent connections per server,
look at Go or Rust. Both handle hundreds of thousands of connections per
process with lower memory overhead.

The other case: if your message processing is CPU-bound (video
transcoding, heavy computation per message), Python's per-message
overhead will hurt. Use Python as the coordination layer and offload
the heavy work to a compiled language or a separate service.

## Frequently asked questions

### What is the best Python WebSocket library?

Use `websockets` for standalone async servers and clients. It has the
largest community, correct protocol handling, and clean asyncio
integration. For Django projects, use Django Channels -- it plugs into
Django's ORM and auth system. For FastAPI, use the built-in WebSocket
support (it's Starlette underneath). Don't use `python-websocket` (the
older synchronous library) for new projects -- it blocks on every
operation and can't handle concurrent connections.

### How do I handle reconnection in Python?

Wrap your connection in a loop with exponential backoff, as shown in
the [client example](#client-with-reconnection) above. The critical
details most tutorials skip: cap your backoff (otherwise clients wait
forever), add jitter (otherwise all clients reconnect at the same
instant after an outage), and decide what to do about messages missed
during disconnection. If you need guaranteed delivery, you need a
protocol layer like Socket.IO or
[Ably](https://ably.com/?utm_source=websocket-org&utm_medium=python-websocket)
that tracks message history.

### Can Python handle thousands of WebSocket connections?

Yes. Asyncio multiplexes connections on a single thread, so there's
no thread-per-connection overhead. A single process can handle roughly
10K concurrent connections before you hit the event loop's throughput
limit. Use `uvloop` to push that higher. Beyond that, run multiple
worker processes behind a load balancer. The constraint is rarely
the connection count itself -- it's what you do per message. If
you're just routing JSON, Python handles it fine. If you're doing
heavy computation per message, that's where it slows down.

### How do I add WebSockets to a Django application?

Install `channels` and `channels-redis`. Configure `ASGI_APPLICATION`
in settings, create a routing configuration, and write a consumer class
that extends `AsyncWebsocketConsumer`. The channel layer (backed by
Redis) handles pub/sub between consumers. Django Channels is the only
option that integrates with Django's auth, sessions, and ORM -- don't
try to bolt the `websockets` library onto a Django project directly.

## Related content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) --
  The protocol underlying all WebSocket libraries
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) --
  Browser API reference for client-side WebSocket code
- [WebSocket Libraries, Tools & Specs by Language](/resources/websocket-resources/) --
  Curated list of libraries across all languages
- [WebSockets at Scale](/guides/websockets-at-scale/) -- Architecture patterns
  for scaling Python WebSocket servers
- [WebSocket Close Codes](/reference/close-codes/) -- Understanding close codes
  for error handling
