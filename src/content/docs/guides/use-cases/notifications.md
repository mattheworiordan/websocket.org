---
title: 'WebSocket Notifications: Real-time Push and In-App Delivery'
description:
  'Build notification systems with WebSockets for instant in-app
  delivery and push notifications for offline users. Covers fan-out
  and hybrid delivery.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - websocket notifications
  - real-time notifications
  - push notifications websocket
  - websocket push
  - notification system architecture
  - web push api websocket
  - websocket fan-out
seo:
  keywords:
    - websocket notifications
    - real-time notifications
    - push notifications websocket
    - web push api
    - notification system architecture
    - websocket fan-out pattern
    - offline notification delivery
faq:
  - q: "When should I use WebSockets vs push notifications?"
    a:
      "Use WebSockets when the user has the app or tab open. They
      deliver instantly, need no permission, and support rich UI
      updates. Use push notifications (FCM, APNs, Web Push) when
      the user is offline or backgrounded. Most production systems
      need both."
  - q: "How do I send notifications to specific users over WebSocket?"
    a:
      "Publish to user-scoped channels like user:{id}:notifications.
      Each user subscribes to their own channel on connect. The
      server publishes to N channels for N target users. This
      isolates notification streams and respects per-user
      preferences."
  - q: "What happens to WebSocket notifications when the user disconnects?"
    a:
      "They are lost. WebSocket only delivers while the connection
      is open. Close the tab, lock the phone, lose WiFi, and
      messages vanish. You need server-side message buffering,
      push notification fallback, or a persistent notification
      store to cover the gap."
  - q: "Can I use WebSockets and push notifications together?"
    a:
      "Yes, and you should. Deliver via WebSocket when the user
      has an active connection. Fall back to push when they
      disconnect. This requires presence tracking to know which
      delivery path to use, plus deduplication logic to avoid
      double-delivering."
  - q: "Is WebSocket overkill for a notification system?"
    a:
      "It depends on frequency. If you send fewer than one update
      per minute and they are one-way only, SSE is simpler. If
      you just need to wake a mobile device occasionally, push
      alone is enough. WebSocket is worth it when notifications
      are frequent, bidirectional, or need instant delivery."
---

:::note[Quick Answer]
Use WebSockets for instant in-app notifications when the user is
active. Use push notifications (FCM, APNs, Web Push API) for offline
and background delivery. Most production systems need both, and the
gap between the two is where notifications get lost.
:::

## The notification delivery spectrum

Notification systems have two hard problems: knowing where the
user is, and not annoying them. Most guides cover the first and
ignore the second entirely. The right delivery mechanism depends
on whether the user is active, how urgent the message is, and
what platform you are targeting.

### Real-time in-app (WebSocket)

The user has the app or browser tab open. Messages arrive instantly.
No user permission required. You control the UI entirely: toast
notifications, badge counts, inline feed updates.

Best for: live activity feeds, collaborative editing alerts,
in-app messaging, real-time order status.

```javascript
const ws = new WebSocket("wss://api.example.com/notifications");

ws.addEventListener("message", (event) => {
  const notification = JSON.parse(event.data);

  switch (notification.type) {
    case "alert":
      showToast(notification.title, notification.body);
      break;
    case "badge":
      updateBadgeCount(notification.count);
      break;
    case "feed":
      prependToFeed(notification.item);
      break;
  }
});

ws.addEventListener("close", () => {
  // Connection lost. Notifications stop arriving.
  // Fall back to polling or surface "reconnecting" state.
  scheduleReconnect();
});
```

### Background and offline (Push notifications)

The user is not connected. APNs (iOS), FCM (Android), and the Web
Push API (browsers via service workers) can wake sleeping devices
and show system-level notifications. These require user permission
and are rate-limited by the OS.

- **Web Push API**: Browser registers a service worker, gets a push
  subscription endpoint. Server sends via the push service even when
  the tab is closed. Works in Chrome, Firefox, Edge. Safari added
  support in 2023.
- **APNs/FCM**: Required for native mobile apps when backgrounded.
  The OS manages delivery, wakes the app, shows the notification.
  FCM rate-limits to roughly 240 messages per minute per device.
  APNs limits vary by priority.

### Low-urgency (Polling or SSE)

Update frequency is low, less than one per minute. The data flows one
way. SSE or long-polling is simpler and cheaper to operate. Good for
dashboard refreshes, batch digest updates, or status pages that
update every few minutes.

## Fan-out patterns

How you route notifications from server to clients determines your
architecture's complexity and scale ceiling.

### Broadcast to all

Publish to a single `notifications` channel. Every connected client
receives every message.

```javascript
// Server-side: publish once, everyone gets it
channel.publish("notifications", {
  type: "maintenance",
  message: "Scheduled downtime at 02:00 UTC",
});
```

Simple, but it breaks down fast. If you have 100,000 connected
users and most notifications are irrelevant to most of them,
you are wasting bandwidth and forcing clients to filter locally.

### User-targeted

Publish to `user:{id}:notifications`. Only that user receives the
message. The server publishes N times for N target users.

```javascript
// Server-side: targeted delivery
async function notifyUsers(userIds, notification) {
  const promises = userIds.map((id) =>
    channel.publish(`user:${id}:notifications`, notification)
  );
  await Promise.all(promises);
}
```

This is the standard pattern for most notification systems. Each
user subscribes to their own channel on connect and only receives
messages meant for them.

### Topic-based subscriptions

Users subscribe to topics they care about: `order_updates`,
`security_alerts`, `team:engineering`. Fine-grained, respects user
preferences, and avoids the N-publish problem for group
notifications.

```javascript
// Client subscribes to chosen topics
const topics = ["security_alerts", "team:engineering"];
topics.forEach((topic) => {
  ws.send(JSON.stringify({ action: "subscribe", topic }));
});
```

The trade-off: you need subscription management. Storing which
users subscribe to which topics, handling subscribe/unsubscribe,
and cleaning up stale subscriptions when connections drop.

### The cost of fan-out at scale

The cost of fan-out grows with both notification frequency and
audience size. A notification to 100K users means 100K publishes
or one broadcast that 100K clients consume. At that scale, you
need infrastructure designed for fan-out, not a loop calling
`ws.send()`. Broadcast channels solve part of this, but targeted
notifications (user-scoped or topic-scoped) still require the
server to resolve "who should receive this" on every publish.
If that resolution hits a database, your notification latency
is now gated by your query speed.

## The offline problem

WebSocket only delivers when the connection is open. Close the tab,
lock the phone, lose WiFi, and messages are gone. This is the
single biggest gap in WebSocket-only notification systems.

Users expect notifications to arrive regardless of whether they
have your app open. Email does this. Slack does this. Your system
needs to do this too.

### Web Push API

The browser registers a service worker and obtains a push
subscription. The server sends notifications via the browser's
push service even when your tab is closed.

```javascript
// Register service worker and get push subscription
const registration = await navigator.serviceWorker.register(
  "/sw.js"
);
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey,
});

// Send subscription to your server for later use
await fetch("/api/push-subscriptions", {
  method: "POST",
  body: JSON.stringify(subscription),
});
```

```javascript
// In the service worker (sw.js)
self.addEventListener("push", (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url },
    })
  );
});
```

### Mobile push (APNs and FCM)

Required for native mobile apps. The OS manages delivery, wakes
the app from background, and shows the notification in the system
tray. You send a payload to Apple or Google's push service, and
they handle last-mile delivery.

The constraint: payload size is limited (4KB for APNs, 4KB for
FCM data messages). You cannot send rich content through push
alone. The common pattern is to send a lightweight push that
triggers the app to fetch full content from your API.

### The hybrid model

Use WebSocket when the user is connected: instant delivery, no
permission required, rich UI updates. Fall back to push when
disconnected.

This requires knowing whether the user has an active WebSocket
connection. That means presence tracking on the server side.

```text
User connects via WebSocket
  -> Server marks user as "online"
  -> Notifications delivered via WebSocket

User disconnects (tab close, network loss, app background)
  -> Server marks user as "offline"
  -> Notifications routed to push service (FCM/APNs/Web Push)

User reconnects
  -> Server replays any buffered messages
  -> Switches back to WebSocket delivery
```

The hard part is not the routing logic. It is the edge cases:
what if the WebSocket connection is alive but the user switched
tabs and is not actually looking? What if the push notification
arrives and then the user opens the app and gets the same message
via WebSocket? Deduplication and delivery acknowledgment are where
the real complexity lives.

## Notification priority and deduplication

Getting notifications delivered is the easy part. Not annoying
users is the hard part.

### Priority tiers

Not every notification deserves the same delivery path. Assign
a priority tier to each notification type and route accordingly:

- **Critical** (security alerts, payment failures): push
  immediately via both WebSocket and push. Never drop these.
  If the user has Do Not Disturb on, queue for delivery the
  moment it turns off.
- **Important** (new messages, mentions): deliver via WebSocket
  if connected, fall back to push after a short delay (5-10
  seconds). This avoids double-delivery when the user is
  active but gives push time to fire if they are not.
- **Informational** (activity feed, social updates): WebSocket
  only. If the user is offline, skip it or batch it into a
  digest. Nobody needs a push notification for "Alice liked
  your post."

### Deduplication with notification IDs

The hybrid model means the same notification can arrive via both
WebSocket and push. Include a unique `id` in every notification
payload regardless of channel. The client tracks recently-seen
IDs and displays each notification only once:

```javascript
const seenIds = new Set();

function handleNotification(notification) {
  if (seenIds.has(notification.id)) return;
  seenIds.add(notification.id);
  showToast(notification);

  // Prevent unbounded memory growth
  if (seenIds.size > 1000) {
    const oldest = seenIds.values().next().value;
    seenIds.delete(oldest);
  }
}
```

This works across delivery channels: the push handler and the
WebSocket handler both call the same function, and whichever
arrives first wins.

### Cross-tab deduplication

Multiple browser tabs sharing the same origin each maintain
their own WebSocket connection. Without coordination, the user
gets the same toast in every tab. Use the `BroadcastChannel`
API to let tabs claim notifications:

```javascript
const channel = new BroadcastChannel("notifications");
channel.onmessage = (event) => {
  if (event.data.type === "claimed") {
    // Another tab is handling this notification
    seenIds.add(event.data.id);
  }
};

function handleNotification(notification) {
  if (seenIds.has(notification.id)) return;
  channel.postMessage({ type: "claimed", id: notification.id });
  showToast(notification);
}
```

`BroadcastChannel` is synchronous enough for this purpose. The
first tab to call `postMessage` wins, and the others see the
`claimed` event before they process their own copy.

### Rate limiting and notification fatigue

Even correctly deduplicated notifications can overwhelm users.
Batch low-priority notifications on the client side: instead of
five separate "X liked your post" toasts, show one "5 new likes"
after a short accumulation window. Respect quiet hours by
checking the time before displaying non-critical notifications.
Let users set per-topic preferences that the server checks
before publishing, not just client-side filters that waste
bandwidth.

## Platforms that unify both

Building WebSocket and push notification infrastructure separately
means maintaining two delivery paths, two sets of SDKs, and
deduplication logic to avoid notifying via push when WebSocket
already delivered.

Several platforms unify WebSocket and push delivery so you
publish once and the platform routes via the right channel based
on client state:

- [**Ably**](https://ably.com/push-notifications?utm_source=websocket-org&utm_medium=use-cases)
  — pub/sub plus push notification delivery (FCM, APNs) in a
  single API. Presence tracking determines whether to deliver
  via WebSocket or push. Architecture is channel-centric:
  publish to a channel, clients subscribe, and the platform
  handles routing.
- [**Firebase**](https://firebase.google.com/products/cloud-messaging)
  — strong push notification support via FCM, plus Realtime
  Database for in-app updates. Best fit if you're already in
  the Google ecosystem. Architecture is device-centric: you
  push to device tokens, and Google handles last-mile delivery.
- [**OneSignal**](https://onesignal.com) — push-notification
  focused with multi-channel delivery (push, email, SMS,
  in-app). No built-in WebSocket layer, so pair it with a
  separate real-time service. Architecture is audience-centric:
  you define segments and tags, then target groups of users.
- [**Pusher**](https://pusher.com) — WebSocket pub/sub with
  Beams for push notifications. Simpler API surface but no
  built-in presence-based routing between WebSocket and push.
  Architecture is event-centric: you trigger named events on
  channels and clients bind handlers to those events.

The build-vs-buy decision comes down to how many users you have
and how critical notification delivery is. Under 10,000 users, you
can manage two separate systems. Past that, the operational cost
of keeping WebSocket and push in sync starts to justify a unified
platform.

## Message persistence between connections

What happens to notifications generated while the user is
disconnected? The answer depends on the notification type.

### Ephemeral

Miss everything while disconnected. No buffering, no replay.
Appropriate for live scores, typing indicators, cursor positions,
and anything where stale data has no value.

### Session-based buffering

Buffer N minutes or hours of messages server-side. Replay them on
reconnect. This covers the common case: user's phone loses signal
for 30 seconds, reconnects, and gets the three notifications they
missed.

```javascript
// Server-side: buffer with TTL
// Note: in-memory buffer works for a single server.
// For distributed systems, use Redis or a message queue.
const MESSAGE_BUFFER_TTL = 5 * 60 * 1000; // 5 minutes

function bufferMessage(userId, message) {
  const buffer = userBuffers.get(userId) || [];
  buffer.push({
    message,
    timestamp: Date.now(),
  });
  // Evict expired messages
  const cutoff = Date.now() - MESSAGE_BUFFER_TTL;
  const filtered = buffer.filter((m) => m.timestamp > cutoff);
  userBuffers.set(userId, filtered);
}

function replayOnReconnect(userId, lastSeenTimestamp) {
  const buffer = userBuffers.get(userId) || [];
  return buffer.filter((m) => m.timestamp > lastSeenTimestamp);
}
```

The trade-off: server memory. If you have a million users and
buffer 100 messages each, that is 100 million messages in memory.
Use a bounded buffer (last N messages or last T minutes) and
offload to Redis or a database if you need longer retention.

### Long-term persistence

Store all notifications permanently. This is the notification
center or inbox pattern: the user opens the app a week later and
sees everything they missed, organized by date, with read/unread
state.

This is no longer a real-time delivery problem. It is a database
problem. Store notifications in PostgreSQL or DynamoDB, query them
on page load, and use WebSocket only for new notifications that
arrive while the user is active.

## When WebSocket is overkill for notifications

WebSocket adds connection management, heartbeats, reconnection
logic, and infrastructure complexity. That overhead is justified
when notifications are frequent and bidirectional. It is not
justified when:

- **Updates are infrequent** (less than one per minute): SSE is
  simpler. One HTTP connection, no upgrade handshake, built-in
  reconnection in the `EventSource` API. Server pushes data. Done.
- **Delivery is one-way only**: If the client never sends data
  back, you do not need a bidirectional channel. SSE handles
  server-to-client just fine.
- **You just need to wake a device**: Push notifications alone are
  enough. No persistent connection required. APNs and FCM handle
  delivery and retry for you.
- **Daily digest or batch notifications**: Use a scheduled job and
  email or push. There is nothing real-time about a daily summary.

The hybrid approach described above handles the spectrum well: use
WebSocket for the real-time layer, push for the offline layer, and
avoid WebSocket entirely for use cases that do not need it.

## Frequently Asked Questions

### When should I use WebSockets vs push notifications?

Use WebSockets when you need instant delivery to an active user
with no permission overhead. The user has the app open, and you
want to update the UI immediately. Push notifications cover the
opposite case: the user is not connected, and you need to reach
them through the OS notification system.

Most production notification systems use both. The WebSocket
handles real-time in-app delivery, and push handles everything
else. The challenge is the bridge between them: knowing which
path to use at any given moment and avoiding duplicate delivery.
See the [hybrid model](#the-hybrid-model) section above.

One edge case people miss: a WebSocket connection can be alive
but the tab backgrounded. The browser may throttle timers and
reduce the connection's priority. If your notification is
time-critical, you cannot rely on WebSocket delivery alone
even for "connected" users. Consider the
[priority tiers](#priority-tiers) approach to handle this.

### How do I send notifications to specific users?

Publish to user-scoped channels (`user:{id}:notifications`). The
client subscribes to their channel on connect. The server
publishes to the specific channel when a notification targets that
user.

For group notifications (e.g., all members of a team), use
topic-based channels (`team:engineering:notifications`). Users
subscribe to the topics they care about, and a single publish
reaches everyone subscribed. This avoids publishing N times for
N users in a group.

Watch out for channel proliferation. If each user subscribes to
20 topics and you have 100K users, the server is managing 2M
subscriptions. Keep channel names predictable and hierarchical
so you can monitor and debug them. See
[fan-out patterns](#fan-out-patterns) for the scaling
implications.

### What happens to notifications when the user is offline?

With WebSocket alone, they are lost. The connection is gone, and
there is no delivery mechanism. You need one of three strategies:
push notification fallback (deliver via FCM/APNs/Web Push),
server-side message buffering (replay missed messages on
reconnect), or persistent storage (notification inbox pattern).

Which strategy depends on the notification type. A chat message
should be buffered and replayed. A typing indicator should not. A
security alert should go through push and be stored permanently.

A common mistake is buffering everything. If a user was offline
for an hour and reconnects to 200 buffered "user is typing"
events, you have wasted bandwidth and confused the UI. Tag each
notification type as ephemeral, bufferable, or persistent and
handle reconnection accordingly. See
[message persistence](#message-persistence-between-connections)
for the implementation patterns.

### Can I avoid managing two separate systems?

Yes. Platforms like
[Ably](https://ably.com/push-notifications?utm_source=websocket-org&utm_medium=use-cases)
unify WebSocket pub/sub and push notification delivery into a
single API. You publish once, and the platform routes to WebSocket
or push based on client state. This eliminates the deduplication
logic and presence tracking you would otherwise build yourself.

The real value is not just fewer API calls. It is that the
platform handles the edge cases: connection state transitions,
race conditions between WebSocket disconnect and push delivery,
and [cross-tab deduplication](#cross-tab-deduplication). Building
these correctly from scratch takes months. See the
[platforms section](#platforms-that-unify-both) for a comparison
of architectural approaches.

### Is SSE a better choice than WebSocket for notifications?

For one-way, low-frequency notifications, yes. SSE is simpler:
one HTTP connection, built-in browser reconnection via
`EventSource`, no upgrade handshake. The trade-off is no
bidirectional communication and no binary frame support. If your
notifications are server-to-client text at under one per minute,
SSE saves you complexity.

One thing SSE handles better than WebSocket out of the box:
automatic reconnection with `Last-Event-ID`. The browser sends
the last event ID it received, and the server can replay from
that point. With WebSocket, you build this yourself. See
[WebSockets vs SSE](/comparisons/sse/) for a full comparison.

## Related Content

- [WebSockets vs SSE](/comparisons/sse/)
- [WebSocket Reconnection](/guides/reconnection/)
- [WebSocket Best Practices](/guides/best-practices/)
- [Building a Chat App](/guides/use-cases/chat/)
- [Managed WebSocket Services Compared](/comparisons/managed-services/)
