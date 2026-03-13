---
title: "WebSocket Reconnection: State Sync and Recovery Guide"
description:
  "Implement WebSocket reconnection with exponential backoff, jitter,
  and state sync. Covers in-flight messages, session resumption, and
  when to stop retrying."
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-13
lastUpdated: 2026-03-13
category: guide
keywords:
  - websocket reconnect
  - websocket reconnection
  - websocket auto reconnect
  - websocket exponential backoff
  - websocket state sync
  - websocket connection lost
  - websocket retry
seo:
  keywords:
    - websocket reconnect
    - websocket reconnection
    - websocket auto reconnect
    - websocket exponential backoff
    - websocket state synchronization
    - websocket connection recovery
    - websocket session resume
faq:
  - q: "How do I automatically reconnect a WebSocket?"
    a:
      "Use exponential backoff with jitter. Start with a short delay
      (500ms), double it on each retry up to a maximum (30s), and add
      random jitter to prevent all clients reconnecting simultaneously.
      Track a session ID so the server can restore your state."
  - q: "Why do WebSocket connections drop?"
    a:
      "WebSocket connections break constantly in production: mobile
      network switches (Wi-Fi to cellular), laptop sleep/wake cycles,
      server deploys, load balancer health checks, proxy idle timeouts,
      and ISP routing changes. Reconnection is not an edge case."
  - q: "What is the thundering herd problem with WebSocket reconnection?"
    a:
      "When a server restarts, all connected clients disconnect at once.
      If they all retry at fixed intervals, they hit the server
      simultaneously and overload it. Jitter (random delay) spreads
      reconnection attempts across time, preventing the stampede."
  - q: "How do I handle state after a WebSocket reconnects?"
    a:
      "Track message sequence numbers on both client and server. On
      reconnect, the client sends its last received sequence number and
      the server replays missed messages. This requires server-side
      message buffering and a protocol for gap detection."
  - q: "Should I reconnect a WebSocket forever?"
    a:
      "No. Set a maximum retry count (10-15 attempts) or a maximum
      elapsed time (2-5 minutes). After that, surface a connection
      lost state to the user. Retrying forever wastes mobile battery
      and server resources with no benefit."
---

:::note[Quick Answer]
Use exponential backoff with jitter for reconnection timing. But
reconnecting the transport is the easy part — synchronizing state
after reconnection is the hard problem. Track message sequence
numbers, reconcile missed messages, and decide whether state lives
on the server or gets restored by the client.
:::

## Reconnection is not an edge case

WebSocket connections break constantly. Not occasionally, not under
unusual conditions — constantly. In any production deployment, you
will see connections drop for all of these reasons:

- **Mobile network switches** — the user walks from Wi-Fi to cellular
- **Laptop sleep/wake** — the OS suspends the TCP connection
- **Server deploys** — rolling restarts close active connections
- **Load balancer health checks** — ALBs and Nginx cycle connections
  that exceed idle timeouts
- **Proxy timeouts** — corporate proxies and CDNs close idle
  WebSocket connections after 60-120 seconds
- **ISP routing changes** — BGP updates can silently break TCP
  connections

Any application that uses WebSockets without handling reconnection
will break in production. The question is not whether connections
will drop, but how gracefully your application recovers when they do.

## Exponential backoff with jitter

The basic reconnection algorithm is well understood: wait, retry,
double the wait, retry again. Here is a clean implementation:

```javascript
function createBackoff({ base = 500, max = 30000, jitter = true } = {}) {
  let attempt = 0;

  return {
    next() {
      const exponential = Math.min(base * Math.pow(2, attempt), max);
      const delay = jitter
        ? exponential * (0.5 + Math.random() * 0.5)
        : exponential;
      attempt++;
      return Math.floor(delay);
    },
    reset() {
      attempt = 0;
    },
  };
}
```

Start at 500ms, double each time, cap at 30 seconds. The jitter
multiplier randomizes each delay between 50% and 100% of the
calculated value.

**Why jitter matters**: when a server restarts, every connected
client disconnects at the same instant. Without jitter, all clients
retry at exactly the same intervals — 500ms, 1s, 2s, 4s — and
every retry wave hits the recovering server simultaneously. This is
the thundering herd problem, and it can keep a server down longer
than the original failure. Jitter spreads reconnection attempts
across time. It costs you a few lines of code and prevents cascading
failures.

## The real problem: state synchronization

Exponential backoff solves the transport problem. The hard problem
is what happens after the transport reconnects: there is state on
both sides of the connection, and it has diverged.

The server had subscriptions, presence information, a position in a
message stream. The client had unacknowledged outbound messages and
expectations about what data it should be receiving. A new TCP
connection knows nothing about any of this.

There are two fundamental approaches to solving this.

### Stateful routing

Route reconnecting clients back to the specific server that holds
their session state. This requires either sticky sessions at the
load balancer (IP hash or cookie affinity) or a connection registry
that maps session IDs to server instances.

The advantage: reconnection is fast because the state is already in
memory. The disadvantage: it breaks on the most common reconnection
scenario — server restart. When the server that held your state goes
down, the state goes with it. You need a fallback, which leads you
to the second approach anyway.

### Stateless with a recovery protocol

Make servers stateless. Persist session state externally (Redis, a
database, a distributed log). Design a protocol that lets the client
request exactly the data it missed on reconnect.

The pattern:

1. Server assigns each message a sequence number or event ID
2. Client tracks the last sequence number it received
3. On reconnect, client sends its last sequence number
4. Server replays all messages after that sequence number
5. Normal streaming resumes

This is more resilient — any server can handle the reconnection —
but it requires a server-side message buffer and a protocol for gap
detection. You need to decide how long to buffer (seconds? minutes?
hours?) and what to do when the gap is too large to replay.

This is one of the main reasons managed WebSocket services exist.
Building the transport reconnection is straightforward. Building
reliable state synchronization with message buffering, gap
detection, and replay across a distributed server fleet is a
fundamentally harder engineering problem. Services like
[Ably][ably-reconnection] handle this at the protocol level so you
do not have to.

## What happens to in-flight messages?

During the disconnect window, messages are in flight in both
directions. Neither side knows whether the other received the last
message before the connection dropped.

**Server-side**: messages published while the client was disconnected
are lost unless the server buffers them. A common pattern is a
per-connection outbound buffer with a TTL — buffer the last N
messages or the last T seconds of messages, and replay them on
reconnect. The trade-off is memory: at 10,000 connections with a
100-message buffer each, you are holding a million messages in
memory.

**Client-side**: messages the client sent just before the disconnect
may or may not have reached the server. The client needs a retry
queue: hold outbound messages until the server acknowledges them. On
reconnect, resend unacknowledged messages. This introduces the risk
of duplicate delivery — the server may have received the message but
the acknowledgment was lost. If your application cannot tolerate
duplicates, you need idempotency keys on every message.

This is where exactly-once delivery gets genuinely difficult. Most
production systems settle for at-least-once delivery with
application-level deduplication rather than trying to solve
exactly-once at the transport layer.

## Reconnection manager with state sync

Here is a practical implementation that combines backoff with
session tracking and message recovery:

```javascript
class ReconnectionManager {
  constructor(url, { onMessage, onStateChange }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.backoff = createBackoff();
    this.lastSeqId = 0;
    this.sessionId = null;
    this.pending = new Map(); // id → message
    this.maxRetries = 12;
    this.retryCount = 0;
    this.connect();
  }
```

The constructor tracks session state and an outbound message queue.
Messages stay in `pending` until the server acknowledges them — this
is what enables retry on reconnect without losing data.

```javascript
  connect() {
    const params = new URLSearchParams();
    if (this.sessionId) params.set("session", this.sessionId);
    if (this.lastSeqId) params.set("since", this.lastSeqId);
    const sep = this.url.includes("?") ? "&" : "?";
    this.ws = new WebSocket(`${this.url}${sep}${params}`);
    this.onStateChange?.("connecting");

    this.ws.onopen = () => {
      this.backoff.reset();
      this.retryCount = 0;
      this.onStateChange?.("connected");
      this.flushPending();
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.sessionId) this.sessionId = msg.sessionId;
      if (msg.seq) this.lastSeqId = msg.seq;
      if (msg.ack) this.pending.delete(msg.ack);
      this.onMessage?.(msg);
    };

    this.ws.onclose = (event) => {
      if (event.code === 1000) return;
      this.scheduleReconnect();
    };
  }
```

On reconnect, the client passes its session ID and last received
sequence number as query parameters. The server uses these to
resume the session and replay missed messages. When the server
acknowledges a message (`msg.ack`), it's removed from the pending
queue — this prevents duplicate sends on reconnect.

```javascript
  send(data) {
    const msg = { id: crypto.randomUUID(), ...data };
    this.pending.set(msg.id, msg);
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  flushPending() {
    for (const msg of this.pending.values()) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      this.onStateChange?.("disconnected");
      return;
    }
    this.retryCount++;
    this.onStateChange?.("reconnecting");
    setTimeout(() => this.connect(), this.backoff.next());
  }
}
```

Outbound messages queue in `pending` and are only removed on
server acknowledgment. On reconnect, `flushPending` resends
everything the server hasn't confirmed — giving you at-least-once
delivery with idempotency keys (`crypto.randomUUID()`) for
deduplication on the server side.

## Connection identity and session resumption

When a WebSocket reconnects, the TCP connection is new. The server
assigned state to the old connection: presence membership, channel
subscriptions, position in a stream. That state is now orphaned.

The solution is separating connection identity from session identity.
The server issues a session ID on first connection. The client stores
it and presents it on reconnect. The server looks up the session,
re-associates it with the new connection, and resumes.

This requires:

- **Server-side session store** — an in-memory map, Redis, or a
  database that maps session IDs to session state
- **Session TTL** — sessions cannot live forever. Set a TTL that
  matches your reconnection window (typically 2-5 minutes). After
  the TTL, the session is garbage collected and the client starts
  fresh
- **Presence cleanup** — if a user's session expires without
  reconnection, fire presence leave events so other users see
  accurate state

## Token refresh on reconnect

If your application uses token-based authentication (and it should —
see the [security guide](/guides/security/)), the token may have
expired during the disconnect window. Long-lived WebSocket
connections often outlive the tokens that established them.

On reconnect, check token expiry before attempting the connection.
If the token has expired, fetch a fresh one first. Do not attempt
the WebSocket connection with a stale token — it will fail, burn a
retry attempt, and delay recovery.

A good pattern: set token expiry shorter than your maximum
reconnection window. If your backoff caps at 30 seconds with 12
retries, the worst-case reconnection window is roughly 2 minutes.
Set token TTL to at least 5 minutes so a valid token still has
headroom after reconnection.

## When to give up

Do not retry forever. Set clear limits:

- **Maximum retry count**: 10-15 attempts covers most transient
  failures. With exponential backoff starting at 500ms, 12 retries
  spans roughly 2 minutes before reaching the cap
- **Maximum elapsed time**: alternatively, give up after 2-5 minutes
  regardless of retry count
- **User-facing state**: surface a "connection lost" indicator after
  the first failed retry. Users should know the connection is down,
  not discover it when their message fails to send
- **Manual reconnect**: after giving up on automatic retries, let the
  user trigger a reconnect manually. The network conditions that
  caused the failure may have resolved

On mobile, retrying forever drains battery with no benefit. On the
server side, thousands of clients retrying against a down server
consume resources that could be used for recovery. Fail fast, inform
the user, and let them retry when they are ready.

## Frequently asked questions

### How do I automatically reconnect a WebSocket?

Implement an `onclose` handler that schedules a reconnection attempt
using exponential backoff with jitter. Start with a 500ms delay,
double it each time, and cap at 30 seconds. Track a session ID so
the server can restore subscriptions and replay missed messages on
reconnect. The `createBackoff` function and `ReconnectionManager`
class above give you a production-ready starting point. Reset the
backoff timer when a connection succeeds so the next failure starts
from the minimum delay again.

### Why do WebSocket connections drop?

Connections drop for reasons outside your control: the user's phone
switches from Wi-Fi to cellular, their laptop lid closes, your
server deploys a new version, the load balancer cycles idle
connections, or a corporate proxy enforces a timeout. In production,
expect connections to last minutes to hours, not days. Design your
application so disconnection is a normal, recoverable event rather
than an error condition.

### What is the thundering herd problem with WebSocket reconnection?

When a server restarts or a network event disconnects many clients
simultaneously, all of them attempt to reconnect at the same time.
Without jitter, the retry waves are synchronized — every client
retries at 500ms, then 1s, then 2s. Each wave overloads the
recovering server, potentially causing it to fail again. Adding
random jitter to the backoff delay desynchronizes the retries. Each
client waits a slightly different duration, spreading the load
across time instead of concentrating it in bursts.

### How do I handle state after a WebSocket reconnects?

Assign each message a monotonically increasing sequence number. The
client tracks the last sequence it received. On reconnect, the
client includes that sequence number in the connection request. The
server replays all messages with a higher sequence number, then
resumes normal delivery. This requires a server-side message buffer
with a bounded size or TTL. For applications where state
synchronization must be reliable across server restarts, you need
external persistence (Redis, Kafka) rather than in-memory buffers.

### Should I reconnect a WebSocket forever?

No. Set a maximum retry count (10-15 attempts) or a maximum elapsed
time (2-5 minutes). After that, transition to a "disconnected" state
and surface it to the user. Infinite retries drain mobile battery,
waste server resources, and provide no benefit if the underlying
issue (server down, network unavailable) has not resolved. Let the
user trigger a manual reconnect when conditions change.

## Related content

- [Building a WebSocket app](/guides/building-a-websocket-app/)
  — full client-server implementation with error handling
- [WebSockets at scale](/guides/websockets-at-scale/) — load
  balancing and horizontal scaling patterns that affect reconnection
- [Security hardening](/guides/security/) — token authentication
  and TLS configuration for production WebSocket connections
- [WebSocket API reference](/reference/websocket-api/) — the
  `onclose` and `onerror` events that drive reconnection logic
- [Close codes reference](/reference/close-codes/) — understanding
  why a connection closed to decide whether to reconnect

[ably-reconnection]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=reconnection
