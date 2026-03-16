---
title: 'WebSocket Error Handling: Close Codes and Recovery'
description:
  'Handle WebSocket errors using close codes, not onerror. Classify
  errors as transient or permanent, implement retry logic, and build
  production-grade systems.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-16
lastUpdated: 2026-03-16
category: guide
keywords:
  - websocket error handling
  - websocket onerror
  - websocket close codes
  - websocket error event
  - websocket connection error
  - websocket retry
  - websocket error classification
seo:
  keywords:
    - websocket error handling
    - websocket onerror
    - websocket close codes
    - websocket error event
    - websocket connection error
    - websocket retry logic
    - websocket production errors
faq:
  - q: 'Why does the WebSocket onerror event not give any details?'
    a:
      'The browser intentionally hides error details from onerror for
      security reasons. Exposing network error specifics could leak
      information about internal infrastructure. Use the onclose event
      instead — the close code and reason string tell you what happened.'
  - q: 'Which WebSocket close codes should I retry on?'
    a:
      'Retry on transient codes: 1006 (abnormal closure), 1011 (server
      error), 1012 (server restart), and 1013 (try again later). Do not
      retry on permanent codes like 1008 (policy violation) or 1003
      (unsupported data) — those need a code fix, not a retry.'
  - q: 'How do I buffer messages during a WebSocket disconnection?'
    a:
      'Queue outbound messages in a bounded buffer (100 messages or 1MB)
      during disconnection. On reconnect, flush the buffer. If the
      buffer overflows, drop the oldest messages first. Pair this with
      idempotency keys so the server can deduplicate replayed messages.'
  - q: 'What should I monitor for WebSocket errors in production?'
    a:
      'Track close code distribution over time. A spike in 1006 errors
      signals network issues. A spike in 1008 errors points to an auth
      bug. Alert on sustained error rates above your baseline, and track
      error rate per connection to catch client-specific problems.'
  - q: 'Should I close the WebSocket on a message parse error?'
    a:
      'No. A single malformed message does not mean the connection is
      bad. Log the error, skip the message, and continue. Closing the
      connection on a parse error throws away a working transport and
      forces an unnecessary reconnection cycle.'
---

:::note[Quick Answer]
WebSocket error handling relies on close codes, not the `onerror`
event. The browser `onerror` gives you almost no useful information.
Classify errors as transient (retry with backoff) or permanent
(surface to user), using the
[close code](/reference/close-codes/) from the `onclose` event to
decide which is which.
:::

## Handshake failures: errors before the connection exists

Before your WebSocket connection is established, the HTTP upgrade
handshake can fail. The server returns an HTTP error code (403, 502,
etc.) but the browser does not expose it to JavaScript. You get an
`onerror` followed by `onclose` with code 1006 and an empty reason.

Common causes: CORS misconfiguration (the server does not include
the right `Access-Control` headers), proxy not supporting the
`Upgrade` header (older HTTP/1.0 proxies), authentication failure
during the upgrade, or the server rejecting the connection due to
rate limiting. Debug these with browser DevTools - the Network tab
shows the HTTP upgrade request and the server's response status. See
[Connection Refused](/guides/troubleshooting/connection-refused/) for
a full troubleshooting guide.

## The browser gives you nothing useful on error

The WebSocket `onerror` event is one of the most misleading APIs
in the browser. It fires when something goes wrong, but provides
no error code, no message, and no details about what happened:

```javascript
const ws = new WebSocket("wss://example.com/ws");

ws.onerror = (event) => {
  // event.message → undefined
  // event.code → undefined
  // event.reason → undefined
  console.log(event); // Generic Event object. Useless.
};
```

This is by design. The browser hides error details to prevent
scripts from probing internal network infrastructure. A malicious
page cannot distinguish "server refused the connection" from
"firewall blocked port 443" — and that is a security feature, not
a bug.

The real signal is in `onclose`. When a WebSocket connection fails
or is terminated, `onclose` fires with a numeric
[close code](/reference/close-codes/) and a reason string that
tell you exactly what happened:

```javascript
ws.onclose = (event) => {
  console.log(event.code); // 1006, 1008, 1011, etc.
  console.log(event.reason); // Human-readable explanation
};
```

**Practical rule**: use `onerror` only for logging that an error
occurred. Use `onclose` for all decision-making — whether to
retry, what to tell the user, and what to report to your
monitoring system.

## Error classification framework

Not all close codes are equal. Some mean "try again," others mean
"stop trying and fix your code." Treating them the same — either
retrying everything or surfacing every error to the user — is the
most common error handling mistake in production WebSocket code.

### Transient errors (retry with backoff)

These indicate temporary problems. Retry with
[exponential backoff](/guides/reconnection/):

| Code | Name            | Meaning                                   |
| ---- | --------------- | ----------------------------------------- |
| 1006 | Abnormal Close  | Network dropped, no close frame received  |
| 1011 | Internal Error  | Server hit an unexpected condition        |
| 1012 | Service Restart | Server is restarting, come back soon      |
| 1013 | Try Again Later | Server is overloaded, back off            |

### Permanent errors (do not retry)

These indicate a problem that retrying will not fix. Surface the
error and fix the underlying cause:

| Code | Name             | Meaning                              |
| ---- | ---------------- | ------------------------------------ |
| 1008 | Policy Violation | Auth failed, invalid origin, banned  |
| 1003 | Unsupported Data | Server cannot handle the data type   |
| 1002 | Protocol Error   | Malformed frame, protocol violation  |

### Normal closures (no action needed)

| Code | Name           | Meaning                              |
| ---- | -------------- | ------------------------------------ |
| 1000 | Normal Closure | Clean shutdown, both sides agreed    |
| 1001 | Going Away     | Server shutting down or navigating   |

### Classification in code

```javascript
function classifyClose(code) {
  switch (code) {
    case 1000:
    case 1001:
      return "normal";
    case 1006:
    case 1011:
    case 1012:
    case 1013:
      return "transient";
    case 1002:
    case 1003:
    case 1008:
      return "permanent";
    default:
      // 4000-4999: application-defined codes
      return code >= 4000 ? "application" : "transient";
  }
}

ws.onclose = (event) => {
  const type = classifyClose(event.code);
  if (type === "transient") {
    scheduleReconnect(); // backoff + retry
  } else if (type === "permanent") {
    showError(event.code, event.reason);
  }
  // 'normal' — do nothing
};
```

For the full list of close codes and their meanings, see the
[WebSocket Close Codes Reference](/reference/close-codes/).

## Production error handling patterns

### JavaScript (browser)

```javascript
function createConnection(url, handlers) {
  const ws = new WebSocket(url);

  ws.onerror = () => {
    // Log only — no useful information here
    handlers.onError?.("connection_error");
  };

  ws.onclose = (event) => {
    const type = classifyClose(event.code);
    handlers.onClose?.(event.code, event.reason, type);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.onMessage?.(data);
    } catch (e) {
      // Bad message — log it, do NOT close the connection
      handlers.onParseError?.(event.data, e);
    }
  };

  return ws;
}
```

### Node.js (ws library)

Node.js gives you more error detail than the browser. The `error`
event fires with an actual `Error` object, and you can distinguish
connection-phase errors from message-phase errors:

```javascript
const WebSocket = require("ws");
const ws = new WebSocket("wss://example.com/ws");

ws.on("error", (err) => {
  // Unlike browser, err has useful properties
  if (err.code === "ECONNREFUSED") {
    // Server is down — retry
  } else if (err.code === "ENOTFOUND") {
    // DNS failure — permanent, check your URL
  }
});

ws.on("close", (code, reason) => {
  const type = classifyClose(code);
  // Same classification logic as browser
});
```

### Python (websockets library)

```python
import websockets
from websockets.exceptions import ConnectionClosed

async def connect(uri):
    try:
        async with websockets.connect(uri) as ws:
            async for message in ws:
                try:
                    data = json.loads(message)
                    handle_message(data)
                except json.JSONDecodeError:
                    log.warning("Bad message, skipping")
    except ConnectionClosed as e:
        if e.code in (1006, 1011, 1012, 1013):
            await reconnect_with_backoff()
        else:
            raise  # Permanent error — propagate
```

### Go (gorilla/websocket)

```go
_, msg, err := conn.ReadMessage()
if err != nil {
    if websocket.IsCloseError(err,
        websocket.CloseNormalClosure,
        websocket.CloseGoingAway) {
        return // Clean shutdown
    }
    if websocket.IsUnexpectedCloseError(err,
        websocket.CloseAbnormalClosure,
        websocket.CloseInternalServerErr) {
        log.Printf("transient close: %v", err)
        scheduleReconnect()
        return
    }
    log.Printf("unexpected error: %v", err)
}
```

## Common mistakes

### Closing the connection on a message parse error

A single bad message does not mean the connection is broken. The
transport is fine — one message was malformed. Log it and move on:

```javascript
// Wrong: kills a working connection
ws.onmessage = (event) => {
  try {
    handle(JSON.parse(event.data));
  } catch (e) {
    ws.close(1002, "invalid message"); // Don't do this
  }
};

// Right: skip the bad message, keep the connection
ws.onmessage = (event) => {
  try {
    handle(JSON.parse(event.data));
  } catch (e) {
    logParseError(event.data, e);
  }
};
```

### No distinction between transient and permanent errors

Retrying an authentication failure
([code 1008](/reference/close-codes/)) with exponential backoff
will retry forever and never succeed. The token is invalid or the
origin is blocked — retrying the same request changes nothing.
Classify the error first, then decide whether to retry.

### Unbounded retry loops

Always set a ceiling. Either a maximum retry count (10-15
attempts) or a maximum elapsed time (2-5 minutes). After the
limit, surface a "connection lost" state to the user and let them
retry manually. On mobile, unbounded retries drain battery with
zero benefit. See the
[reconnection guide](/guides/reconnection/) for backoff
implementation.

### console.log as the only error handling

`console.log` is not monitoring. In production, you need:

- **Structured logging** with close codes, connection duration,
  and timestamps
- **Metrics** tracking error rates and
  [close code](/reference/close-codes/) distribution
- **Alerting** on sustained error rate spikes

You do not need a full observability stack on day one, but you
need more than `console.log`.

## Message buffering during errors

When the connection drops, outbound messages have nowhere to go.
Without buffering, they are silently lost. A bounded buffer
prevents data loss during short disconnections:

```javascript
class MessageBuffer {
  constructor({ maxSize = 100, maxBytes = 1_048_576 } = {}) {
    this.queue = [];
    this.bytes = 0;
    this.maxSize = maxSize;
    this.maxBytes = maxBytes;
  }

  push(message) {
    const size = JSON.stringify(message).length;
    while (
      this.queue.length >= this.maxSize ||
      this.bytes + size > this.maxBytes
    ) {
      const dropped = this.queue.shift();
      this.bytes -= JSON.stringify(dropped).length;
    }
    this.queue.push(message);
    this.bytes += size;
  }

  flush(sendFn) {
    while (this.queue.length > 0) {
      sendFn(this.queue.shift());
    }
    this.bytes = 0;
  }
}
```

**Key decisions**:

- **Bound the buffer** — 100 messages or 1MB, whichever comes
  first. An unbounded buffer will consume all available memory on
  a long disconnection
- **Drop oldest first** — newest messages are usually more
  relevant than stale ones
- **Flush on reconnect** — after the new connection is
  established, drain the buffer before sending new messages

For full reconnection patterns including server-side message
replay and sequence tracking, see the
[reconnection guide](/guides/reconnection/).

## Monitoring and alerting

Close code distribution over time is the single most useful
WebSocket metric you can track. It tells you exactly what
category of failure is happening:

- **Spike in [1006](/reference/close-codes/)** — network-level
  issue. Check load balancer health, proxy timeouts, or a network
  partition
- **Spike in [1008](/reference/close-codes/)** — authentication
  bug. A deploy may have broken token validation or changed CORS
  policy
- **Spike in 1011** — server-side crash. Check your application
  logs for unhandled exceptions
- **Spike in 1012** — expected during deploys. If it persists,
  your deploy is stuck

Track error rate per connection, not just globally. A high global
error rate might be one user with a bad network generating
thousands of reconnections. Per-connection rates separate
infrastructure problems from individual client issues.

Set alerts on sustained error rates above your baseline. A brief
spike during a deploy is normal. A sustained elevation over 10-15
minutes means something is broken. You do not need a full
observability platform to start — even basic counters by close
code in your existing metrics system will catch most WebSocket
incidents before users report them.

## Frequently asked questions

### Why does the WebSocket onerror event not give any details?

The browser hides error details from JavaScript for security. If
`onerror` exposed network-level information like "connection
refused on port 8080" or "TLS handshake failed," a malicious
script could probe internal network infrastructure. The
[close code](/reference/close-codes/) in `onclose` provides the
information you need — what type of failure occurred, without
leaking how your network is structured. Use `onerror` for logging
and `onclose` for decision-making.

### Which WebSocket close codes should I retry on?

Retry on codes that indicate temporary conditions:
[1006](/reference/close-codes/) (abnormal closure — usually a
network drop), 1011 (server internal error), 1012 (server
restart), and 1013 (try again later). Do not retry on 1008
(policy violation — typically auth failure), 1003 (unsupported
data), or 1002 (protocol error). These indicate a bug in your
code or configuration, not a transient problem. See the
[close codes reference](/reference/close-codes/) for the full
list.

### How do I buffer messages during a WebSocket disconnection?

Queue outbound messages in a bounded in-memory buffer during
disconnection. Set both a message count limit (100 messages) and
a byte size limit (1MB). When the buffer overflows, drop the
oldest messages — newer data is usually more relevant. On
reconnect, flush the entire buffer before sending new messages.
Pair this with idempotency keys on each message so the server
can deduplicate if a message was sent but not acknowledged before
the connection dropped.

### What should I monitor for WebSocket errors in production?

Track the distribution of
[close codes](/reference/close-codes/) over time. Each code maps
to a failure category: 1006 is network, 1008 is auth, 1011 is
server crash. A change in distribution tells you what broke. Also
track error rate per connection to distinguish infrastructure-wide
problems from one client with a bad network hammering your
reconnection endpoint. Alert on sustained rate increases, not
individual spikes.

### Should I close the WebSocket on a message parse error?

No. A malformed message means one message was bad, not that the
connection is broken. Log the error with the raw message payload
for debugging, skip that message, and keep processing. Closing
the connection forces a full reconnection cycle — DNS lookup, TCP
handshake, TLS negotiation, WebSocket upgrade — all because of
one bad JSON payload. Reserve connection closure for actual
transport or protocol failures.

## Related content

- [WebSocket Close Codes Reference](/reference/close-codes/)
  — full list of close codes and their meanings
- [WebSocket Reconnection](/guides/reconnection/) — exponential
  backoff, jitter, and state synchronization after reconnection
- [WebSocket Best Practices](/guides/best-practices/) — production
  patterns for authentication, heartbeats, and error handling
- [Timeout and Dropped Connections](/guides/troubleshooting/timeout/)
  — diagnosing connections that silently die
- [Connection Refused Errors](/guides/troubleshooting/connection-refused/)
  — debugging failed WebSocket handshake errors
