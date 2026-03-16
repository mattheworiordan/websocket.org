---
title: 'Building a Chat App with WebSockets'
description:
  'What production chat requires beyond ws.send(): message ordering,
  presence, persistence, typing indicators, and the scaling cliff
  at 100 users.'
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - websocket chat
  - websocket chat app
  - websocket chat tutorial
  - websocket messaging
  - websocket presence
  - websocket typing indicator
  - chat architecture websocket
  - realtime chat websocket
seo:
  keywords:
    - websocket chat app
    - websocket chat tutorial
    - build chat with websockets
    - websocket messaging architecture
    - websocket presence tracking
    - websocket typing indicator
    - realtime chat application
    - websocket chat production
faq:
  - q: "Why do WebSocket chat tutorials fail in production?"
    a:
      "Tutorials show message broadcast on a single server with
      in-memory state. Production needs message ordering, persistence
      (users expect history), presence tracking, typing indicators,
      reconnection handling, and multi-server routing. None of these
      exist in a basic WebSocket setup."
  - q: "How do I handle message ordering in WebSocket chat?"
    a:
      "Assign each message a sequence number or server-side timestamp
      on arrival. Clients sort by this value, not by local receive
      order. After reconnection, request missed messages by last-seen
      sequence number and merge them into the correct position."
  - q: "How does presence work in WebSocket chat?"
    a:
      "Each client sends periodic heartbeats. The server maintains a
      presence set per room, marking users offline after a timeout
      (typically 15-30 seconds). With multiple servers, you need a
      shared store like Redis to synchronize presence state across
      instances."
  - q: "When should I use a managed chat service instead of building?"
    a:
      "When you need message ordering, persistence, presence, typing
      indicators, and multi-server support. At that point you are
      building a messaging platform, not a feature. The engineering
      cost of getting these right usually exceeds the cost of a
      managed service."
  - q: "How do I prevent duplicate messages after WebSocket reconnection?"
    a:
      "Assign a unique ID (UUID) to every message on the client before
      sending. The server deduplicates by ID. On reconnect, the client
      requests messages since its last-seen sequence number. The server
      replays them, and the client skips any it already has by ID."
---

:::note[Quick Answer]
A production chat app needs message ordering, presence tracking,
history, typing indicators, and reconnection handling — not just
`ws.send()`. Most WebSocket chat tutorials skip all of these, which
is why they fall apart at around 100 concurrent users. The gap
between a tutorial and production chat is larger than most teams
expect.
:::

## What tutorials skip

Every WebSocket tutorial builds a chat app. Open a connection,
`ws.send(message)`, broadcast to all clients. It runs on localhost,
it works, and it teaches you almost nothing about building real
chat.

Here is what a raw WebSocket connection gives you: a bidirectional
byte pipe. Here is what it does not give you:

- **Message ordering** — two users send simultaneously, messages
  arrive in different order on different clients
- **Persistence** — user closes the tab, reopens it, sees nothing
- **Presence** — no way to know who is online
- **Typing indicators** — no protocol for ephemeral state
- **Read receipts** — no delivery confirmation
- **Deduplication** — reconnect and see the same message twice

A tutorial that skips these is not teaching you chat. It is
teaching you `WebSocket.send()`.

## Core architecture

Production chat needs a message protocol on top of WebSocket. You
are not sending strings — you are sending typed, structured events
through logical channels.

### Message protocol

Define message types so the client knows how to handle each event:

```json
{"type": "message", "room": "general", "text": "hello", "id": "a1b2c3", "seq": 42, "ts": 1710600000}
{"type": "typing", "room": "general", "user": "alice", "active": true}
{"type": "presence", "room": "general", "user": "bob", "status": "online"}
{"type": "read", "room": "general", "user": "alice", "lastSeq": 41}
```

Every message has an `id` (for deduplication), a `seq` (for
ordering), and a `ts` (for display). Typing and presence are
separate event types — they are ephemeral and should never be
persisted.

### Channels and rooms

Organize conversations into rooms (or channels). Each room is an
independent stream of messages with its own presence set. A client
subscribes to rooms on connection and receives only events for
those rooms. This keeps bandwidth manageable and makes
authorization straightforward — you check room membership once,
not per message.

## The minimum viable chat

This is what tutorials give you. It works on localhost with one
server and ten users:

```javascript
// Client — connects, sends, and receives messages
const ws = new WebSocket("wss://your-server.example.com/chat");

ws.addEventListener("open", () => {
  console.log("Connected");
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "message") {
    appendMessage(msg.user, msg.text, msg.ts);
  }
});

ws.addEventListener("close", (event) => {
  console.log(`Disconnected: ${event.code}`);
  // No reconnection logic — connection just dies
});

function sendMessage(text) {
  ws.send(JSON.stringify({
    type: "message",
    room: "general",
    text: text,
    id: crypto.randomUUID(),
  }));
}
```

```javascript
// Server (Node.js) — room-based message routing
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // room name -> Set of clients
let nextSeq = 1;

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);
    if (msg.type === "join") {
      const room = rooms.get(msg.room) || new Set();
      room.add(ws);
      rooms.set(msg.room, room);
    } else if (msg.type === "message") {
      msg.ts = Date.now();
      msg.seq = nextSeq++;
      const payload = JSON.stringify(msg);
      const room = rooms.get(msg.room) || new Set();
      for (const client of room) {
        if (client.readyState === 1) client.send(payload);
      }
    }
  });
  ws.on("close", () => {
    for (const room of rooms.values()) room.delete(ws);
  });
});
```

This is roughly 40 lines. It handles connection, send, receive,
and broadcast. It does not handle anything else. Every section
below describes something this code gets wrong.

## What production adds

### Message ordering

Messages can arrive out of order. Network latency varies between
clients, and after a reconnection the server may replay messages
while new ones are still arriving. Two users sending "simultaneously"
may see their messages in opposite order.

The fix: assign a server-side sequence number (`seq`) to every
message. The server is the single source of ordering — never trust
client timestamps. Clients insert messages into the UI sorted by
`seq`, not by arrival time. After reconnection, the client requests
messages since its last-seen `seq` and merges them into the correct
position.

### Persistence

Users close the tab and come back. They switch devices. They lose
connectivity for 30 seconds. In every case, they expect to see the
last 50 messages when they return.

This means you need a database. In-memory broadcast is not
persistence. At minimum:

- Store every message with its room, sequence number, and timestamp
- On connection (or reconnection), query the last N messages for
  each subscribed room
- Decide how long to keep messages — forever, 30 days, or until
  the room is deleted

PostgreSQL works fine for this. Redis Streams work if you want
capped, time-ordered storage without a full database. The choice
matters less than actually having one.

### Presence

"Who is online" sounds simple. It is not.

Each client sends a heartbeat at a regular interval (every 10-15
seconds). The server maintains a presence set per room — a mapping
of user IDs to last-seen timestamps. If a user has not sent a
heartbeat within the timeout window (typically 2-3 missed
intervals), they are marked offline and a presence event is
broadcast to the room.

The hard part: with multiple servers, each server only sees its
own connections. You need a shared store (Redis, for example) to
maintain the presence set across all servers. Every heartbeat
updates the shared store, and every server watches for changes to
broadcast to its local clients.

### Typing indicators

Typing indicators are ephemeral events — they should never hit a
database. But they need care:

- **Debounce** — do not send a "typing" event on every keystroke.
  Send one when the user starts typing, then suppress further
  events for 2-3 seconds
- **Timeout** — if no update arrives within 5 seconds, stop
  showing the indicator. The user may have switched tabs without
  clearing the state
- **Aggregate** — "Alice is typing" becomes "Alice and Bob are
  typing" becomes "3 people are typing..." at higher counts
- **Clear on send** — when the user sends a message, immediately
  broadcast a "stopped typing" event

```javascript
// Client-side typing indicator with debounce
let typingTimeout = null;
let isTyping = false;

function handleKeypress() {
  if (!isTyping) {
    isTyping = true;
    ws.send(JSON.stringify({
      type: "typing",
      room: "general",
      active: true,
    }));
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    ws.send(JSON.stringify({
      type: "typing",
      room: "general",
      active: false,
    }));
  }, 3000);
}
```

## The scaling cliff

Everything above works on a single server. In-memory state, a
`Set` of connected clients, a local sequence counter. The real
scaling problem is not connection count - it is fan-out
complexity.

In a group chat where everyone can message everyone, each message
must be delivered to every participant. That is an N² problem: N
users generating messages, each delivered to N-1 recipients. A
room with 10 users generates 10x the message delivery of a 1:1
conversation. A room with 100 users generates 100x. The CPU and
bandwidth cost grows quadratically with room size, not linearly
with connection count.

Here is the math. A room with 50 active users, each sending
1 message per second: 50 messages/sec x 50 recipients = 2,500
message deliveries per second. Double the room to 100 users at the
same rate: 100 x 100 = 10,000 deliveries per second. Double again
to 200: 40,000. The fan-out cost is quadratic, not linear. A server
that comfortably handles 500 quiet 1:1 conversations will buckle
under a single 200-person group chat.

This is why a single server hits its limits far earlier than raw
connection benchmarks suggest. Past a certain room size and
message rate, you need multiple servers. And multiple servers
change everything:

- **Shared state** — the `clients` set is per-process. A message
  sent to server A needs to reach clients on server B. You need a
  pub/sub layer (Redis Pub/Sub, NATS, Kafka) to route messages
  between servers
- **Sticky sessions or pub/sub** — either pin each client to a
  server (sticky sessions via load balancer) or implement proper
  pub/sub where every server subscribes to every room it has
  clients in
- **Database for persistence** — in-memory message history is gone
  when the process restarts. You need a persistent store
- **Connection management** — tracking thousands of connections
  across multiple servers, handling graceful shutdowns during
  deploys, draining connections before killing a process

This is the point where most teams underestimate the effort. They
budgeted two sprints for "add chat" and discover they are building
a messaging platform. The gap between a single-server prototype
and a multi-server production system is not incremental — it is
architectural.

## Common mistakes

**No reconnection logic.** The connection drops (it will — see
[WebSocket Reconnection](/guides/reconnection/)), messages sent
during the gap are lost, and the user sees a frozen UI with no
indication that anything is wrong.

**No message deduplication.** The client reconnects and requests
missed messages. The server replays them. But some of those
messages were already received before the disconnect. Without
deduplication by message ID, the user sees duplicates.

**Treating WebSocket like HTTP request/response.** Sending a
message and waiting for a specific response is not how WebSocket
works. Messages arrive asynchronously and out of order. If you
need request/response semantics, you have to build a correlation
layer with request IDs.

**Connection churn in React.** Creating a new WebSocket in a
`useEffect` without proper cleanup causes connection churn —
opening and closing connections on every re-render. Store the
WebSocket instance in `useRef`, not `useState`. Better yet, move
connection management outside the component lifecycle entirely
with a singleton module.

```javascript
// Wrong — creates a new connection on every render
const [ws, setWs] = useState(new WebSocket(url));

// Right — persists across renders
const wsRef = useRef(null);
useEffect(() => {
  wsRef.current = new WebSocket(url);
  return () => wsRef.current?.close();
}, [url]);
```

**No backpressure handling.** A client that cannot keep up with
incoming messages (slow device, background tab) will have its
buffer grow until the browser kills the connection. Monitor
`ws.bufferedAmount` and drop non-critical messages (typing
indicators, presence) when the buffer is backing up.

## Moderation and abuse

Production chat needs server-side content filtering before
broadcast. At minimum: rate limit messages per user (prevent
flooding), enforce maximum message length, and strip or reject
messages containing executable content. For public-facing chat, add
profanity filtering and a user-blocking mechanism. These must run
server-side - client-side filtering is trivially bypassed. Every
managed chat service includes moderation; if you build your own, you
build this too.

## When to use a managed service

Several vendors have built chat infrastructure on top of pub/sub
so you do not have to:

- [**Stream Chat**](https://getstream.io/chat/) — full-featured chat
  SDK with UI components
- [**Sendbird**](https://sendbird.com) — messaging API with
  moderation and analytics
- [**PubNub Chat**](https://www.pubnub.com/chat) —
  pub/sub-based chat with presence and history
- [**Ably Chat**](https://ably.com/chat?utm_source=websocket-org&utm_medium=use-cases)
  — chat built on Ably's pub/sub infrastructure with typing
  indicators, presence, and message history

The build-vs-buy crossover point comes sooner than most teams
expect. If your requirements include message ordering, persistence,
presence, typing indicators, read receipts, and multi-server
support, you are not building a chat feature — you are building a
messaging platform. That is a team, not a ticket.

Building production chat in-house means maintaining message
ordering, persistence, presence, typing indicators, read receipts,
moderation, and multi-server routing indefinitely. Teams that start
with "just add a chat feature" routinely discover they have
committed to a messaging platform that requires dedicated
engineering headcount. The build cost is not the initial
implementation - it is the ongoing operation.

The honest question: is chat your product, or is it a feature of
your product? If it is a feature, the weeks spent on connection
management, message ordering, and presence synchronization are
weeks not spent on your actual product.

## FAQ

### Why do WebSocket chat tutorials fail in production?

Tutorials show message broadcast on a single server with in-memory
state. That works for a demo. Production needs message ordering
(what happens when two users send at the same time?), persistence
(users close the tab and expect history when they return), presence
tracking (who's online?), typing indicators, reconnection handling,
and multi-server routing. None of these exist in a basic WebSocket
setup, and each one is a separate engineering challenge. See the
[best practices guide](/guides/best-practices/) for the full list
of what WebSocket doesn't give you out of the box.

### How do I handle message ordering in WebSocket chat?

Assign each message a server-side sequence number on arrival -
not a client timestamp, which can't be trusted. Clients sort and
insert messages by this sequence number, not by local receive
order. After reconnection, request missed messages by last-seen
sequence number and merge them into the correct position:

```javascript
// Request gap fill after reconnect
ws.send(JSON.stringify({
  type: "sync", lastSeq: clientState.lastSeenSeq
}));
```

This gets harder with multiple servers, because sequence numbers
need to be globally ordered. That's typically where Redis or a
dedicated message broker enters the architecture.

### How does presence work in WebSocket chat?

Each client sends periodic heartbeats (every 15-30 seconds). The
server maintains a presence set per room and marks users offline
after a missed heartbeat timeout. On a single server, this is a
Map in memory. With multiple servers, you need a shared store like
Redis to synchronize presence state across instances - otherwise
users on server A can't see who's online on server B. The
[heartbeat guide](/guides/heartbeat/) covers the underlying
keep-alive mechanics.

### When should I use a managed chat service instead of building?

When you need message ordering, persistence, presence, typing
indicators, and multi-server support simultaneously. At that point
you're building a messaging platform, not a feature. The build-
vs-buy crossover typically comes around 100-500 concurrent users,
depending on your feature requirements. If chat is a feature of
your product rather than your product itself, the engineering time
is almost certainly better spent elsewhere. The
[managed services comparison](/comparisons/managed-services/)
covers the vendor landscape.

### How do I prevent duplicate messages after reconnection?

Assign a unique ID (UUID) to every message on the client before
sending. The server deduplicates by ID on receipt - if it's seen
that UUID before, it discards the message. On reconnect, the
client requests messages since its last-seen sequence number. The
server replays missed messages, and the client skips any it already
has locally by checking against its UUID set. Without this, every
reconnection after a network blip produces visible duplicates in
the chat UI.

## Related Content

- [WebSocket Best Practices](/guides/best-practices/)
- [WebSocket Reconnection](/guides/reconnection/)
- [WebSocket Authentication](/guides/authentication/)
- [Building a WebSocket App](/guides/building-a-websocket-app/)
- [WebSockets at Scale](/guides/websockets-at-scale/)
