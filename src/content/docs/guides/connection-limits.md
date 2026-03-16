---
title: 'WebSocket Connection Limits: The Real Bottlenecks'
description:
  'WebSocket connection limits go beyond idle count. Connection churn,
  TLS storms, and the thundering herd are what actually break
  production systems.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - websocket connection limits
  - websocket max connections
  - websocket connection limit
  - websocket scaling connections
  - websocket concurrent connections
  - websocket file descriptors
seo:
  keywords:
    - websocket max connections
    - websocket connection limit
    - websocket concurrent connections
    - websocket file descriptors
    - websocket connection scaling
    - websocket thundering herd
faq:
  - q: 'How many WebSocket connections can one server handle?'
    a:
      'A properly tuned Linux server can hold 500,000+ idle WebSocket
      connections. But idle connections are the easy part. The real
      limits are connection churn (TCP/TLS handshake cost), message
      throughput per connection, and burst handling. 10,000 active
      connections sending 100 messages/second each is far harder than
      500,000 idle ones.'
  - q: 'What is the browser WebSocket connection limit?'
    a:
      'Browsers limit WebSocket connections to roughly 6 per domain.
      Chrome allows about 6 per origin and 255 globally. Firefox is
      similar. This limit exists to prevent a single site from
      exhausting system resources. Multiplex multiple logical channels
      over a single WebSocket connection rather than opening many
      connections.'
  - q: 'What is the thundering herd problem with WebSockets?'
    a:
      'When a server restarts or a network blip occurs, all connected
      clients disconnect simultaneously. If they all reconnect at
      once, the TLS handshake and WebSocket upgrade overhead can
      overwhelm the server before a single message is exchanged. Use
      jittered reconnection delays and server-side connection rate
      limiting.'
  - q: 'What actually limits WebSocket performance in production?'
    a:
      'Connection churn, not connection count. Each new connection
      requires a TCP handshake, TLS negotiation, and HTTP upgrade.
      Thousands of connections per minute opening and closing consumes
      far more CPU than holding hundreds of thousands of idle
      connections. Plan for churn rate, not peak idle count.'
  - q: 'How do I increase WebSocket connection limits on Linux?'
    a:
      'Increase file descriptors (ulimit -n / LimitNOFILE to
      1048576), raise net.core.somaxconn to 65535, increase
      tcp_max_syn_backlog, and expand the ephemeral port range. But
      these only address idle capacity. For production scaling, focus
      on connection rate limiting, TLS termination offloading, and
      horizontal scaling.'
---

:::note[Quick Answer]
A single tuned server handles 500K+ idle WebSocket connections.
But that number is misleading. Connection churn (TCP + TLS
handshake storms), burst message throughput, and the difference
between idle and active connections are what actually break
production systems.
:::

Every "WebSocket max connections" question starts the same way:
how many connections can one server hold? The answer is
straightforward, and it is the wrong question. A properly tuned
Linux box handles 500K+ idle connections. That number tells you
almost nothing about what will actually break in production.

The real limits are about what happens when connections churn,
burst, and fail simultaneously.

## The headline numbers

These are the numbers everyone searches for. They are table
stakes, not the real challenge.

**File descriptors** are the first ceiling. Linux defaults to
1,024 per process. Each WebSocket connection consumes one. For
high connection counts, push this to 1M+:

```bash
# Per-process limit (session)
ulimit -n 1048576

# Permanent via systemd service unit
# [Service]
# LimitNOFILE=1048576

# Or system-wide in /etc/security/limits.conf
# *  soft  nofile  1048576
# *  hard  nofile  1048576
```

**Memory** runs roughly 2-10 KB per idle connection, depending
on your server framework and buffer sizes. Active connections
with pending messages jump to 10-100 KB+ each. At 500K
connections and 5 KB average, that is 2.5 GB just for connection
state — before your application logic touches anything.

**Browser per-domain limits** cap you at 6-13 simultaneous
WebSocket connections per domain. Chrome enforces about 6 per
origin and 255 globally. Firefox behaves similarly. The answer
is not to open more connections — multiplex logical channels over
a single connection instead.

These numbers are necessary but not sufficient. Getting file
descriptors and memory right means your server can hold
connections. It says nothing about whether it can handle what
those connections do.

## The real problem: connection churn

500K stable connections is a memory problem. You solve it by
buying RAM. Connection churn is a CPU problem, and it is the one
that takes servers down.

Every new WebSocket connection requires three expensive steps:

1. **TCP handshake** — one round trip.
2. **TLS negotiation** — one to two round trips, plus
   CPU-intensive RSA/ECDHE key exchange operations. This is the
   bottleneck. A server performing RSA-2048 handshakes can manage
   roughly 1,000-3,000 per second per core. ECDHE is faster but
   still expensive.
3. **HTTP upgrade** — one request/response to switch from HTTP to
   WebSocket.

A single TLS handshake takes 1-5 ms of CPU time. At 10,000 new
connections per second, that is 10-50 seconds of CPU time every
second — just for TLS. The math does not work. Your server
stalls.

This is why connection rate matters more than connection count. A
deployment serving 200K stable, long-lived connections is under
less strain than one handling 20K connections that churn every 30
seconds. The first scenario does almost no CPU work. The second
processes 40K TLS handshakes per minute.

**Measure connections per second, not total connections.** If
your monitoring only shows concurrent connection count, you are
watching the wrong metric.

## Burst throughput vs idle capacity

The cost model changes completely when connections become active.

500K idle connections is mostly a memory bill. The CPU sits near
zero because there is nothing to process. Now take 500
connections, each receiving 100 messages in a sudden burst — a
price feed update, a notification fan-out, a game state change.
That is 50,000 messages that need to be serialized, buffered,
and pushed through 500 separate socket writes. CPU and bandwidth
saturate instantly.

Scale that up. 10,000 connections each sending 100 messages per
second gives you 1 million messages per second inbound. Each
message needs to be deserialized, routed, and potentially fanned
out. Memory is irrelevant now. CPU and network bandwidth are the
bottleneck.

A single broadcast to 500K connections is itself a burst event.
If each message is 200 bytes, one broadcast pushes 100 MB of
data through your network stack. The kernel has to copy that
data into 500K separate socket buffers.

**A server with 100K idle connections and a server with 10K
connections each sending 10 messages per second are completely
different workloads.** The first is memory-bound. The second is
CPU-bound. Plan for peak message throughput, not connection
count.

## The thundering herd

A server restart disconnects every connected client. A network
blip between your load balancer and your server pool does the
same thing. In both cases, you get a mass reconnection event
that can be worse than the original failure.

If 100K clients reconnect simultaneously, your server must
handle 100K TLS handshakes plus 100K HTTP upgrade requests plus
100K state resynchronizations — all before it processes a single
application message. At 2,000 TLS handshakes per second per
core, an 8-core server needs over 6 seconds of pure TLS
computation. During that time, it serves nothing.

The fix has three parts:

**Jittered reconnection on the client.** Clients should not
reconnect immediately. Add exponential backoff with random
jitter so reconnection attempts spread over 10-30 seconds
instead of hitting all at once:

```javascript
function reconnect(attempt) {
  const base = Math.min(30000, 1000 * Math.pow(2, attempt));
  const jitter = base * (0.5 + Math.random() * 0.5);
  setTimeout(() => connect(), jitter);
}
```

See the [reconnection guide](/guides/reconnection/) for full
implementation details.

**Server-side connection rate limiting.** Accept at most N new
connections per second. Reject excess connections with WebSocket
close code 1013 ("try again later") so clients know to back off
rather than retry immediately:

```javascript
// Express/ws example: rate-limit new upgrades
let connectionsThisSecond = 0;
setInterval(() => (connectionsThisSecond = 0), 1000);

server.on("upgrade", (req, socket, head) => {
  if (connectionsThisSecond >= MAX_CONNECTIONS_PER_SECOND) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    socket.destroy();
    return;
  }
  connectionsThisSecond++;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

**Rolling deploys with connection draining.** Stop accepting new
connections on the old instance, give existing connections a
30-second grace period, then shut down. Never kill connections
abruptly during a deploy.

## OS tuning: necessary but not sufficient

These settings are prerequisites for high connection counts. They
are not, by themselves, a scaling strategy.

```bash
# Accept queue depth for incoming connections
sysctl -w net.core.somaxconn=65535

# SYN backlog for half-open connections
sysctl -w net.ipv4.tcp_max_syn_backlog=65535

# Ephemeral port range (for outbound connections)
sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

For systemd-managed services, set file descriptor limits in the
unit file:

```ini
[Service]
LimitNOFILE=1048576
```

**In containers (Docker/Kubernetes):** the container inherits
the host's kernel settings but has its own file descriptor limit.
Set `LimitNOFILE` in your container spec or Kubernetes pod
`securityContext`. The default in many container runtimes is
1,048,576, but verify - some base images set it lower.

**TLS session resumption** can significantly reduce the CPU cost
of reconnections. Enable TLS session tickets or session IDs on
your load balancer so returning clients skip the full handshake.
This does not help first-time connections, but it cuts the cost of
reconnection storms roughly in half.

These get you past the defaults. They do not solve churn,
bursts, or thundering herds. Think of OS tuning as raising the
floor, not the ceiling.

## When to scale horizontally

Vertical tuning has diminishing returns. Past roughly 100K
active connections or 50K messages per second on a single
server, horizontal scaling with a load balancer becomes the only
viable path.

This means a Layer 4 or Layer 7 load balancer distributing
connections across a pool of servers, plus a pub/sub backplane
(Redis, Kafka, NATS) for cross-server message delivery.

Connection-aware load balancing matters here. Round-robin
distributes connections evenly at connection time, but if some
connections are far more active than others, you get hot spots.
Least-connections routing helps, but it does not account for
message throughput. The best approach is to track actual load
(CPU, message rate) and route accordingly.

At significant scale — hundreds of thousands of active
connections, global distribution, guaranteed delivery —
connection management becomes infrastructure engineering that
has little to do with your actual product.
[Managed WebSocket services](https://ably.com/pubsub?utm_source=websocket-org&utm_medium=connection-limits)
exist because the operational cost of running this infrastructure
in-house exceeds the service cost for most teams.

That said, if your scale is moderate (under 50K active
connections, single region, no delivery guarantees needed), a
well-tuned server with the configurations above will serve you
for a long time.

## Graceful degradation: avoiding cascading failures

The most dangerous failure mode in a WebSocket system is a
cascade. A server hits capacity and starts dropping connections.
Those clients reconnect, hitting the remaining servers. The
additional load pushes another server over the edge. More clients
reconnect. Within minutes, your entire fleet is down.

This happens because connection failure creates more connections.
Every dropped client immediately tries to reconnect, generating
exactly the TLS handshake storm you cannot afford. The system's
failure mode amplifies the problem instead of containing it.

The fix is load shedding. Your servers must reject new connections
before they are overwhelmed, not after:

- **Connection admission control**: track active connections and
  refuse new ones above a tested threshold. Return close code
  1013 (Try Again Later) so clients back off instead of
  retrying immediately
- **Health-aware load balancing**: your load balancer should stop
  sending new connections to a server that reports itself as
  near capacity. This requires health checks that reflect actual
  load, not just "process is running"
- **Jittered reconnection on clients**: clients must add random
  delay before reconnecting (see
  [reconnection guide](/guides/reconnection/)). Without jitter,
  every client reconnects at the same instant
- **Circuit breakers**: if a server has rejected connections N
  times in the last minute, take it out of rotation entirely
  until it recovers

Design for graceful degradation from day one. A system that
rejects 10% of connections under load keeps serving the other
90%. A system that tries to serve everyone falls over and serves
nobody.

## What to actually monitor

Most WebSocket monitoring dashboards track the wrong things.
Total connection count is useful for capacity planning, but it
will not warn you before an outage. Monitor these instead:

**Connection rate (new connections/sec).** The single most useful
metric. A sudden spike means a reconnection storm. A gradual
climb means your clients are churning. Either one will hit your
CPU before it hits your memory.

**TLS handshake duration (p50/p99, ms).** When this starts
climbing, your CPU is approaching saturation. This is an early
warning signal that arrives minutes before connections start
failing.

**Message throughput per server (msgs/sec).** Know your
baseline. If throughput spikes, every connection on that server
is affected.

**CPU during bursts vs idle.** Compare these explicitly. If your
CPU usage is 10% idle and 95% during a reconnection event, your
headroom is razor thin.

**File descriptor usage as percentage of limit.** Not the raw
count — the percentage. Alert at 70-80% of your tested capacity,
not your theoretical maximum.

## Frequently Asked Questions

### How many WebSocket connections can one server handle?

A properly tuned Linux server holds 500,000+ idle WebSocket
connections. But idle connections are the easy part. The real
limits are connection churn (TCP/TLS handshake cost), message
throughput per connection, and burst handling. 10,000 active
connections with 100 messages per second each is far harder than
500,000 idle ones. The bottleneck shifts from memory to CPU as
connections become active.

### What is the browser WebSocket connection limit?

Browsers limit WebSocket connections to roughly 6 per domain.
Chrome allows about 6 per origin and 255 globally. Firefox
behaves similarly. This limit prevents a single site from
exhausting system resources. The solution is multiplexing: send
multiple logical channels over a single WebSocket connection
rather than opening separate connections for each channel.

### What is the thundering herd problem with WebSockets?

When a server restarts or a network blip occurs, all connected
clients disconnect simultaneously. If they all reconnect at
once, the TLS handshake and WebSocket upgrade overhead can
overwhelm the server before a single message is exchanged. The
fix is jittered reconnection on the client side combined with
server-side connection rate limiting. See the
[reconnection guide](/guides/reconnection/) for implementation
patterns.

### What actually limits WebSocket performance in production?

Connection churn, not connection count. Each new connection
requires a TCP handshake, TLS negotiation, and HTTP upgrade. At
scale, thousands of connections per minute opening and closing
consumes far more CPU than holding hundreds of thousands of idle
connections. Monitor your connections-per-second rate, not your
total connection count.

### How do I increase WebSocket connection limits on Linux?

Increase file descriptors (`ulimit -n` or `LimitNOFILE` to
1048576), raise `net.core.somaxconn` to 65535, increase
`tcp_max_syn_backlog`, and expand the ephemeral port range. But
these settings only address idle capacity. For production
scaling, focus on connection rate limiting, TLS termination
offloading (let your load balancer handle TLS), and horizontal
scaling across multiple servers.

## Related Content

- [WebSockets at Scale](/guides/websockets-at-scale/)
- [WebSocket Reconnection](/guides/reconnection/)
- [WebSocket Best Practices](/guides/best-practices/)
- [Timeout & Dropped Connections](/guides/troubleshooting/timeout/)
- [WebSocket Heartbeat Guide](/guides/heartbeat/)
