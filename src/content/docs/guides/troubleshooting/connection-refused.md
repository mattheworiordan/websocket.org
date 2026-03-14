---
title: "Troubleshooting WebSocket Connection Refused Errors"
description:
  "Debug WebSocket connection refused errors: check server, port, firewall,
  Nginx upgrade headers, Docker networking, and cloud load balancers."
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-17
lastUpdated: 2026-03-17
category: guide
keywords:
  - websocket connection refused
  - websocket connection failed
  - websocket troubleshooting
  - websocket proxy upgrade
  - websocket nginx connection refused
  - websocket docker connection refused
seo:
  keywords:
    - websocket connection refused
    - websocket connection to ws failed
    - websocket connection failed
    - websocket connection error
    - websocket nginx 502
    - websocket docker 0.0.0.0
faq:
  - q: "What does 'WebSocket connection to ws:// failed' mean?"
    a:
      "It means the TCP connection was refused before any WebSocket handshake
      occurred. The server is not listening on the expected host and port. This
      is a network-layer problem, not a WebSocket protocol issue. Check that
      your server process is running and bound to the correct interface."
  - q: "Why does my WebSocket work locally but fail behind Nginx?"
    a:
      "Nginx does not forward HTTP Upgrade headers by default. Without
      proxy_set_header Upgrade and proxy_set_header Connection upgrade in
      your location block, Nginx treats the handshake as a normal HTTP
      request and the WebSocket connection fails."
  - q: "How do I test if a WebSocket server is reachable?"
    a:
      "Use wscat or websocat from the command line: wscat -c ws://host:port.
      If the TCP connection itself fails, use curl -v to check the HTTP
      handshake independently. For browser debugging, open DevTools and check
      the Network tab filtered to WS."
  - q: "Why does my WebSocket fail in Docker but work on the host?"
    a:
      "Your server is likely bound to 127.0.0.1 inside the container, which
      is only reachable from within that container. Bind to 0.0.0.0 instead
      so Docker's port mapping can route traffic from the host into the
      container's network namespace."
  - q: "How do I fix WebSocket connection refused on AWS ALB?"
    a:
      "Enable sticky sessions on the target group, set the idle timeout to
      at least 3600 seconds (default 60s will drop idle connections), and
      confirm your health check path returns 200. ALB supports WebSocket
      natively but kills connections that exceed the idle timeout."
---

:::note[Quick Answer]
"Connection refused" means the TCP connection failed before any WebSocket
handshake. The server is not listening on the port your client is hitting.
Check: is the server process running? Is it on the right port? Is a
firewall blocking it? Is your reverse proxy forwarding Upgrade headers?
:::

The browser console says `WebSocket connection to 'ws://...' failed`.
You check your WebSocket code. You read the docs. You add error
handlers. None of that helps, because the problem has nothing to do
with WebSocket.

"Connection refused" is a TCP error. It means no process is accepting
connections on the target host and port. The WebSocket handshake never
even started. Every minute you spend debugging your WebSocket code is
a minute wasted on the wrong layer.

## The diagnostic checklist

Work through these in order. Stop at the first failure — everything
downstream depends on TCP connectivity.

### 1. Is the server process running?

This sounds obvious, but it's the most common cause. The server
crashed, didn't start, or is listening on a different port than you
expect.

```bash
# Check if anything is listening on your expected port
lsof -i :8080 | grep LISTEN
# or on Linux
ss -tlnp | grep 8080
```

If nothing shows up, your server isn't running or isn't bound to
that port. Check logs, check your start command, check for port
conflicts.

### 2. Are you connecting to the right host and port?

Mismatches between your client URL and your server's actual
bind address are surprisingly common. Hardcoded `localhost` in
development code that gets deployed. Port 8080 in the client,
port 3000 in the server config. `ws://` when the server expects
`wss://`.

```javascript
// Common mistake: hardcoded dev URL in production
const ws = new WebSocket("ws://localhost:8080/ws");

// What you probably need in production
const ws = new WebSocket(
  `wss://${window.location.host}/ws`
);
```

### 3. Is a firewall blocking the port?

Cloud security groups, OS firewalls, and corporate networks all
filter traffic. The connection will be refused (or silently
dropped) if the port isn't explicitly allowed.

```bash
# Test raw TCP connectivity
nc -zv your-server.com 8080

# If using AWS, check the security group allows inbound
# on your WebSocket port from the client's IP range
```

A "connection refused" response means the port is reachable but
nothing is listening. A timeout with no response means a firewall
is dropping packets silently. Different problems, different fixes.

### 4. Is your reverse proxy forwarding Upgrade headers?

This is the single most common cause of WebSocket failures in
production. Nginx, Apache, Caddy, and cloud load balancers all
require explicit configuration to forward the HTTP Upgrade
handshake that initiates a WebSocket connection.

Without Upgrade headers, the proxy treats the handshake as a
regular HTTP request. The server never sees the upgrade, the
client gets a non-101 response, and the connection fails.

## The Nginx fix (most common solution)

Nginx does not pass Upgrade headers by default. You must add them
explicitly:

```nginx
location /ws {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

Every line matters:

- `proxy_http_version 1.1` — WebSocket requires HTTP/1.1 for the
  Upgrade handshake. Nginx defaults to 1.0 for upstream connections.
- `proxy_set_header Upgrade` — forwards the client's Upgrade header.
- `proxy_set_header Connection "upgrade"` — tells the upstream to
  switch protocols.
- `proxy_read_timeout 3600s` — Nginx's default is 60 seconds. Idle
  WebSocket connections will be killed after that. Set this to match
  your application's expected connection lifetime.

Missing any one of these headers will silently break WebSocket. For
a full production config including SSL termination and load
balancing, see the
[Nginx WebSocket configuration guide](/guides/infrastructure/nginx/).

## Docker networking gotchas

Docker adds a network namespace boundary that catches people off
guard. Two problems come up repeatedly:

**Binding to 127.0.0.1 inside the container.** When your server
binds to `localhost` or `127.0.0.1`, it only accepts connections
from inside the container. Docker's port mapping (`-p 8080:8080`)
routes traffic from the host to the container's network interface,
but that traffic arrives on `0.0.0.0`, not `127.0.0.1`.

```javascript
// WRONG: only reachable inside the container
server.listen(8080, "127.0.0.1");

// RIGHT: accepts connections from Docker's port mapping
server.listen(8080, "0.0.0.0");
```

**Container-to-container communication.** If your WebSocket
client runs in one container and the server in another, `localhost`
refers to the client's own container. Use Docker's service
names (in Compose) or the container's IP on the shared network.

```yaml
# docker-compose.yml
services:
  app:
    depends_on: [ws-server]
    environment:
      # NOT localhost — use the service name
      WS_URL: ws://ws-server:8080/ws
  ws-server:
    ports:
      - "8080:8080"
```

## Cloud load balancer configuration

Cloud load balancers support WebSocket, but their defaults are
tuned for short-lived HTTP requests. Without adjustment, they'll
terminate idle WebSocket connections.

### AWS Application Load Balancer (ALB)

ALB handles WebSocket natively — no special listener
configuration. But two defaults will bite you:

- **Idle timeout** defaults to 60 seconds. A WebSocket connection
  with no traffic for 60 seconds gets terminated. Increase this
  to 3600 seconds in the ALB attributes, and implement
  application-level ping/pong to keep connections alive.
- **Sticky sessions** must be enabled on the target group.
  WebSocket connections are stateful — if a health check routes
  a subsequent request to a different backend, the connection
  breaks.

### Cloudflare

Cloudflare proxies WebSocket connections on all plans, but you
must confirm it's enabled in the dashboard under
**Network > WebSockets**. Without this toggle, Cloudflare will
not forward Upgrade headers and your handshake fails with a 101
not received error.

Cloudflare also enforces a 100-second idle timeout on free and
pro plans. Send periodic ping frames to keep connections alive,
or the connection will be silently closed.

### HAProxy

HAProxy requires `tunnel` mode for WebSocket connections after
the handshake:

```text
frontend ws_front
    bind *:443 ssl crt /etc/ssl/cert.pem
    acl is_websocket hdr(Upgrade) -i WebSocket
    use_backend ws_back if is_websocket

backend ws_back
    timeout tunnel 3600s
    server ws1 10.0.0.1:8080 check
```

The `timeout tunnel` directive controls how long HAProxy keeps
the bidirectional connection open. Without it, HAProxy uses the
standard HTTP timeout, which is far too short for WebSocket.

## HTTPS/WSS mismatch

If your page is served over HTTPS, the browser will refuse to
open a `ws://` connection. Mixed content rules apply. You must
use `wss://` from HTTPS pages.

The reverse is also a problem: if you connect to `wss://` but
your server isn't configured for TLS, the TLS handshake fails
before the WebSocket handshake even starts. The error often
looks like a connection refused rather than a certificate error.

In production, terminate TLS at the load balancer or reverse
proxy and proxy to the backend over plain `ws://`. The client
connects with `wss://`, the proxy handles the certificate, and
the backend doesn't need to deal with TLS.
[Managed WebSocket services][ably-realtime] handle TLS
termination and proxy configuration for you, which eliminates
this entire category of problem.

## How to test and debug

### Command-line tools

[**wscat**](https://github.com/websockets/wscat) is the fastest
way to test from a terminal:

```bash
# Install
npm install -g wscat

# Test a connection
wscat -c ws://localhost:8080/ws

# Test with TLS
wscat -c wss://your-server.com/ws
```

[**websocat**](https://github.com/vi/websocat) gives you more
control — useful for debugging protocol-level issues:

```bash
# Test with verbose output
websocat -v ws://localhost:8080/ws

# Send a message and disconnect
echo "ping" | websocat ws://localhost:8080/ws
```

### Browser DevTools

Open DevTools, go to the **Network** tab, and filter by **WS**.
You'll see every WebSocket connection attempt, the handshake
request/response headers, and any frames sent or received.

If the connection fails, the **Console** tab will show the error.
Pay attention to the exact message — "connection refused" is
different from "unexpected response code 502" (proxy issue) or
"was not upgraded to websocket" (missing Upgrade headers).

### Isolating the layer

If you're not sure whether the problem is TCP, TLS, HTTP, or
WebSocket, work up the stack:

```bash
# Layer 1: Can you reach the port? (TCP)
nc -zv server.com 8080

# Layer 2: Does TLS work? (if using wss://)
openssl s_client -connect server.com:443

# Layer 3: Does the HTTP upgrade work?
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://server.com:8080/ws
```

If `curl` gets a `101 Switching Protocols` response, the server
is fine and the problem is in your client code. If it gets a 400
or 502, the issue is at the proxy or server level.

## Frequently Asked Questions

### What does "WebSocket connection to ws:// failed" mean?

The browser tried to open a TCP connection to the host and port
in your WebSocket URL, and the operating system refused it. No
WebSocket protocol exchange happened. The server process is
either not running, not listening on that port, or a firewall is
blocking access. Start debugging at the network layer — use
`nc -zv host port` to verify raw TCP connectivity before looking
at WebSocket-specific configuration.

### Why does my WebSocket work locally but fail behind Nginx?

Nginx doesn't forward HTTP Upgrade headers by default. When a
client sends the WebSocket handshake, Nginx proxies it as a
regular HTTP request, stripping the `Upgrade` and `Connection`
headers. The backend never receives the upgrade request and
responds with a normal HTTP response, which the client rejects.
Add `proxy_set_header Upgrade $http_upgrade` and
`proxy_set_header Connection "upgrade"` to your location block.
See the [Nginx guide](/guides/infrastructure/nginx/) for a full
production config.

### How do I test if a WebSocket server is reachable?

Use `wscat -c ws://host:port` from the command line for a quick
check. If that fails, drop down to TCP: `nc -zv host port` tells
you whether anything is listening. If TCP works but wscat fails,
the problem is in the HTTP upgrade — use `curl` with Upgrade
headers to see the server's response. In the browser, the
Network tab filtered to WS shows handshake details including
response headers and status codes.

### Why does my WebSocket fail in Docker but work on the host?

Almost always a bind address issue. Server processes that bind
to `127.0.0.1` inside a container only accept connections from
within that container's network namespace. Docker's `-p` port
mapping routes external traffic to `0.0.0.0`, which doesn't
match. Change your server's bind address to `0.0.0.0`. For
container-to-container communication, use Docker Compose
service names instead of `localhost`.

### How do I fix WebSocket timeouts on cloud load balancers?

Every cloud load balancer has an idle timeout — typically 60
seconds by default. If no data crosses the connection within
that window, the load balancer terminates it. Set the idle
timeout higher (3600 seconds is common), and implement
application-level ping/pong frames at an interval shorter than
the timeout. On
[AWS ALB](/guides/infrastructure/aws/alb/), this is in the load
balancer attributes. On
[Cloudflare](/guides/infrastructure/cloudflare/), the timeout
varies by plan and can't be changed on free tier — you must keep
connections active with pings.

## Related Content

- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/)
  — full proxy config with SSL, timeouts, and load balancing
- [AWS ALB WebSocket Setup](/guides/infrastructure/aws/alb/) —
  target groups, sticky sessions, and idle timeout tuning
- [Cloudflare WebSocket Config](/guides/infrastructure/cloudflare/)
  — enabling WebSocket proxying and working within plan limits
- [WebSocket Reconnection Patterns](/guides/reconnection/) —
  exponential backoff, state recovery, and jitter strategies
- [WebSocket Close Codes Reference](/reference/close-codes/) —
  understand what the server is telling you when connections drop

[ably-realtime]:
  https://ably.com/websockets?utm_source=websocket-org&utm_medium=connection-refused
