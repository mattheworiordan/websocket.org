---
title: 'WebSocket Browser Support & Compatibility Table (2026)'
description: >-
  WebSocket is supported by 99%+ of browsers. Full compatibility table for
  Chrome, Firefox, Safari, Edge, mobile browsers, and Node.js runtimes.
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: 2026-03-12
lastUpdated: 2026-03-12
category: reference
sidebar:
  order: 7
keywords:
  - websocket browser support
  - websocket compatibility
  - websocket caniuse
  - websocket browser
seo:
  keywords:
    - websocket browser support
    - websocket compatibility
    - websocket caniuse
    - websocket browser
    - can i use websocket
    - websocket ie
faq:
  - q: 'Which browsers support WebSocket?'
    a: >-
      All modern browsers support WebSocket: Chrome 16+, Firefox 11+,
      Safari 7+, Edge 12+, Opera 12.1+, and all mobile browsers. Global
      support is 99%+. Browser compatibility is not a practical concern
      for any modern application.
  - q: 'Does Internet Explorer support WebSocket?'
    a: >-
      IE 10+ supports WebSocket. IE 9 and below do not. Since IE was
      retired in June 2022 and has negligible usage, this is no longer a
      practical consideration.
  - q: 'What happens if WebSocket is not supported?'
    a: >-
      For the rare cases where WebSocket is blocked (usually by corporate
      proxies, not browser limitations), use a library like Socket.IO
      that falls back to HTTP long-polling, or a managed service like
      Ably that handles transport negotiation automatically.
---

:::note[Quick Answer]
WebSocket is supported by **every modern browser**. Global
support exceeds 99%. The WebSocket API (RFC 6455) has been
stable since 2011. Browser compatibility is not a concern
for any application targeting modern browsers.
:::

## Desktop Browser Support

| Browser           | WebSocket Since | Current Status     |
| ----------------- | --------------- | ------------------ |
| Chrome            | 16 (2011)       | Full support       |
| Firefox           | 11 (2012)       | Full support       |
| Safari            | 7 (2013)        | Full support       |
| Edge              | 12 (2015)       | Full support       |
| Opera             | 12.1 (2012)     | Full support       |
| Internet Explorer | 10 (2012)       | Retired, June 2022 |

IE 10 added WebSocket support; IE 9 and below never did.
Since Microsoft retired IE in June 2022 and global usage is
effectively zero, IE compatibility is no longer a practical
concern.

## Mobile Browser Support

| Browser            | WebSocket Since | Current Status |
| ------------------ | --------------- | -------------- |
| iOS Safari         | 7 (2013)        | Full support   |
| Android Browser    | 4.4 (2013)      | Full support   |
| Chrome for Android | 16+             | Full support   |
| Samsung Internet   | 4 (2016)        | Full support   |
| Opera Mobile       | 12.1+           | Full support   |

Every major mobile browser has supported WebSocket for over
a decade. There is no mobile-specific limitation.

## Server-Side Runtime Support

| Runtime | WebSocket Support                       |
| ------- | --------------------------------------- |
| Node.js | No built-in API. Use the `ws` library   |
| Deno    | Built-in `WebSocket` API                |
| Bun     | Built-in `WebSocket` API                |

Node.js is the outlier. It has no native WebSocket
implementation, so you need a library. The
[`ws`](https://github.com/websockets/ws) package is the
standard choice: it is fast, spec-compliant, and has zero
dependencies.

```javascript
// Node.js with ws
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => console.log(data));
  ws.send('connected');
});
```

Deno and Bun both provide a browser-compatible `WebSocket`
constructor out of the box, with no additional packages
required.

## When WebSocket Is Blocked

The real compatibility problem is not browsers. It is
**corporate networks and proxies** that block the HTTP
Upgrade request WebSocket requires.

This happens because:

- Transparent proxies that only understand HTTP/1.1 request
  and response cycles drop the Upgrade header
- Deep packet inspection firewalls may block non-HTTP
  traffic on port 443
- Some enterprise Wi-Fi controllers terminate and
  re-establish TLS, breaking the Upgrade handshake

Using `wss://` (WebSocket over TLS on port 443) avoids most
of these issues because proxies cannot inspect encrypted
traffic. But some corporate environments terminate TLS at
the proxy level, which breaks even `wss://` connections.

## Fallback Strategies

For applications that must work behind restrictive proxies,
three approaches work:

**Socket.IO** detects WebSocket failure and falls back to
HTTP long-polling automatically. This adds latency but
maintains functionality.

**Server-Sent Events (SSE)** work as a fallback for
server-to-client streaming only. SSE uses standard HTTP
responses, which proxies do not block. If you need
bidirectional communication, pair SSE with regular HTTP POST
requests.

**Managed services** like
[Ably](https://ably.com/docs/connect?utm_source=websocket-org&utm_medium=browser-support)
handle transport negotiation automatically. They detect when
WebSocket is blocked and switch to a working transport
without application code changes.

## Frequently Asked Questions

### Which browsers support WebSocket?

Every browser released since 2013 supports WebSocket. The
API has been stable for over a decade with no breaking
changes, which is rare for a web platform feature. You can
verify current numbers on
[caniuse.com](https://caniuse.com/websockets) — global
support sits above 99%. Unlike features like WebTransport
or WebCodecs, there is no meaningful browser fragmentation
to worry about. If you are building a greenfield
application today, treat WebSocket support as a given and
focus your compatibility testing on network conditions
(proxies, firewalls) rather than browser versions.

### Does Internet Explorer support WebSocket?

IE 10 added WebSocket support in 2012. IE 9 and below
never supported it. Microsoft retired IE entirely in June
2022, and global usage is effectively zero. If your
analytics still show IE traffic, it is almost certainly
bots or misconfigured enterprise kiosks — not real users
you need to support. Remove any IE-specific WebSocket
polyfills or fallbacks from your codebase; they add bundle
size for no benefit.

### What happens if WebSocket is not supported?

The question today is not "does the browser support it?"
but "does the network allow it?" Corporate proxies that
terminate TLS and re-establish it can break the HTTP
Upgrade handshake even on port 443. When this happens, the
`onerror` event fires but the error message is generic —
you cannot distinguish a proxy block from a server outage.

Three fallback approaches work:

- **Socket.IO** detects failure and drops to HTTP
  long-polling automatically, adding latency but
  maintaining functionality
- **SSE + HTTP POST** gives you server push via standard
  HTTP responses that proxies cannot block, paired with
  POST requests for the client-to-server direction
- **Managed services** like
  [Ably](https://ably.com?utm_source=websocket-org&utm_medium=browser-support)
  handle transport negotiation at the SDK level — your
  code uses the same API regardless of which transport
  is active underneath

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) —
  events, methods, and properties
- [WebSocket Close Codes](/reference/close-codes/) —
  status code reference
- [What Are WebSockets?](/guides/road-to-websockets/) —
  how WebSocket connections work
- [WebSocket vs HTTP](/comparisons/http/) —
  when to use each protocol
- [WebSocket vs SSE](/comparisons/sse/) —
  choosing the right streaming protocol
