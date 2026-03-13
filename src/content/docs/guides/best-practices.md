---
title: "WebSocket Best Practices for Production Applications"
description:
  "Production WebSocket best practices: state synchronization, authentication,
  connection management, DoS prevention, and when not to use WebSockets at all."
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-13
lastUpdated: 2026-03-13
category: guide
keywords:
  - websocket best practices
  - websocket production
  - websocket authentication
  - websocket connection management
  - websocket security
  - websocket state sync
  - websocket react
seo:
  keywords:
    - websocket best practices
    - websocket production tips
    - websocket authentication token
    - websocket connection management react
    - websocket dos prevention
    - when not to use websockets
faq:
  - q: "What is the most common WebSocket mistake in production?"
    a:
      "Treating WebSocket like HTTP. After the handshake, WebSocket is a raw
      bidirectional byte pipe with no built-in semantics for request-response,
      authentication renewal, message ordering, or reconnection state. Every
      feature HTTP gives you for free, you must build yourself."
  - q: "How do you handle authentication on long-lived WebSocket connections?"
    a:
      "Use short-lived tokens (not API keys) passed as a URL parameter or in
      the first message for fast server-side rejection. Implement token renewal
      either in-band (a protocol message that supplies a fresh token) or by
      reconnecting with a new token before expiry. Never embed long-lived
      secrets in client code."
  - q: "Should I build my own WebSocket server for production?"
    a:
      "For most production systems, no. Raw WebSocket gives you a transport
      layer with no state management, reconnection handling, message ordering
      guarantees, or presence awareness. Libraries like Socket.IO or managed
      services like Ably, Pusher, or PubNub exist specifically because these
      problems are hard to solve correctly at scale."
  - q: "How do I prevent WebSocket connection leaks in React?"
    a:
      "Store the WebSocket instance in a useRef instead of useState, and
      always close the connection in the useEffect cleanup function. Better
      yet, move connection management outside the component lifecycle entirely
      using a singleton pattern or a dedicated connection manager module."
  - q: "How is DoS prevention different for WebSocket vs HTTP?"
    a:
      "HTTP validates every request independently — you can inspect headers,
      rate-limit per endpoint, and reject bad requests before processing.
      WebSocket authenticates once at handshake time, then the connection is
      opaque. You must implement per-connection rate limiting, message size
      caps, and idle timeouts at the application layer."
---

:::note[Quick Answer]
The most important WebSocket best practice: stop treating it like HTTP.
WebSocket is a raw transport — after the handshake, you have a TCP socket
with no built-in semantics for state, authentication, reconnection, or
message ordering. Build a protocol layer on top, or use a library that
provides one.
:::

Every "best practice" for WebSocket is really an answer to the same
question: what's missing? HTTP gives you request-response semantics,
status codes, caching, content negotiation, authentication per request,
and a massive ecosystem of middleware. WebSocket gives you a bidirectional
byte pipe. Everything else is your problem.

That's not a criticism of the protocol. WebSocket does exactly what it's
designed to do — provide a persistent, full-duplex channel over a single
TCP connection. The mistake is assuming that's enough for a production
application.

## WebSocket is not HTTP — reset your expectations

After the HTTP handshake completes and the connection upgrades, you're
working with something closer to a raw TCP socket than to an HTTP
endpoint. There are no status codes. No request-response pairing. No
headers per message. No content-type negotiation. No built-in way to
know if the other side received your message.

This matters because developers who've spent years building HTTP APIs
bring those mental models to WebSocket. They expect request-response
patterns, per-message authentication, automatic retries, and stateless
servers. None of that exists here.

The question to ask yourself before reaching for a raw WebSocket
connection: **is a TCP socket really what I want?** If your answer is
"I need a transport, plus reconnection, plus state sync, plus auth, plus
message ordering" — that's a protocol you need to build on top of
WebSocket, or one you should adopt from an existing library.

## State synchronization — the hardest problem

Connection drops are a certainty, not an edge case. Mobile users walk
into elevators. Laptops close. Networks switch from Wi-Fi to cellular.
When the client reconnects, the core question is: what did it miss?

The server has been sending messages. The client has been offline. Their
states have diverged. Reconciling this is the hardest problem in
WebSocket-based systems, and raw WebSocket gives you zero help.

Three approaches that work:

**Sequence numbers.** Every message gets a monotonically increasing ID.
On reconnect, the client sends its last-seen ID and the server replays
everything after it. Simple, effective, but requires the server to buffer
messages and handle clients that reconnect after the buffer has expired.

**Event sourcing.** The server stores the full event log. On reconnect,
the client replays from its last checkpoint. Works well for
collaborative editing and state machines. Storage cost grows with event
volume, so you need compaction or snapshotting.

**Last-known-state sync.** Instead of replaying events, the server sends
the full current state on reconnect. Simpler to implement, but wasteful
if the state is large and only a small part has changed. Good enough for
many real-time dashboards and status displays.

Most teams underestimate this problem. They build the happy path —
messages flowing over an open connection — and treat reconnection as an
afterthought. Then they spend months debugging state inconsistencies
that only appear under real network conditions.

## Connection management in frontend frameworks

React components re-render. Every render. If your WebSocket connection
lives inside a `useState` hook or gets created inside `useEffect`
without proper cleanup, every re-render creates a new connection.
The old one stays open on the server. This is a resource leak that
compounds fast.

```javascript
// BAD: creates a new connection on every render cycle
function Chat() {
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("wss://example.com/chat");
    setWs(socket);
    // Missing cleanup — old connections stay open
  }, []);

  return <div>...</div>;
}
```

```javascript
// GOOD: useRef prevents recreation, cleanup closes on unmount
function Chat() {
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket("wss://example.com/chat");
    wsRef.current.onclose = () => {
      /* reconnect logic */
    };
    return () => wsRef.current?.close();
  }, []);

  return <div>...</div>;
}
```

Better still: move the connection entirely outside the component
lifecycle. A singleton connection manager that lives at the module level
survives React's rendering cycle. Components subscribe to messages;
they don't own the connection.

This isn't a React-specific problem. Vue's reactivity system, Svelte's
compiled updates, and Angular's change detection all have similar
patterns where naive WebSocket integration creates connection churn.
The principle is the same everywhere: the WebSocket connection should
outlive any single component.

## Authentication and token renewal

API keys do not belong on client devices. Ever. A key embedded in a
mobile app or SPA can be extracted and used by anyone. Use short-lived
tokens instead.

The pattern that works in production:

1. Client authenticates with your backend over HTTPS
2. Backend issues a short-lived token (JWT or opaque)
3. Client opens a WebSocket with the token as a URL parameter
4. Server validates the token before completing the handshake
5. If the token is invalid, reject immediately — no resources wasted

```javascript
// Token-based WebSocket connection with renewal
async function connect() {
  const token = await fetchToken("/auth/ws-token");
  const ws = new WebSocket(
    `wss://example.com/ws?token=${token.value}`
  );

  ws.onopen = () => {
    // Schedule renewal before token expires
    setTimeout(async () => {
      const fresh = await fetchToken("/auth/ws-token");
      ws.send(JSON.stringify({
        type: "token_refresh",
        token: fresh.value,
      }));
    }, token.expiresIn - 30_000); // 30s before expiry
  };

  return ws;
}
```

Passing the token as a URL parameter (rather than as the first message)
lets the server reject unauthenticated connections at the handshake
level, before allocating any per-connection resources.

The harder problem is token renewal during long-lived connections. A JWT
issued at connection time will expire. You need either an in-band
renewal mechanism (send a fresh token over the existing connection) or
a reconnection strategy (close and reopen with a new token). In-band
renewal is smoother for the user but requires your protocol to
support it.

## Request pipelining — stop thinking in request-response

HTTP trained developers to think in terms of "send a request, wait for
a response." Carrying this pattern into WebSocket wastes the protocol's
primary advantage: you can send multiple messages without waiting for
replies.

Consider a chat application that needs to load message history, fetch
user presence, and subscribe to new messages. The request-response
approach sends three messages sequentially, waiting for each response
before sending the next. With pipelining, you send all three
immediately and process responses as they arrive.

Cap'n Proto's RPC layer demonstrates this well — you can pipeline
requests together, referencing the future result of one request in
another, without waiting for the first to complete. The same principle
applies to WebSocket protocols: design your message format so the
client can fire multiple requests in parallel and correlate responses
using message IDs.

## DoS and abuse prevention

HTTP gives you per-request validation. Every request has headers you
can inspect, rate-limit rules you can apply per endpoint, and
middleware that can reject bad requests before they hit your
application. WebSocket has none of this.

Once a WebSocket connection is authenticated and open, every message
that arrives is opaque to your infrastructure layer. Your load balancer
can't distinguish a legitimate message from an abusive one. Your WAF
sees a single long-lived connection, not discrete requests.

What you need to build:

- **Per-connection rate limiting.** Track messages per second per
  connection. Disconnect clients that exceed thresholds.
- **Message size caps.** Reject messages above a maximum size at the
  protocol level. A malicious client can send arbitrarily large frames
  otherwise.
- **Idle timeouts.** Close connections that haven't sent meaningful
  data within a window. Zombie connections consume server resources.
- **Application-level validation.** Every message needs schema
  validation. Don't trust message types, field values, or payload
  sizes just because the connection is authenticated.

This is fundamentally harder than HTTP security because the
authentication boundary is at connection time, not message time.
A compromised client can send anything over an authenticated
connection. Plan for that.

## When NOT to use WebSocket

WebSocket is the right tool for bidirectional, persistent, low-latency
communication. It is not the right tool for everything that involves
a server sending data to a client.

**Use HTTP instead if:**

- Your data updates less frequently than every few seconds
- You need request-response semantics (caching, status codes,
  retries)
- Your clients are stateless (serverless functions, CLI tools,
  batch processors)

**Use [Server-Sent Events (SSE)](/comparisons/sse/) instead if:**

- Data flows server-to-client only (dashboards, notifications,
  live feeds)
- You want automatic reconnection built into the protocol
- You need HTTP/2 multiplexing to avoid connection limits

**Use [WebTransport](/comparisons/webtransport/) if:**

- You need unreliable delivery for real-time media or gaming
- You want multiplexed streams without head-of-line blocking
- Browser support constraints allow it (still limited in 2026)

The meta-point: these "best practices" are really the reasons why you
shouldn't use raw WebSockets for production systems. Every problem
described here — state sync, auth renewal, connection management,
abuse prevention — is a problem that
[libraries and managed services][managed-services] exist to solve. The
best practice is recognizing what the protocol doesn't give you and
making a deliberate choice about how to fill those gaps.

## Frequently Asked Questions

### What is the most common WebSocket mistake in production?

Treating WebSocket like HTTP is the root cause of most production
issues. Developers expect per-message authentication, automatic
retries, and stateless server behavior — none of which exist after
the handshake. The result is systems that work on localhost but fail
under real network conditions: dropped connections lose state,
reconnecting clients get stale data, and security assumptions that
held for HTTP fall apart. Before building on raw WebSocket, audit
what HTTP was giving you for free and decide how you'll replace each
piece.

### How do you handle authentication on long-lived connections?

Start with short-lived tokens passed as URL parameters for fast
server-side rejection. The real challenge is renewal: a JWT issued
when the connection opens will expire during a long session. You
have two options — send a fresh token over the existing connection
(in-band renewal) or close and reconnect with a new token. In-band
is less disruptive but requires protocol support. Whichever you
choose, never use API keys on untrusted devices, and never assume
a connection stays authenticated forever.

### Should I build my own WebSocket infrastructure?

For a prototype or internal tool, raw WebSocket is fine. For
production systems serving real users, you're building a protocol
on top of a transport. You'll need reconnection with state
recovery, authentication with token renewal, message ordering
guarantees, presence tracking, and monitoring. That's months of
engineering. Libraries like Socket.IO handle some of this.
[Managed services][managed-services] handle all of it, plus
horizontal scaling, global distribution, and guaranteed delivery.

### How do I prevent connection leaks in React?

Use `useRef` to hold the WebSocket instance instead of `useState`.
Always return a cleanup function from `useEffect` that calls
`close()`. For applications with multiple components that need
WebSocket access, extract the connection into a module-level
singleton that components subscribe to rather than own. The
connection's lifecycle should match the application's lifecycle,
not any individual component's lifecycle.

### How is DoS prevention different for WebSocket?

HTTP lets you inspect, rate-limit, and reject every request
independently. WebSocket authenticates once, then the connection
is a black box to your infrastructure. You need application-level
defenses: per-connection message rate limits, payload size caps,
idle connection timeouts, and schema validation on every inbound
message. Your load balancer and WAF can protect the handshake
endpoint but cannot help once the connection is upgraded.

## Related Content

- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) —
  understand the framing, opcodes, and handshake at the wire level
- [WebSockets at Scale](/guides/websockets-at-scale/) — load
  balancing, horizontal scaling, and connection management patterns
- [WebSocket Security Hardening](/guides/security/) — TLS, origin
  validation, and attack surface reduction
- [Building a WebSocket App](/guides/building-a-websocket-app/) —
  step-by-step implementation from first connection to deployment
- [WebSocket vs SSE](/comparisons/sse/) — when server-to-client
  is enough and WebSocket is overkill

[managed-services]:
  https://ably.com/websockets?utm_source=websocket-org&utm_medium=best-practices
