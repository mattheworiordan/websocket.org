---
title: 'Python WebSocket Server & Client Guide with asyncio'
description:
  'Build Python WebSocket servers using the websockets library. Production
  examples with reconnection, error handling, deployment with Docker and
  systemd.'
sidebar:
  order: 2
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2024-09-02'
lastUpdated: 2026-03-14
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
      'The websockets library is the default for async Python WebSocket servers
      and clients. It handles the protocol correctly and works with asyncio out
      of the box. For Django, use Django Channels. For FastAPI, use its built-in
      WebSocket support.'
  - q: 'How do I handle reconnection in a Python WebSocket client?'
    a:
      'Wrap your connection in a loop with exponential backoff and jitter. Catch
      ConnectionClosed exceptions, wait with increasing delays capped at 30
      seconds, then reconnect. Queue messages during disconnection if you need
      guaranteed delivery.'
  - q: 'Can Python handle thousands of WebSocket connections?'
    a:
      'Yes. Asyncio multiplexes connections on a single thread with no
      thread-per-connection overhead. A single process handles roughly 10K
      concurrent connections. Use uvloop to double that, then scale with
      multiple workers.'
  - q: 'How do I deploy a Python WebSocket server in production?'
    a:
      'Run uvicorn with multiple workers behind a reverse proxy like Nginx.
      Use systemd for process management, or Docker for containerized
      deployments. Each worker gets its own event loop and connection set.'
---

:::note[Quick Answer]
Use the **websockets** library. Install with
`pip install websockets`, create a server with `websockets.serve()`,
connect from clients with `websockets.connect()`. For Django, use
**Django Channels**. For FastAPI, use its built-in WebSocket support.
:::

The `websockets` library is the default choice for Python WebSocket
work. It handles the protocol correctly, integrates with asyncio, and
stays out of your way. The trade-off: it's pure Python, so you'll hit
a throughput ceiling around 10K concurrent connections per core. For
most applications, that's fine.

## Server with echo and broadcast

This server tracks connected clients, echoes messages back, and
broadcasts to all others. The `finally` block matters -- without it,
crashed connections leak memory because the client set grows forever.

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
            await websocket.send(f"echo: {message}")
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

    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("Server running on ws://0.0.0.0:8765")
        await stop  # Run until SIGTERM

if __name__ == "__main__":
    asyncio.run(main())
```

`websockets.broadcast()` sends to multiple clients concurrently and
silently drops failed sends. The signal handler gives you graceful
shutdown -- connections finish their current message before closing.
Bind to `0.0.0.0`, not `localhost`, or Docker and reverse proxies
can't reach it.

## Client with reconnection

Clients disconnect. Networks fail. Mobile devices switch from Wi-Fi
to cellular. Your client must handle this without losing the user's
session.

The pattern below uses exponential backoff with jitter and a cap.
Without the cap, a client offline for an hour would wait over 30
minutes before retrying. Without jitter, all clients reconnect at
the same instant after an outage -- a thundering herd that can take
down your server.

```python
import asyncio
import websockets
import random

async def connect_with_backoff(uri):
    delay = 1
    while True:
        try:
            async with websockets.connect(uri) as ws:
                delay = 1  # Reset on success
                async for message in ws:
                    print(f"Received: {message}")
        except (websockets.ConnectionClosed, OSError) as e:
            jitter = random.uniform(0, delay * 0.5)
            wait = min(delay + jitter, 30)
            print(f"Disconnected ({e}), retry in {wait:.1f}s")
            await asyncio.sleep(wait)
            delay = min(delay * 2, 30)

asyncio.run(connect_with_backoff("ws://localhost:8765"))
```

Note what this doesn't do: it doesn't queue messages during
disconnection, track acknowledgments, or resume from where it left
off. For a chat app demo, that's fine. For a product where dropped
messages mean angry users, you need a protocol layer on top (see
[the protocol gap](#the-protocol-gap)).

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

Run with `uvicorn app:app --workers 4`. Each worker is a separate
process with its own connection set, so clients on different workers
can't see each other. You need Redis or NATS as a pub/sub bridge
to broadcast across workers. This is a fundamental limitation of
multi-process Python, not a FastAPI issue.

## Python-specific gotchas

**The GIL doesn't matter for WebSockets.** WebSocket workloads are
I/O-bound. The GIL blocks CPU-bound threads, but asyncio doesn't
use threads for I/O. However, if you do CPU-heavy work per message
(image processing, ML inference), the GIL serializes that work.
Offload it to a process pool:

```python
from concurrent.futures import ProcessPoolExecutor
import asyncio

pool = ProcessPoolExecutor(max_workers=4)

async def handler(websocket):
    async for message in websocket:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            pool, cpu_heavy_work, message
        )
        await websocket.send(result)
```

**Don't mix `asyncio.run()` with existing event loops.** If you're
inside a Jupyter notebook, Django, or any framework that already runs
an event loop, calling `asyncio.run()` throws `RuntimeError`. Use
`await` directly or `asyncio.ensure_future()` instead.

**Thread safety: asyncio objects are not thread-safe.** If you call
`websocket.send()` from a thread (a Django view, a Celery task),
it will silently corrupt state. Use `asyncio.run_coroutine_threadsafe()`
to schedule work on the event loop from another thread:

```python
asyncio.run_coroutine_threadsafe(
    websocket.send("from thread"), loop
)
```

**Throughput ceiling is around 10K concurrent connections per core**
with the standard event loop. Install `uvloop` to roughly double that:

```python
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
```

Beyond that, you need multiple worker processes.

## Deployment

A WebSocket server on localhost is a demo. Here's how to run one
in production.

**systemd** -- the simplest option for a single server:

```ini
[Unit]
Description=WebSocket Server
After=network.target

[Service]
User=www-data
ExecStart=/usr/bin/python3 /opt/wsserver/server.py
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

`LimitNOFILE` matters -- the default of 1024 means you can't hold
more than ~1000 connections. Set it to at least 65535 for any
real workload.

**Docker** -- for containerized deployments:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8765
CMD ["python", "server.py"]
```

Run with `docker run -p 8765:8765 --ulimit nofile=65535:65535`.
The `--ulimit` flag is the Docker equivalent of `LimitNOFILE`.

**Nginx reverse proxy** -- you need this in front of your WebSocket
server to handle TLS termination:

```nginx
location /ws {
    proxy_pass http://127.0.0.1:8765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

The `proxy_read_timeout` is critical. Nginx defaults to 60 seconds,
and it will close idle WebSocket connections after that. Set it to
86400 (24 hours) or configure application-level pings.

## The protocol gap

WebSockets give you a bidirectional byte pipe. Nothing more. In
production, you quickly discover you need:

- **Message continuity** -- the client reconnects, but what about
  the messages it missed?
- **Acknowledgment** -- did the server actually process this?
- **Presence** -- who's connected right now?
- **Auth** -- how do you validate tokens before accepting
  the upgrade?

You can build all of this. Many teams do, and then spend months
maintaining it. The open-source option is
[Socket.IO](https://socket.io/), which handles reconnection and
rooms. For a managed approach,
[Ably](https://ably.com/?utm_source=websocket-org&utm_medium=python-guide)
handles reconnection with message resume, presence, and guaranteed
delivery without you operating the infrastructure.

For a hackathon, raw `websockets` is fine. For a product with users
who notice dropped messages, you need something on top.

## When not to use Python

Python works well for WebSocket servers up to moderate scale. Beyond
about 50K concurrent connections per server, look at Go or Rust --
both handle hundreds of thousands of connections per process with
lower memory overhead (~2KB per goroutine vs ~8KB per asyncio task).

The other case: if your message processing is CPU-bound (video
transcoding, heavy computation per message), Python's per-message
overhead hurts. Use Python as the coordination layer and offload
heavy work to a compiled service.

## Frequently asked questions

### What is the best Python WebSocket library?

Use `websockets` for standalone async servers and clients. It has the
largest community, correct protocol handling, and clean asyncio
integration. For Django projects, use Django Channels -- it plugs
into Django's ORM and auth system. For FastAPI, use the built-in
WebSocket support (Starlette underneath). Avoid `python-websocket`
(the older synchronous library) for new projects -- it blocks on
every operation and can't handle concurrent connections efficiently.

### How do I handle reconnection in Python?

Wrap your connection in a loop with exponential backoff, as shown
in the [client example](#client-with-reconnection) above. The
details most tutorials skip: cap your backoff at 30 seconds
(otherwise clients wait forever), add jitter (otherwise all clients
reconnect simultaneously after an outage and create a thundering
herd), and decide what to do about messages missed during
disconnection. If you need guaranteed delivery, you need a protocol
layer like Socket.IO or
[Ably](https://ably.com/?utm_source=websocket-org&utm_medium=python-guide)
that tracks message history and resumes from the last received
message.

### Can Python handle thousands of WebSocket connections?

Yes. Asyncio multiplexes connections on a single thread -- no
thread-per-connection overhead. A single process handles roughly
10K concurrent connections before you hit the event loop's
throughput limit. Use `uvloop` to push that higher. Beyond that,
run multiple worker processes behind a load balancer. The
bottleneck is rarely connection count itself -- it's what you do
per message. Routing JSON is fine. Heavy computation per message
is where Python slows down.

### How do I deploy a Python WebSocket server in production?

Run your server behind Nginx for TLS termination and use systemd
or Docker for process management. Key details people miss: set
`LimitNOFILE` to at least 65535 (the default 1024 caps you at
~1000 connections), set Nginx's `proxy_read_timeout` to 86400
(the 60-second default kills idle WebSocket connections), and bind
to `0.0.0.0` not `localhost` (or containers and proxies can't
reach it). See the [deployment section](#deployment) for configs.

## Related content

- [WebSocket Protocol: RFC 6455 Handshake, Frames & More](/guides/websocket-protocol/) --
  The protocol underlying all WebSocket libraries
- [WebSocket API: Events, Methods & Properties](/reference/websocket-api/) --
  Browser API reference for client-side WebSocket code
- [WebSocket Libraries, Tools & Specs by Language](/resources/websocket-resources/) --
  Curated list of libraries across all languages
- [WebSockets at Scale](/guides/websockets-at-scale/) -- Architecture patterns
  for scaling Python WebSocket servers
- [WebSocket Close Codes](/reference/close-codes/) -- Understanding close
  codes for error handling
