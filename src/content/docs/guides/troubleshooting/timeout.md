---
title: "Fix WebSocket Timeout and Silent Dropped Connections"
description:
  "Why WebSocket connections die silently and how to fix it: proxy idle
  timeouts, ping/pong heartbeats, mobile network NAT, and dead connection
  detection."
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-21
lastUpdated: 2026-03-21
category: guide
keywords:
  - websocket timeout
  - websocket connection dropped
  - websocket ping pong
  - websocket keep alive
  - websocket heartbeat
  - websocket idle timeout
  - websocket silent disconnect
seo:
  keywords:
    - websocket timeout
    - websocket connection timeout
    - websocket ping pong heartbeat
    - websocket keep alive connection
    - websocket idle timeout nginx
    - websocket silent disconnect detection
faq:
  - q: "Why does my WebSocket connection drop after 60 seconds?"
    a:
      "Most reverse proxies and load balancers close idle connections
      after 60 seconds by default. Nginx proxy_read_timeout, AWS ALB
      idle timeout, and HAProxy timeout tunnel all default to 60s. Send
      ping/pong frames or application heartbeats at shorter intervals to
      keep the connection alive."
  - q: "What is the difference between WebSocket ping/pong and application heartbeats?"
    a:
      "WebSocket protocol ping/pong (opcodes 0x9/0xA) is handled at the
      frame level and most proxies recognize it as activity. Application
      heartbeats are regular text or binary messages your code sends and
      receives. Use protocol ping/pong when your server library supports
      it. Use application heartbeats when you need to detect dead
      connections from the client side, since browsers cannot send
      WebSocket pings."
  - q: "How do I detect a silent WebSocket disconnect?"
    a:
      "Send periodic heartbeat messages and track when you last received
      a response. If no pong or heartbeat reply arrives within your
      timeout window, treat the connection as dead and reconnect. The
      browser's WebSocket API will not fire onclose for connections that
      die without a TCP FIN or RST."
  - q: "Why do WebSocket connections drop on mobile devices?"
    a:
      "Mobile networks aggressively reclaim resources. Cellular NAT
      gateways timeout idle connections in as little as 30 seconds. When
      the OS suspends an app or the screen turns off, TCP connections go
      dormant and the NAT mapping expires. The server still thinks the
      connection is open, but packets can no longer reach the client."
  - q: "What ping interval should I use for WebSocket keep-alive?"
    a:
      "Send heartbeats every 20-30 seconds. This stays well under the
      60-second default timeout of most proxies and load balancers, and
      under the 30-second NAT timeout common on cellular networks. More
      frequent pings waste bandwidth. Less frequent ones risk hitting
      an intermediate timeout."
---

:::note[Quick Answer]
WebSocket has no built-in keep-alive. Every proxy, load balancer,
and NAT device between client and server has an idle timeout. If no
data flows, the connection dies silently. Fix it with ping/pong
heartbeats every 20-30 seconds and client-side dead connection
detection.
:::

WebSocket connections don't time out because of the WebSocket
protocol. They time out because of everything between the client and
the server. Reverse proxies, load balancers, cloud provider
infrastructure, corporate firewalls, cellular NAT gateways --- all of
them have idle timers, and none of them tell you when they kill your
connection.

The worst part: TCP doesn't notice either. A connection killed by an
intermediate device produces no FIN, no RST, no error. The client's
`onclose` never fires. From your application's perspective, the
connection is still open. It's just that nothing you send will ever
arrive.

## Why connections die: the idle timeout chain

Every hop between client and server has its own idle timeout. If no
data crosses that hop within the timeout window, the connection is
closed (or the NAT mapping is dropped). Here are the defaults you're
almost certainly hitting:

| Infrastructure          | Default idle timeout |
| ----------------------- | -------------------- |
| Nginx `proxy_read_timeout` | 60 seconds           |
| AWS ALB                 | 60 seconds           |
| AWS NLB                 | 350 seconds          |
| Cloudflare              | 100 seconds          |
| HAProxy `timeout tunnel` | 60 seconds           |
| Cellular NAT gateway    | 30-120 seconds       |
| Home router NAT         | 60-300 seconds       |

Your connection is only as stable as the shortest timeout in the
chain. If your client talks to an Nginx proxy in front of your
WebSocket server, and the proxy has a 60-second timeout, any
connection that goes 60 seconds without data is dead.

## The fix: heartbeats

The solution is simple --- send data frequently enough that no
intermediate device considers the connection idle. There are two
approaches, and you should understand both.

### Protocol-level ping/pong

The WebSocket protocol defines ping (opcode 0x9) and pong (opcode
0xA) control frames. When one side sends a ping, the other must
respond with a pong. Most WebSocket server libraries support this
natively:

```javascript
// Node.js with ws library — server-side ping
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000); // 25s — well under the 60s proxy default
```

Protocol pings work well because most proxies and load balancers
recognize WebSocket control frames as activity and reset their idle
timers. The downside: **browsers cannot send WebSocket pings.** The
browser's `WebSocket` API has no `ping()` method. Pings must
originate from the server, and if the server crashes or the network
path is broken, no pings are sent and the client has no way to
detect the failure.

### Application-level heartbeats

Application heartbeats are regular messages (text or binary) that
your code sends and receives. They work in both directions and give
you something protocol pings don't: **client-side dead connection
detection.**

```javascript
// Client-side heartbeat with dead connection detection
function createConnection(url) {
  const ws = new WebSocket(url);
  let heartbeatTimer, missedHeartbeats = 0;

  function sendHeartbeat() {
    if (missedHeartbeats >= 3) { ws.close(); reconnect(); return; }
    missedHeartbeats++;
    ws.send(JSON.stringify({ type: "ping" }));
  }
  ws.onopen = () => {
    missedHeartbeats = 0;
    heartbeatTimer = setInterval(sendHeartbeat, 25000);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "pong") missedHeartbeats = 0;
  };
  ws.onclose = () => { clearInterval(heartbeatTimer); reconnect(); };
  return ws;
}
```

Use application heartbeats when you need the **client** to detect
dead connections. Use protocol pings when you only need the
**server** to detect dead clients. In most production systems,
you want both.

## Configuring infrastructure timeouts

Don't just add heartbeats --- also push the timeout higher on
infrastructure you control. A 60-second default is aggressive for
WebSocket connections that may have natural quiet periods.

**Nginx:**

```nginx
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;  # 1 hour, not the 60s default
    proxy_send_timeout 3600s;
}
```

**AWS ALB** — set idle timeout to 3600 seconds via the console or
CLI. The ALB also requires the backend to respond to HTTP health
checks, which is a separate concern from WebSocket keepalive.

**Cloudflare** — Enterprise plans let you increase the WebSocket
timeout beyond 100 seconds. On Free and Pro plans, you're stuck
with 100 seconds. Send heartbeats at 30-second intervals and
don't fight it.

The right approach is defense in depth: raise the infrastructure
timeout to something reasonable (5-60 minutes) **and** send
heartbeats. The heartbeat protects you from intermediaries you
don't control --- corporate proxies, ISP NAT devices, mobile
carrier gateways.

## Mobile: a hostile environment for WebSocket

Mobile networks are actively hostile to long-lived connections.
Three things will kill your WebSocket on mobile:

**OS suspension.** When a phone's screen turns off or the app moves
to the background, the OS suspends TCP connections. iOS is
aggressive about this --- background apps get seconds, not minutes.
The TCP connection goes dormant, heartbeats stop, and intermediate
NAT mappings expire.

**Cellular NAT timeout.** Carrier-grade NAT gateways have short
idle timeouts, often 30 seconds. Even if your app stays in the
foreground, a quiet connection will have its NAT mapping dropped.
The server sends data, the NAT has no mapping, the packet is
silently dropped.

**Network transitions.** Moving from Wi-Fi to cellular (or between
cell towers) changes the client's IP address. The old TCP
connection is dead. The server won't know until it tries to send
data and gets no ACK. This is where your dead connection detection
matters --- the client needs to realize the old connection is gone
and open a new one.

The practical consequence: mobile WebSocket clients must always
implement reconnection with state recovery. Don't try to keep a
connection alive through network transitions. Accept that it will
break and design your protocol so reconnection is fast and
invisible to the user. Send a last-seen message ID or sequence number on
reconnect so the server can replay what was missed. See our
[reconnection guide](/guides/reconnection/) for the implementation
details.

## Detecting silent disconnects

A "silent disconnect" is a connection that's dead but nobody knows
it. The TCP stack hasn't detected the failure because no data has
been sent. The `onclose` callback hasn't fired. The connection
object reports `readyState === WebSocket.OPEN`. But nothing can
pass through it.

This happens when:

- An intermediate NAT or proxy drops the connection silently
- The remote peer's machine crashes (no FIN/RST sent)
- A network partition isolates client from server

TCP's own keepalive mechanism exists but is inadequate --- it
defaults to 2 hours before the first probe, and most operating
systems don't let browser JavaScript configure it.

The only reliable detection is application-level: send data, expect
a response, and treat no response as a dead connection. The
heartbeat pattern above does exactly this. Track your
`missedHeartbeats` counter, and when it hits your threshold (3
missed heartbeats is a reasonable default), close the socket and
reconnect.

For production systems, combine this with server-side detection.
The server pings every client on a timer and terminates any
connection that doesn't respond. Between client and server
detection, dead connections get cleaned up within one heartbeat
interval regardless of which side failed. If you'd rather not
build and maintain all of this yourself,
[managed WebSocket services][managed-ws] like Ably, Pusher, or
PubNub handle heartbeats, timeout detection, and reconnection
at the infrastructure level.

## Frequently Asked Questions

### Why does my WebSocket connection drop after 60 seconds?

Because 60 seconds is the default idle timeout for Nginx, AWS ALB,
and HAProxy. If no data --- including WebSocket ping/pong frames ---
crosses the proxy within that window, the proxy closes the
connection. The fix is twofold: increase `proxy_read_timeout` (or
equivalent) on your infrastructure, and send heartbeats at intervals
shorter than the lowest timeout in your stack. Set your heartbeat to
25 seconds and you'll clear every common default.

### What is the difference between protocol ping/pong and application heartbeats?

Protocol ping/pong operates at the WebSocket frame level using
opcodes 0x9 and 0xA. The receiving side must respond to a ping with
a pong automatically. Application heartbeats are regular messages
your code sends and processes. The critical difference: browsers
can't send protocol pings, so client-to-server liveness checks must
use application heartbeats. Servers should use protocol pings for
efficiency, since they bypass your message parsing logic and have
minimal overhead.

### How do I detect a silent WebSocket disconnect?

You can't rely on `onclose` --- it only fires when the TCP
connection is cleanly shut down. For silent disconnects (NAT drops,
crashes, network partitions), implement a heartbeat timer. Send a
ping message every 25 seconds and track responses. If 3 consecutive
heartbeats get no reply, the connection is dead. Close the socket,
fire your reconnection logic, and log the event so you can track
how often silent disconnects happen in your environment.

### Why do WebSocket connections drop on mobile devices?

Three reasons. First, the OS suspends TCP connections when the app
backgrounds or the screen locks. Second, cellular NAT gateways drop
idle mappings in as little as 30 seconds. Third, network transitions
(Wi-Fi to cellular, tower handoffs) change the client's IP,
invalidating the TCP connection. You can't prevent any of these ---
instead, design for fast reconnection with state recovery, so the
user experience survives connection drops.

### What ping interval should I use?

25 seconds is the sweet spot. It clears the 30-second cellular NAT
timeout (the shortest common timeout you'll encounter), stays well
under the 60-second default of most proxies, and doesn't generate
excessive traffic. At 25-second intervals, heartbeat overhead is
roughly 2.4 KB per minute per connection --- negligible even on
metered mobile connections. Don't go below 15 seconds unless you
have a specific reason; don't go above 30 seconds or you risk
cellular NAT drops.

## Related Content

- [WebSocket Reconnection](/guides/reconnection/) — exponential
  backoff, jitter, and state recovery after disconnects
- [WebSocket Best Practices](/guides/best-practices/) — connection
  management, authentication, and production patterns
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/) —
  proxy settings, timeouts, and upstream tuning
- [AWS ALB Configuration](/guides/infrastructure/aws/alb/) — idle
  timeout, sticky sessions, and health checks
- [Cloudflare WebSocket Configuration](/guides/infrastructure/cloudflare/)
  — timeout limits and proxy behavior

[managed-ws]:
  https://ably.com/websockets?utm_source=websocket-org&utm_medium=timeout
