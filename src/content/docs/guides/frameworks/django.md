---
title: 'WebSocket with Django Channels: ASGI Setup & Deployment'
description:
  'Add WebSocket support to Django with Channels. ASGI setup, consumers,
  Redis channel layers, authentication, and production deployment with
  Daphne or Uvicorn.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: '2026-03-23'
lastUpdated: 2026-03-23
category: guide
keywords:
  - django websocket
  - django channels
  - django asgi
  - django channels websocket
  - daphne django
  - uvicorn django
seo:
  keywords:
    - django websocket
    - django channels
    - django channels tutorial
    - django asgi websocket
    - django channels redis
    - django realtime
    - daphne vs uvicorn
    - django websocket authentication
faq:
  - q: 'Does Django support WebSockets natively?'
    a:
      'No. Django is built on WSGI, which is a request-response protocol
      with no support for persistent connections. You need Django Channels
      to add WebSocket support. Channels replaces the WSGI layer with
      ASGI, which handles long-lived connections.'
  - q: 'Should I use Daphne or Uvicorn with Django Channels?'
    a:
      'Use Uvicorn. It is faster, actively maintained, and works well
      with Django Channels. Daphne is the original ASGI server from the
      Channels project but has lower throughput. Uvicorn with uvloop
      handles more concurrent connections per worker.'
  - q: 'How do I use the Django ORM inside an async consumer?'
    a:
      'Wrap all ORM calls with database_sync_to_async from the channels
      library. The Django ORM is synchronous. Calling it directly in an
      async consumer blocks the event loop and freezes all connections on
      that worker.'
  - q: 'Do I need Redis for Django Channels?'
    a:
      'For development with a single process, the in-memory channel layer
      works. For production with multiple workers or servers, you need
      Redis via channels_redis. Without it, messages sent to a group only
      reach consumers on the same process.'
  - q: 'When is Django Channels overkill?'
    a:
      'If you only need to push updates to clients and do not need
      bidirectional messaging, consider Server-Sent Events or a managed
      WebSocket service like Ably. Channels adds deployment complexity
      that is not worth it for simple notification use cases.'
---

:::note[Quick Answer]
Django does not support WebSockets natively --- WSGI has no concept
of persistent connections. Install **Django Channels**
(`pip install channels channels_redis`), switch from WSGI to ASGI,
write an `AsyncWebsocketConsumer`, and run under **Uvicorn** instead
of Gunicorn. Use Redis as the channel layer for multi-process
deployments.
:::

Django was built for HTTP request-response. Every view takes a
request, returns a response, and the connection closes. WebSockets
need persistent connections that stay open for minutes or hours.
That is fundamentally incompatible with WSGI.

Django Channels solves this by replacing WSGI with ASGI -- the
async server gateway interface. ASGI handles both HTTP and
WebSocket connections, so your existing Django views keep working
while WebSocket consumers run alongside them.

## WSGI vs ASGI: why you cannot skip this

WSGI (what Gunicorn speaks) processes one request per thread. When
the response is sent, the connection is done. There is no mechanism
to keep a connection open or push data to the client later.

ASGI is the async equivalent. It supports three protocol types:
HTTP, WebSocket, and background tasks. Django Channels uses ASGI
to run your WebSocket consumers as long-lived coroutines alongside
normal HTTP views.

The practical impact: you need to swap your server. Gunicorn
cannot run ASGI applications. You need Daphne or Uvicorn.

## Installation and ASGI setup

```bash
pip install channels channels_redis
```

Add Channels to your Django project. The `ASGI_APPLICATION` setting
points to your routing configuration:

```python
# settings.py
INSTALLED_APPS = [
    "daphne",  # must be before django.contrib.staticfiles
    "channels",
    # ... your other apps
]

ASGI_APPLICATION = "myproject.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    },
}
```

## Routing: connecting URLs to consumers

Django Channels uses a routing stack that mirrors Django's URL
configuration. `ProtocolTypeRouter` splits traffic by protocol,
and `URLRouter` maps WebSocket paths to consumers.

```python
# myproject/asgi.py
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from chat.routing import websocket_urlpatterns

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE", "myproject.settings"
)

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

```python
# chat/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/chat/(?P<room>\w+)/$",
        consumers.ChatConsumer.as_asgi(),
    ),
]
```

A common mistake: putting WebSocket routes inside Django's regular
`urls.py`. That does not work. WebSocket routes go in the ASGI
routing configuration, not the WSGI URL conf.

## Writing a consumer

`AsyncWebsocketConsumer` is the right base class. The sync
`WebsocketConsumer` exists but blocks the event loop -- avoid it
unless every operation in your consumer is CPU-bound and fast.

```python
# chat/consumers.py
import json
from channels.generic.websocket import (
    AsyncWebsocketConsumer,
)

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room = self.scope["url_route"]["kwargs"]["room"]
        self.group_name = f"chat_{self.room}"
        await self.channel_layer.group_add(
            self.group_name, self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )
```

Messages arrive in `receive` and broadcast via the channel layer:

```python
    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.message",
             "message": data["message"],
             "user": self.scope["user"].username},
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "message": event["message"],
            "user": event["user"],
        }))
```

The `scope` dictionary is the WebSocket equivalent of Django's
`request` object. It contains the user (if `AuthMiddlewareStack`
is in the routing), the URL route kwargs, headers, and cookies.

## Channel layers and groups

The channel layer is how consumers talk to each other across
processes and servers. Without it, a message sent in one Uvicorn
worker never reaches consumers on another worker.

**In-memory layer** (`channels.layers.InMemoryChannelLayer`):
works for local development with a single process. Messages never
leave the process, so it is useless in production.

**Redis layer** (`channels_redis`): the production choice. Every
consumer subscribes to Redis pub/sub channels. When you call
`group_send`, the message goes through Redis and reaches every
consumer in the group, regardless of which server or worker they
are on.

Groups are the broadcast mechanism. Call `group_add` when a client
connects, `group_discard` when they disconnect, and `group_send`
to broadcast to everyone in the group. The `type` field in the
message maps to a handler method -- `chat.message` calls
`chat_message` (dots become underscores).

## The Django ORM in async consumers

This is where most developers hit their first real bug. The Django
ORM is synchronous. Calling it directly in an async consumer
blocks the event loop, which freezes every WebSocket connection
on that worker until the query finishes.

```python
# WRONG -- blocks the event loop
async def receive(self, text_data):
    data = json.loads(text_data)
    # This query blocks ALL connections on this worker
    msg = Message.objects.create(
        room=self.room, text=data["message"]
    )

# RIGHT -- runs in a thread pool
async def receive(self, text_data):
    data = json.loads(text_data)
    msg = await database_sync_to_async(
        Message.objects.create
    )(room=self.room, text=data["message"])
```

With a 50ms database query and 200 connected clients, the wrong
approach means every client waits 50ms while that one query runs.
The right approach runs the query in a thread pool while the event
loop continues serving other connections.

Extract ORM calls into helper methods to keep your consumer
readable:

```python
@database_sync_to_async
def save_message(self, room, user, text):
    return Message.objects.create(
        room=room, user=user, text=text
    )

@database_sync_to_async
def get_recent_messages(self, room, limit=50):
    return list(
        Message.objects.filter(room=room)
        .order_by("-created")[:limit]
    )
```

## Authentication

`AuthMiddlewareStack` reads the Django session cookie from the
WebSocket handshake and populates `self.scope["user"]`. This
works if your WebSocket connection comes from the same domain as
your Django app and the browser sends cookies with the upgrade
request.

For token-based auth (mobile apps, SPAs on different domains),
you need a custom middleware:

```python
# middleware.py
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = dict(
            x.split("=") for x in
            scope["query_string"].decode().split("&")
            if "=" in x
        )
        token = query.get("token")
        scope["user"] = (
            await get_user_from_token(token)
            if token else AnonymousUser()
        )
        return await super().__call__(
            scope, receive, send
        )
```

Pass the token as a query parameter:
`ws://example.com/ws/chat/lobby/?token=abc123`. You cannot send
custom headers in the browser's WebSocket API, so query parameters
or the first message after connection are your options.

### CSRF and WebSocket

Django's `CsrfViewMiddleware` can block WebSocket connections if
your ASGI routing accidentally sends WebSocket requests through
the HTTP middleware stack. The fix: make sure your
`ProtocolTypeRouter` separates `http` and `websocket` paths
correctly. WebSocket connections should never hit CSRF middleware.

If you are seeing 403 errors on WebSocket connections, check that
your routing is not wrapping WebSocket URLs with Django's standard
middleware. The `AuthMiddlewareStack` handles session lookup
without CSRF validation.

## Deployment: Daphne vs Uvicorn

Use Uvicorn. It is faster than Daphne, supports HTTP/2, and has
better ecosystem support. Daphne was the original ASGI server
built alongside Channels, but Uvicorn with `uvloop` handles
roughly 2x the concurrent connections per worker.

```bash
# Production: Uvicorn with multiple workers
uvicorn myproject.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --loop uvloop \
    --log-level info
```

### Running ASGI alongside WSGI

If you are migrating gradually, you can run both. Use Nginx to
route WebSocket traffic to Uvicorn and regular HTTP traffic to
Gunicorn:

```nginx
upstream wsgi_backend {
    server 127.0.0.1:8001;  # Gunicorn
}

upstream asgi_backend {
    server 127.0.0.1:8000;  # Uvicorn
}

server {
    listen 80;
    server_name example.com;

    location /ws/ {
        proxy_pass http://asgi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://wsgi_backend;
        proxy_set_header Host $host;
    }
}
```

This is the pragmatic approach for existing Django projects. You
do not need to convert your entire app to ASGI just to add one
WebSocket endpoint. Move to full ASGI when you are ready.

The `proxy_read_timeout 86400` is critical. Nginx's default
timeout is 60 seconds. Without this, idle WebSocket connections
get killed every minute.

## Common mistakes

**Sync code in async consumers.** Any blocking call -- ORM
queries, `time.sleep()`, file I/O, HTTP requests with `requests`
-- freezes the entire event loop. Use `database_sync_to_async`
for ORM calls, `asyncio.sleep()` instead of `time.sleep()`, and
`httpx` or `aiohttp` instead of `requests`.

**No channel layer in production.** The default in-memory layer
does not share state across workers. If worker 1 receives a
message and worker 2 has the target client, the message is lost.
Always use Redis in production.

**Forgetting `group_discard` on disconnect.** If a client
disconnects and you do not remove them from the group, the
channel layer accumulates dead channels. Redis cleans these up
eventually, but it adds latency and wastes memory in the
meantime.

**Running Gunicorn for WebSocket.** Gunicorn speaks WSGI. It
cannot handle ASGI applications or WebSocket connections. If your
WebSocket connections silently fail, check that you are actually
running an ASGI server.

## When Django Channels is overkill

Django Channels adds real complexity. You need Redis, an ASGI
server, a different deployment pipeline, and async-aware code.
For some use cases, that is not worth it.

**Simple notifications (order status, deployment progress):**
Server-Sent Events work fine. Django can stream SSE responses
through an async view without Channels. One-directional push
does not need a bidirectional protocol.

**Chat, dashboards, or collaborative editing at scale:** If you
are building a product where real-time is a core feature and you
need to handle thousands of connections with presence, message
history, and guaranteed delivery, consider a managed service like
[Ably](https://ably.com/solutions/websockets?utm_source=websocket-org&utm_medium=django),
[Pusher](https://pusher.com/), or
[PubNub](https://www.pubnub.com/). They handle the WebSocket
infrastructure, scaling, and edge cases (connection recovery,
message ordering, regional failover) so you can focus on your
Django application logic.

**Infrequent updates (every 30+ seconds):** Polling with a
simple Django view is easier to deploy, debug, and monitor. The
overhead of a WebSocket connection is not justified when the
update frequency is measured in minutes.

Django Channels makes sense when you need bidirectional
communication tightly integrated with your Django models and
authentication, and you are prepared to operate the additional
infrastructure.

## Frequently Asked Questions

### Does Django support WebSockets natively?

No, and it probably never will. Django's architecture is built
around WSGI -- a synchronous, request-response protocol. WSGI
has no concept of persistent connections. The Django team added
async views in Django 4.1, but async views still follow the
request-response pattern. WebSocket support requires ASGI, which
is what Django Channels provides. Channels is maintained by the
Django project but ships as a separate package because it
fundamentally changes the server requirements.

### Should I use Daphne or Uvicorn?

Uvicorn. Daphne was the first ASGI server and it works, but
Uvicorn with `uvloop` is measurably faster for WebSocket
workloads. Uvicorn also has a larger community, better
documentation, and more frequent releases. The only reason to
use Daphne is if you are already running it in production and it
is working fine -- there is no urgent reason to migrate away, but
for new projects, start with Uvicorn.

### How do I use the Django ORM inside an async consumer?

Every ORM call must be wrapped with `database_sync_to_async`.
The Django ORM uses thread-local database connections that are
incompatible with async code. Calling the ORM directly in an
async consumer does not just risk errors -- it blocks the event
loop, which means every client connected to that worker stops
receiving messages until the query completes. The
`database_sync_to_async` wrapper runs the ORM call in a thread
pool, keeping the event loop free.

### Do I need Redis for Django Channels?

In production, yes. The in-memory channel layer only works within
a single process. With multiple Uvicorn workers (which you need
for production), each worker is a separate process with its own
memory. A message sent via `group_send` in worker 1 will not
reach a consumer in worker 2 unless they share an external
message broker. Redis via `channels_redis` is the standard
choice. For very high throughput, consider Redis Cluster or
Redis Sentinel for high availability.

### When is Django Channels overkill?

When the real-time requirement is simpler than the infrastructure
Channels demands. If you only need server-to-client push (stock
prices, notifications, live scores), Server-Sent Events are
simpler and work with standard Django deployment. If real-time
is a core product feature that needs to scale beyond a few
thousand connections, a managed service handles the hard parts
(connection recovery, message ordering, global distribution)
better than a self-managed Channels deployment. Channels hits
the sweet spot when you need bidirectional WebSocket
communication tightly coupled with Django's auth system and ORM,
and your scale is moderate -- say, under 10K concurrent
connections per server.

## Related Content

- [Python WebSocket Guide](/guides/languages/python/) -- covers
  the `websockets` library and asyncio patterns for non-Django
  Python WebSocket servers
- [WebSocket Authentication](/guides/authentication/) -- token
  auth, JWT, and session-based authentication patterns for
  WebSocket connections
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/)
  -- reverse proxy setup for WebSocket, including timeouts and
  upgrade headers
- [WebSockets vs SSE](/comparisons/sse/) -- when Server-Sent
  Events are a better fit than WebSockets for your use case
- [WebSocket Reconnection](/guides/reconnection/) -- exponential
  backoff, jitter, and state recovery patterns for reliable
  connections
