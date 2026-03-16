---
title: "WebSocket Heartbeat: Ping/Pong, Keep-Alive & Zombie Detection"
description:
  "How WebSocket heartbeats work: protocol-level ping/pong,
  application-level keep-alive, TCP keepalive, and detecting zombie
  connections."
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - websocket heartbeat
  - websocket ping pong
  - websocket keep alive
  - websocket keepalive
  - websocket zombie connection
  - websocket idle timeout
seo:
  keywords:
    - websocket heartbeat
    - websocket ping pong
    - websocket keep alive
    - websocket keepalive interval
    - websocket zombie connection detection
    - websocket idle timeout proxy
faq:
  - q: "What is a WebSocket heartbeat?"
    a:
      "A heartbeat is a periodic signal sent over a WebSocket connection
      to verify both sides are still alive. It can be protocol-level
      (RFC 6455 ping/pong frames) or application-level (a JSON message
      your code handles). Heartbeats detect dead connections and prevent
      proxies from closing idle connections."
  - q: "Does the browser WebSocket API support ping/pong?"
    a:
      "No. The browser automatically responds to server ping frames with
      pong frames, but JavaScript cannot send ping frames or detect when
      they arrive. If you need heartbeat logic visible to your
      application code, you must implement application-level heartbeats
      using regular WebSocket messages."
  - q: "How often should I send WebSocket heartbeats?"
    a:
      "Every 30 to 45 seconds for most deployments. The rule of thumb is
      75% of your shortest proxy idle timeout. Most reverse proxies
      (Nginx, AWS ALB, Cloudflare) default to 60-second idle timeouts,
      so a 30-45 second heartbeat interval keeps the connection alive."
  - q: "What is a zombie WebSocket connection?"
    a:
      "A zombie connection is one where the TCP socket is open but the
      remote peer is unreachable - typically after a network partition,
      mobile network switch, or abrupt client crash. No close frame is
      sent, so the server doesn't know the client is gone. Heartbeats
      detect zombies by expecting a response within a timeout."
  - q: "What about TCP keepalive for WebSockets?"
    a:
      "TCP keepalive operates at the OS level with a default interval of
      2 hours on most Linux systems. That's far too slow for WebSocket
      use cases - a proxy will kill your connection long before TCP
      keepalive detects a problem. Use application-level or
      protocol-level heartbeats instead."
---

:::note[Quick Answer]
Heartbeats detect dead connections and prevent proxy timeouts. The
browser WebSocket API does not expose protocol-level ping/pong to
JavaScript, so most browser apps implement application-level heartbeats
using regular messages. Send heartbeats every 30-45 seconds -- that is
75% of most proxy idle timeouts.
:::

## Three layers of keep-alive

Most developers know about one heartbeat mechanism. There are actually
three, and they solve different problems.

### Protocol-level ping/pong (RFC 6455)

The WebSocket protocol defines ping (opcode `0x9`) and pong (opcode
`0xA`) control frames. The server sends a ping frame, the client
responds with a pong containing the same payload. These frames are
small -- 2 bytes of overhead plus optional payload up to 125 bytes.

Protocol-level ping/pong is the most efficient heartbeat mechanism.
The problem: browser JavaScript cannot access it. Browsers handle
ping/pong automatically at the protocol layer. Your code never sees
it.

### Application-level heartbeat

Send a regular WebSocket message like `{"type":"ping"}` and expect a
`{"type":"pong"}` response. This is what browser apps actually use
because it is the only mechanism visible to JavaScript.

The trade-off is overhead. A JSON ping message is 15-20 bytes versus
2 bytes for a protocol-level ping. For most applications that extra
overhead is negligible. For systems pushing millions of connections,
it adds up.

### TCP keepalive

The operating system can send TCP-level probes via `SO_KEEPALIVE`.
On most Linux systems, the default `TCP_KEEPIDLE` is 7200 seconds
-- two hours before the first probe fires.

Two hours is useless for WebSocket applications. Any reverse proxy
will kill your idle connection in 60-100 seconds. TCP keepalive
exists for long-lived server-to-server connections where proxy
timeouts are not a factor. Do not rely on it for client-facing
WebSocket connections.

## The browser API gap

This catches developers off guard. The browser `WebSocket` API
(`new WebSocket(url)`) has no heartbeat support. Specifically, you
cannot:

- **Send a ping frame** from JavaScript
- **Detect when a ping arrives** from the server
- **Know when the browser sent a pong** in response

The browser does respond to server pings automatically -- the RFC
requires it. But that response is invisible to your code. If you
need to detect a dead server from the client side, or if you need
heartbeat timing visible to your application logic, you must build
application-level heartbeats yourself.

This is not an oversight in the API. The WebSocket spec deliberately
keeps control frames out of application reach. It does mean that
every non-trivial browser WebSocket app ends up implementing its
own heartbeat protocol on top of regular messages.

## Why heartbeats matter

### Zombie connections

A user is on your app over Wi-Fi. They walk into a lift. The Wi-Fi
connection dies, but no TCP close handshake happens -- the packets
just stop arriving. The client is gone, but the server has no idea.

This is a zombie connection. The TCP socket stays open. The server
holds memory, file descriptors, and subscription state for a client
that will never send another byte. Without heartbeats, that
connection sits there until your application timeout or OS-level
TCP keepalive fires (two hours later, by default).

At scale, zombie connections are a resource leak. A server holding
10,000 zombie connections is a server wasting memory and file
descriptors on ghosts. Heartbeat timeouts are the only reliable
way to detect them.

### Proxy idle timeouts

Every reverse proxy between your client and server has an idle
timeout. If no data flows for that duration, the proxy kills the
connection.

Common defaults:

| Proxy / Service     | Default idle timeout |
| ------------------- | -------------------- |
| Nginx               | 60 seconds           |
| AWS ALB             | 60 seconds           |
| Cloudflare          | 100 seconds          |
| HAProxy             | 50-60 seconds        |
| Azure App Gateway   | 60 seconds           |
| Google Cloud LB     | 30 seconds           |

### The 75% rule

Set your heartbeat interval to 75% of your shortest proxy timeout.
If Nginx is your shortest at 60 seconds, send heartbeats every 45
seconds. This gives you margin for network jitter and processing
delay without cutting it too close.

If Google Cloud's 30-second timeout is in your path, heartbeat at
22 seconds. Yes, that is aggressive. The alternative is connections
dying silently.

## Server-initiated vs client-initiated

**Server-initiated is the right default.** The server manages N
connections and sends pings on a schedule. If no pong comes back
within a timeout (10 seconds is reasonable), the server closes the
connection and frees resources.

Why server-initiated works better:

- The server is the one holding resources per connection. It needs
  to know which connections are alive.
- The server can stagger pings across connections to avoid sending
  10,000 pings in the same millisecond.
- One timer loop on the server replaces N timer loops on N clients.

Client-initiated heartbeats make sense when the client needs to
detect a dead server - for example, to trigger reconnection or
show a "connection lost" banner. In practice, most production
systems do both: the server pings to detect dead clients, and the
client sends its own heartbeat to detect a dead server and trigger
reconnection.

**Mobile apps need extra care.** iOS and Android aggressively
suspend background apps and kill their network connections. Your
heartbeat timer stops when the app is backgrounded. When the user
returns, the socket may already be dead but the client does not
know it yet. Send an immediate heartbeat on app foreground (via
`visibilitychange` event in browsers, or app lifecycle hooks on
mobile) and treat a missed pong as a signal to reconnect
immediately rather than waiting for the next interval.

## Implementation by library

### Node.js (ws)

The `ws` library supports protocol-level ping/pong directly:

```javascript
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Each connection resets the flag on pong
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});
```

This is the canonical pattern. Every 30 seconds, any connection
that has not responded to the previous ping gets terminated.

### Python (websockets)

The `websockets` library handles heartbeats automatically:

```python
async with websockets.serve(
    handler,
    "localhost",
    8765,
    ping_interval=30,
    ping_timeout=10,
) as server:
    await server.serve_forever()
```

Set `ping_interval` to your heartbeat frequency and `ping_timeout`
to how long you wait for a pong before closing. The library sends
protocol-level pings and handles the timeout logic for you.

### Go (gorilla/websocket)

Gorilla uses read deadlines and a pong handler:

```go
conn.SetReadDeadline(time.Now().Add(45 * time.Second))
conn.SetPongHandler(func(string) error {
    conn.SetReadDeadline(time.Now().Add(45 * time.Second))
    return nil
})

// In a separate goroutine, send pings
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()
for range ticker.C {
    if err := conn.WriteControl(
        websocket.PingMessage, nil,
        time.Now().Add(10*time.Second),
    ); err != nil {
        return
    }
}
```

The read deadline acts as the timeout. Each pong resets it. If no
pong arrives within 45 seconds, the next read fails and the
connection closes.

### Browser (application-level)

Since browsers cannot send protocol-level pings, use regular
messages:

```javascript
let pongReceived = true;

const heartbeat = setInterval(() => {
  if (!pongReceived) {
    ws.close();
    clearInterval(heartbeat);
    // Trigger reconnection logic
    return;
  }
  pongReceived = false;
  ws.send(JSON.stringify({ type: "ping" }));
}, 30000);

ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "pong") {
    pongReceived = true;
    return;
  }
  // Handle other messages
});
```

Your server must recognize `{"type":"ping"}` and respond with
`{"type":"pong"}`. This is extra code on both sides, but it is
the only way to get heartbeat visibility in browser JavaScript.

## When a managed service removes the tuning burden

Getting heartbeat intervals, timeouts, and retry logic right across
every proxy and load balancer in your infrastructure is fiddly work.
Miss one timeout and connections die silently. Set the interval too
aggressively and you burn bandwidth at scale.

Managed WebSocket services like
[Ably](https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=heartbeat),
[Pusher](https://pusher.com), and
[PubNub](https://www.pubnub.com) handle heartbeat tuning
automatically. They negotiate intervals based on the client's network
conditions, handle protocol-level ping/pong on your behalf, and
detect zombie connections without you writing a single timer loop.
That is one less thing to misconfigure -- and in production, the
things you do not have to configure are the things that do not break
at 3am.

## Frequently asked questions

### What is a WebSocket heartbeat?

A heartbeat is a periodic signal verifying both sides of a WebSocket
connection are alive. It comes in two forms: protocol-level
ping/pong frames defined in RFC 6455, and application-level messages
your code sends and checks. Heartbeats serve two purposes -- they
detect dead connections (zombies) and they prevent reverse proxies
from closing idle connections.

### Does the browser WebSocket API support ping/pong?

No. The browser responds to server ping frames automatically at the
protocol level, but JavaScript has no access to this. You cannot
send pings, detect incoming pings, or know when pongs are sent. For
heartbeat logic in browser applications, send regular WebSocket
messages (like `{"type":"ping"}`) and handle the response in your
application code.

### How often should I send WebSocket heartbeats?

Every 30 to 45 seconds works for most deployments. Apply the 75%
rule: take your shortest proxy idle timeout and multiply by 0.75.
Nginx and AWS ALB default to 60 seconds, so 45 seconds is safe.
If Google Cloud Load Balancing (30-second default) is in your path,
drop to 22 seconds. Sending too frequently wastes bandwidth. Sending
too infrequently means proxy disconnects.

### What is a zombie WebSocket connection?

A zombie is a connection where the TCP socket is open but the remote
peer is unreachable. This happens after network partitions, mobile
network switches, abrupt client crashes, or kill -9. No close frame
is sent because the client did not shut down gracefully. The server
has no way to know the client is gone unless it sends a heartbeat
and notices the response never comes.

### What about TCP keepalive for WebSockets?

TCP keepalive sends OS-level probes, but the default interval on
Linux is 7200 seconds (2 hours). You can tune it with
`TCP_KEEPIDLE`, `TCP_KEEPINTVL`, and `TCP_KEEPCNT`, but even
aggressive settings (e.g. 30-second idle) only help for the
server-to-client path. They do not prevent proxy idle timeouts
because proxies track application-layer activity, not TCP probes.
Use WebSocket-level heartbeats instead.

## Related content

- [WebSocket Reconnection](/guides/reconnection/) -- what to do
  after a heartbeat timeout detects a dead connection
- [WebSocket Best Practices](/guides/best-practices/) -- heartbeats
  in the context of production WebSocket deployment
- [WebSocket Close Codes](/reference/close-codes/) -- the code to
  send when closing a zombie connection
- [Timeout & Dropped Connections](/guides/troubleshooting/timeout/)
  -- diagnosing and fixing connection timeout issues
- [WebSockets at Scale](/guides/websockets-at-scale/) -- managing
  heartbeats across thousands of concurrent connections
