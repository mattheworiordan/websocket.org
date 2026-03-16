---
title: 'AI Token Streaming: From SSE to Durable Sessions'
description:
  'How AI token streaming works with SSE, where it breaks for agentic
  workflows, and why durable sessions are the emerging architectural
  pattern for production AI.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - ai token streaming
  - llm streaming websocket
  - ai streaming sse
  - durable sessions ai
  - ai agent websocket
  - server sent events ai
  - ai sdk streaming
seo:
  keywords:
    - ai token streaming
    - llm streaming websocket
    - ai streaming server sent events
    - durable sessions
    - ai agent streaming
    - websocket ai integration
    - vercel ai sdk streaming
faq:
  - q: 'Why do most AI APIs use SSE instead of WebSocket?'
    a:
      'SSE works over plain HTTP, needs no library, passes through every
      CDN and proxy, and fits the request-response pattern of chat
      completions. Since most AI interactions are single-turn (user
      sends prompt, model streams back), SSE is the simplest choice
      that works.'
  - q: 'What is a durable session in AI streaming?'
    a:
      'A durable session is a persistent, addressable interaction layer
      between an agent and a user that outlives any single connection.
      It survives disconnects, device switches, and agent handoffs by
      persisting state and enabling offset-based resumption.'
  - q: 'When should I use WebSocket instead of SSE for AI?'
    a:
      'When you need bidirectional communication: tool call approvals,
      user steering mid-generation, presence awareness, or
      multi-device sync. SSE is server-to-client only, so any
      client-to-server interaction requires a separate HTTP request
      and coordination logic.'
  - q: 'What happens when an SSE connection drops during AI generation?'
    a:
      'The EventSource API reconnects automatically, but the generation
      state is lost. The model has no concept of where it left off.
      For a 5-minute agent task that drops at minute 4, that means
      restarting from scratch and paying for the compute again.'
  - q: 'How does backpressure work in AI token streaming?'
    a:
      'Without flow control, a fast-streaming server fills the client
      memory buffer until it crashes. WebSocket supports client-side
      pause and resume signals. SSE has no backpressure mechanism, so
      slow clients on mobile or long agent tasks risk memory
      exhaustion.'
---

:::note[Quick Answer]
Most AI APIs stream tokens via SSE, which works for simple chat. As
AI moves to agentic workflows — tool calls, multi-device sessions,
long-running tasks — a new pattern is emerging: durable sessions.
These persistent, resumable interaction layers outlive any single
connection and solve the problems SSE was not designed for.
:::

## How token streaming works today

Every major AI provider — OpenAI, Anthropic, Google — streams
tokens via Server-Sent Events. The pattern is the same across all
of them: client sends a prompt over HTTP POST, server responds with
a stream of token events.

Here is the basic pattern in JavaScript:

```javascript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [{ role: "user", content: "Explain WebSockets" }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Each chunk is "data: {json}\n\n" — parse and render
  process.stdout.write(parseToken(chunk));
}
```

This is SSE over `fetch`. Some implementations use the browser's
`EventSource` API instead, but the transport is the same:
unidirectional, server-to-client, over HTTP.

## Where SSE works fine

For single-turn chat — user sends prompt, model streams back — SSE
is the right choice. It is simple, built into browsers, works
through every CDN and proxy, has automatic reconnection, and needs
no library.

If you are building a basic chatbot, a search summarizer, or a
single-turn Q&A interface, SSE handles it well. Do not add
complexity you do not need. The threshold for switching away from
SSE is when your AI interaction becomes stateful, bidirectional,
or long-running.

## Where SSE breaks: the Gen 2 AI problem

As AI moves from single-turn chat to agentic workflows, SSE hits
fundamental limits. These are not edge cases — they are the core
interaction patterns of production AI systems.

### Connection drops lose generation state

SSE reconnects automatically via `EventSource`, but the generation
state is gone. The model has no concept of "resume from token 847."
A 5-minute agent task that drops at minute 4 means restarting from
scratch — wasted compute, wasted money, frustrated user. At
current API pricing, a dropped 10,000-token generation costs
$0.03-0.30 in wasted compute depending on the model. Multiply by
thousands of daily users on mobile networks, and the cost of not
having resumability becomes measurable.

On mobile networks, connections drop constantly. Wi-Fi to cellular
handoffs, elevator rides, subway tunnels. Every drop restarts the
entire generation.

### Tool call approval needs bidirectionality

Modern AI agents propose tool calls: "I want to run this database
query" or "I need to call this API." The user needs to approve.
SSE is server-to-client only. The approval requires a separate
HTTP request back to the server, with all the coordination
complexity that implies — correlating the approval to the right
tool call, handling race conditions if the stream continues, and
managing timeouts.

### Live steering has no path

The user wants to interrupt mid-generation: "stop, go back, try a
different approach." This is barge-in, and it requires
client-to-server messaging on the same session. With SSE, you
close the connection (losing state) and start a new request.
There is no way to send a "change direction" signal on an SSE
stream.

### Multi-device continuity does not exist

Start a conversation with an AI agent on your laptop, walk to a
meeting, pull out your phone. With SSE, each connection is
independent. There is no session identity, no way to subscribe a
second device to the same generation stream.

### Multi-agent coordination lacks ordering guarantees

Multiple agents working on a shared task — a coding agent, a
testing agent, a review agent — need to read each other's output
in order. SSE provides no message ordering guarantees across
multiple streams and no shared state primitive.

### Background completion has nowhere to go

An agent finishes a long research task after the user closes the
tab. With SSE, the stream had one consumer and it is gone. The
results vanish. The user comes back and the work is lost.

## The framework ecosystem is signaling the shift

The AI framework ecosystem has started building abstractions
specifically to replace SSE as the default transport:

- **Vercel AI SDK** deprecated its SSE-based `StreamingTextResponse`
  in favor of a pluggable `ChatTransport` interface that accepts
  any bidirectional transport
- **TanStack AI** introduced a `ConnectionAdapter` abstraction,
  decoupling streaming from any specific transport
- **AG-UI** (Agent-User Interaction Protocol) designed transport
  agnosticity from day one, with SSE as just one option
- **MCP** (Model Context Protocol) deprecated its HTTP+SSE transport
  entirely, replacing it with Streamable HTTP

These are not fringe projects. They are the dominant AI
application frameworks, and they are all creating extension points
because developers need alternatives to SSE.

## Durable sessions: the emerging pattern

A durable session is a persistent, addressable interaction layer
between agents and users that outlives any single connection.

It is not a connection (which breaks). It is not a channel (which
is a transport primitive). It is the stateful layer that persists
across disconnects, device switches, and agent handoffs.

The analogy is durable execution. Just as Temporal and Restate
make backend workflows crash-proof by persisting state across
failures, durable sessions make user-facing AI experiences
crash-proof. The session is the unit of persistence, not the
connection.

The term "durable sessions" is emerging, not yet standardized.
ElectricSQL coined it in late 2025; other vendors use different
names for similar patterns. The concept matters more than the
label. See [durablesessions.ai](https://durablesessions.ai) for a
vendor-neutral overview of the pattern.

### What durable sessions provide

**Resumable streaming.** The client reconnects at the
last-acknowledged offset. No duplicate tokens, no restart. The
5-minute agent task that drops at minute 4 resumes at minute 4.
The session tracks what was delivered, not what was sent.

**Multi-device fan-out.** All tabs and devices subscribe to the
same session. Start on laptop, continue on phone. Both see the
same token stream, in order, without gaps.

**Bidirectional interaction.** Tool call proposals flow
server-to-client. User approvals flow client-to-server. Steering
signals, cancellation, preference updates — all through the same
session, with ordering guarantees.

**Presence awareness.** The session knows if a user is actively
consuming tokens. If nobody is watching, the system can defer
expensive generation, batch results, or reduce streaming priority
to save compute.

**Asynchronous participation.** Join a session after the fact and
get the full history. An agent finishes while you are away — the
results are waiting when you return, with the complete interaction
log intact.

Here is what a durable session client looks like conceptually:

```javascript
// Conceptual: what a durable session client looks like
const session = durableSession.connect("session_abc123", {
  lastOffset: localStorage.getItem("lastOffset") || 0,
});

session.on("token", (token, offset) => {
  renderToken(token);
  localStorage.setItem("lastOffset", offset);
});

session.on("toolCall", (call) => {
  // Agent proposes a tool call — user approves or rejects
  showApprovalDialog(call, (approved) => {
    session.send({ type: "toolResponse", callId: call.id, approved });
  });
});

// Works across disconnects, device switches, tab reloads
// The session layer handles resumption automatically
```

This is pseudocode illustrating the pattern, not a specific
vendor's API. The implementations from ElectricSQL, Ably, Upstash,
and Convex each expose this pattern differently, but the core
concept is the same: connect to a session by ID, resume from an
offset, and handle bidirectional events.

## Who is building this layer

Multiple companies have converged on this pattern independently:

**[ElectricSQL](https://electric-sql.com) (Durable Streams).** An
open protocol for persistent, addressable, real-time streams.
Built on HTTP with offset-based resumability and CDN compatibility.
Open source under Apache 2.0. ElectricSQL is building structured
[Durable Sessions](https://durablesessions.ai) on top, targeting
collaborative AI with TanStack DB integration.

**[Ably](https://ably.com/ai?utm_source=websocket-org&utm_medium=use-cases)
(AI Transport).** Durable sessions built on Ably's global pub/sub
infrastructure. Provides resumable token streaming, live steering
and barge-in, tool call coordination, and presence-aware cost
controls.

**[Upstash](https://upstash.com) (Resumable AI SDK Streams).** Uses
Redis Streams as the persistence layer, giving AI SDK streams
durability through an existing infrastructure primitive. Tokens
persist in Redis, so clients reconnect and resume from the last
received offset.

**[Convex](https://www.convex.dev) (Agent Component).** Persistent
threads and real-time sync backed by their reactive database. The
agent state lives in the database, so conversations survive
disconnects and support real-time subscriptions from multiple
clients.

<!-- prettier-ignore -->
| Approach | Transport | Persistence | Open source | Best for |
|----------|-----------|-------------|-------------|----------|
| ElectricSQL | HTTP (offset-based) | Postgres-backed | Apache 2.0 | Open protocol + database integration |
| Ably | WebSocket (global pub/sub) | Managed infrastructure | SDKs are open | Managed scale + framework integrations |
| Upstash | HTTP + Redis Streams | Redis-backed | Partial | Teams already using Redis |
| Convex | WebSocket (reactive DB) | Convex database | Open source runtime | Convex's reactive data platform |

The convergence is the signal — this is not one vendor's feature,
it is an emerging architectural layer.

## Why WebSocket matters underneath

Durable sessions need a transport, and WebSocket is the strongest
option for token delivery.

**Frame overhead.** WebSocket uses 2-6 bytes of framing per
message. SSE sends full HTTP headers with every event. At
hundreds of tokens per second, this adds up — especially on
metered mobile connections.

**Native bidirectionality.** Tool call approvals, steering signals,
and presence updates need to flow client-to-server. WebSocket
carries both directions on a single TCP connection. SSE requires
a separate HTTP request for every client-to-server message.

**Lower latency.** No HTTP overhead per message means faster
token delivery. For real-time AI interactions, the difference
between 1ms and 50ms framing overhead is perceptible when
multiplied across thousands of tokens.

The durable session layer sits on top of WebSocket (or HTTP as a
fallback) and adds persistence, resumability, and state
management. WebSocket is the transport; the durable session is the
abstraction.

## Backpressure: the problem nobody talks about

What happens when the server streams tokens faster than the client
can render? On a fast model generating hundreds of tokens per
second to a slow mobile device, the client buffers tokens in
memory. Without flow control, this buffer grows until the browser
tab crashes.

SSE has no backpressure mechanism. The server sends, the client
receives. There is no way for the client to signal "slow down"
over an SSE stream.

WebSocket enables backpressure through TCP flow control. When the
client stops reading from the socket, TCP's receive window fills
up, and the server naturally slows down. Some implementations add
explicit pause/resume signals at the application layer:

```javascript
// Application-level backpressure over WebSocket
socket.send(JSON.stringify({ type: "pause", reason: "rendering" }));

// Resume when render queue drains
socket.send(JSON.stringify({ type: "resume", lastRendered: 847 }));
```

In practice, most implementations rely on TCP flow control rather
than application-level signals. When the client's receive buffer
fills, TCP back-pressure naturally slows the sender. The
application-level approach above is useful when you need
finer-grained control — for example, pausing generation entirely
rather than just slowing the stream.

For long-running agent tasks that produce large outputs, consider
token budgets — a per-session limit on buffered-but-unrendered
tokens. When the budget is exceeded, the server pauses generation
until the client catches up. This prevents both memory exhaustion
and wasted compute.

## FAQ

### Why do most AI APIs use SSE instead of WebSocket?

SSE works over plain HTTP, needs no library beyond the browser's
built-in `EventSource`, and passes through every CDN and proxy
without special configuration. It fits the request-response pattern
of chat completions naturally: POST the prompt, stream back tokens.
For single-turn interactions, SSE has a lower integration cost than
WebSocket and fewer infrastructure surprises. The trade-off only
becomes visible when you need bidirectionality or session persistence.

### What is a durable session in AI streaming?

A durable session is a persistent, addressable interaction layer
between an agent and a user that outlives any single connection. It
survives disconnects, device switches, and agent handoffs by
persisting state and enabling offset-based resumption. Think of it
as the AI equivalent of durable execution (Temporal, Restate) -
instead of making backend workflows crash-proof, durable sessions
make user-facing AI experiences crash-proof. See the
[Durable Sessions pattern overview](https://durablesessions.ai)
for a vendor-neutral introduction.

### When should I use WebSocket instead of SSE for AI?

When you need bidirectional communication on the same connection:
tool call approvals where the user confirms before the agent acts,
live steering to redirect mid-generation, or presence awareness to
know if anyone is consuming tokens. SSE is server-to-client only,
so any client-to-server interaction requires a separate HTTP
request with its own latency and coordination logic. If your AI
integration is simple prompt-in, tokens-out with no interruption,
SSE is the better choice. See the
[WebSocket vs SSE comparison](/comparisons/sse/) for a broader
breakdown.

### What happens when an SSE connection drops during generation?

The `EventSource` API reconnects automatically using the
`Last-Event-ID` header, but the generation state on the server is
typically gone. The model has no concept of where it left off -
it was streaming into a response that no longer has a consumer.
For a 5-minute agent task that drops at minute 4, that means
restarting from scratch and paying for the compute again. Durable
sessions solve this by tracking delivery offsets server-side, so
the client resumes at exactly the token where it disconnected.

### How does backpressure work in AI token streaming?

Without flow control, a fast-streaming server fills the client's
memory buffer until the browser tab crashes. WebSocket supports
application-level pause/resume signals and benefits from TCP flow
control - when the client stops reading, the TCP receive window
fills and the server naturally slows. SSE has no backpressure
mechanism at all. For long-running agent tasks or slow mobile
clients, consider implementing token budgets: a per-session cap
on buffered-but-unrendered tokens that pauses generation until
the client catches up.

## Related Content

- [WebSockets vs SSE](/comparisons/sse/)
- [WebSocket Reconnection](/guides/reconnection/)
- [WebSocket Best Practices](/guides/best-practices/)
- [Real-time Notifications](/guides/use-cases/notifications/)
- [Managed WebSocket Services Compared](/comparisons/managed-services/)
