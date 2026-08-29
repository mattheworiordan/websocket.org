---
title: "WebSockets with Next.js: SSR, App Router, and Vercel"
description:
  "How to use WebSockets in Next.js. Covers App Router client
  components, Vercel Functions, custom servers, SSR hydration traps,
  and the auth token handoff pattern."
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-23
lastUpdated: 2026-08-30
category: guide
keywords:
  - nextjs websocket
  - next.js websocket
  - websocket next.js app router
  - nextjs real-time
  - websocket vercel
  - nextjs server sent events
  - websocket client component
seo:
  keywords:
    - nextjs websocket
    - next.js websocket server
    - websocket next.js app router
    - nextjs real-time data
    - websocket vercel serverless
    - nextjs websocket custom server
    - nextjs ssr websocket
faq:
  - q: "Can I run a WebSocket server inside Next.js?"
    a:
      "Not with the default cross-platform Next.js API. Next.js does not expose
      the underlying HTTP server, so there is nowhere portable to attach a
      `WebSocketServer`. On Vercel, use `experimental_upgradeWebSocket()` in a
      Function route. When self-hosting, use a custom server."
  - q: "Do WebSockets work on Vercel?"
    a:
      "Yes, in public beta. Vercel Functions can serve WebSocket connections
      when Fluid Compute is enabled. In Next.js, use
      `experimental_upgradeWebSocket()` from `@vercel/functions`. Default max
      duration is 5 minutes (Hobby cannot go higher; Pro/Enterprise can set
      800s, or 30 minutes as a per-function beta). Reconnects can land on a
      different instance, so keep shared state outside memory."
  - q: "How do I use WebSockets in Next.js App Router?"
    a:
      "All WebSocket code must be in client components. Add `\"use client\"` at
      the top of the file. Create the WebSocket connection inside `useEffect` to
      avoid SSR issues. If you need the connection to persist across route
      changes, lift it to a React context provider in your root layout."
  - q: "Why does my WebSocket code crash during SSR?"
    a:
      "Next.js pre-renders client components on the server to generate initial
      HTML. During this server render, browser APIs like `WebSocket`, `window`,
      and `localStorage` do not exist. If your code calls `new WebSocket()` at
      the module level or outside of `useEffect`, it throws a `ReferenceError`.
      The fix: only instantiate WebSocket inside `useEffect`, which exclusively
      runs in the browser."
  - q: "Should I use Socket.IO with Next.js?"
    a:
      "Socket.IO gives you reconnection, rooms, namespaces, and HTTP
      long-polling fallback. These are real features that take effort to build
      yourself. With a self-hosted Next.js custom server, Socket.IO is a
      reasonable choice. On Vercel Functions, configure the client to use the
      WebSocket transport directly and keep room or presence state outside the
      function instance."
---

:::note[Quick Answer]
Next.js has no built-in WebSocket server. Your WebSocket client code
must live in client components (`"use client"`), guarded against SSR
with `typeof window`. On Vercel, WebSockets are in public beta on
Functions with Fluid Compute. Next.js needs
`experimental_upgradeWebSocket()`; connections are duration-capped
and instance-pinned. For custom servers or multi-instance fan-out,
use a separate WebSocket server or a managed service.
:::

Next.js is a React framework. WebSockets are a persistent connection
protocol. These two things do not fit together naturally, and the
mismatch catches people. This guide covers what works, what does
not, and when to stop fighting the framework.

## The core problem

Next.js is designed around request-response. A browser requests a
page, Next.js renders it (on the server or at build time), and sends
back HTML. WebSockets need a server runtime that can upgrade the
request and hold the connection open. Next.js itself does not provide
a portable WebSocket server API. Vercel Functions provide a
Vercel-specific upgrade path in public beta.

This means:

- There is no portable `app/api/websocket/route.ts` that gives you a
  WebSocket endpoint across hosts. On Vercel, use
  `experimental_upgradeWebSocket()` in a Function route
- API Routes (both App Router and Pages Router) are HTTP handlers.
  Next.js still has no native upgrade API
- On Vercel, Functions are subject to request duration limits, and
  a reconnect can land on a different instance

## Client components: where WebSocket code lives

In the App Router, all components are server components by default.
Server components render on the server. The browser `WebSocket` API
does not exist on the server.

```tsx
// app/components/live-feed.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function LiveFeed({ url }: { url: string }) {
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    ws.onclose = () => {
      // Reconnect logic goes here
    };

    return () => ws.close();
  }, [url]);

  return (
    <ul>
      {messages.map((msg, i) => (
        <li key={i}>{msg}</li>
      ))}
    </ul>
  );
}
```

The `"use client"` directive is mandatory. Without it, React runs
this code on the server, `WebSocket` is undefined, and the render
fails with a `ReferenceError`.

### The SSR hydration trap

Even with `"use client"`, Next.js still pre-renders client
components on the server for the initial HTML. This creates a
subtle bug:

```tsx
// This crashes during SSR
"use client";

// Bad: runs at module scope during SSR
const ws = new WebSocket("wss://example.com/ws");
```

The fix is straightforward: only create the WebSocket inside
`useEffect`, which only runs in the browser. If you need to check
for browser context outside of `useEffect`:

```tsx
if (typeof window !== "undefined") {
  // Safe to use WebSocket
}
```

This applies to any browser-only API: `WebSocket`, `localStorage`,
`window.addEventListener`. Next.js server rendering will execute
your client component code once on the server. Guard accordingly.

## Custom server approach

When self-hosting Next.js you can create a custom server.
This replaces Next.js's built-in server with your
own Node.js `http` server.

```js
// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      // Handle messages
    });
  });

  server.listen(3000, () => {
    console.log("Ready on http://localhost:3000");
  });
});
```

This works, but you pay for it:

- **No Vercel deployment.** Vercel does not support custom servers.
  You need a VPS, container, or platform like Railway or Fly.io.
- **No automatic static optimization.** Some Next.js optimizations
  assume the default server. A custom server disables them.
- **You own the infrastructure.** Connection limits, memory
  management, health checks, graceful shutdown -- all yours now.

For prototyping or internal tools, this is fine. For production apps
with real traffic, you are building a WebSocket server from scratch
and also running Next.js. At that point, consider whether a separate
WebSocket server or a managed service would be simpler.

## The separate server pattern

The most portable production approach: run Next.js for your UI and a
separate process for WebSocket connections.

```text
Browser
  |
  |--- HTTPS --> Next.js (UI, API Routes, SSR)
  |
  |--- WSS ----> Standalone WebSocket Server (ws, Socket.IO, etc.)
```

Next.js serves your pages and API routes. A separate Node.js
process (or Go, Rust, whatever you prefer) handles WebSocket
connections. They share state through a database, Redis, or message
queue.

### Why this is still useful

- Deploy Next.js to Vercel, Netlify, or any serverless platform
- Scale the WebSocket server independently based on connection
  count
- Restart or redeploy Next.js without dropping active WebSocket
  connections
- Choose the right technology for each job

### The auth handoff pattern

The question is: how does the WebSocket server know who is
connecting? Use your Next.js API route to generate a short-lived
token, then pass it to the WebSocket server.

```ts
// app/api/ws-token/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = jwt.sign(
    { userId: session.user.id, exp: Math.floor(Date.now() / 1000) + 30 },
    process.env.WS_SECRET!,
  );

  return NextResponse.json({ token });
}
```

Client-side, fetch the token, then connect:

```tsx
"use client";

import { useEffect } from "react";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function connect() {
      const res = await fetch("/api/ws-token");
      const { token } = await res.json();
      const ws = new WebSocket(
        `wss://ws.yourapp.com?token=${token}`,
      );
      // ... handle connection
    }
    connect();
  }, []);

  return <>{children}</>;
}
```

The token is short-lived (30 seconds in this example). The
WebSocket server validates it on connection, then relies on the
persistent connection for identity. No cookies, no CORS issues.

## Vercel Functions

Vercel Functions can serve WebSocket connections in
[public beta](https://vercel.com/docs/functions/websockets) when
[Fluid Compute](https://vercel.com/docs/fluid-compute) is enabled.
Fluid is the default for new projects created on or after 23 April
2025. For Next.js route handlers, use
`experimental_upgradeWebSocket()` from `@vercel/functions` because
Next.js does not expose WebSocket upgrade handling itself. Other
runtimes on Vercel can use `ws` or Socket.IO directly.

```ts
// app/api/ws/route.ts
import { experimental_upgradeWebSocket } from "@vercel/functions";

export async function GET() {
  return experimental_upgradeWebSocket((ws) => {
    ws.on("message", (data) => {
      ws.send(data);
    });
  });
}
```

What still matters on Vercel:

- **Custom servers** -- Vercel ignores `server.js`; use a Function
  route instead
- **Function duration** -- connections close when the Function
  reaches its
  [maximum duration](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits).
  Default is 5 minutes on all plans. Hobby cannot exceed 5 minutes.
  Pro and Enterprise can set 800 seconds, or 30 minutes with a
  per-function
  [extended duration beta](https://vercel.com/docs/functions/configuring-functions/duration#extended-max-duration-beta)
- **Instance-local memory** -- one connection is pinned to one
  Function instance, but a reconnect can reach another instance
- **Protocol level** -- Vercel supports WebSockets over HTTP/2, not
  WebSocket over HTTP/3

Store durable rooms, presence, counters, and pub/sub coordination
outside the function process. Use Redis, a database, a queue, or a
managed realtime service when multiple function instances need to
share state.

### When to still use a separate service

Use Vercel Functions for small, Vercel-native WebSocket endpoints
with low coordination needs, and for apps that can reconnect
cleanly when a function reaches its
[maximum duration](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits).

Reach for a separate WebSocket process or a managed realtime
service when you need rooms, presence, fan-out, or replay across
many function instances, or when connections must outlive the
function duration cap.

New WebSocket connections are not guaranteed to reach the same
Vercel Function instance. If a client reconnects, it may connect
to a different instance. After a new deployment, new connections
may reach the new deployment while existing connections remain
on the previous deployment until they close.

Store durable state, presence, counters, rooms, and pub/sub
coordination in an external data store such as Redis.

## Socket.IO with Next.js

Socket.IO adds reconnection, rooms, namespaces, and HTTP fallback
on top of WebSockets. With a self-hosted Next.js app, the usual
integration is a custom server:

```js
// server.js with Socket.IO
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("chat message", (msg) => {
      io.emit("chat message", msg);
    });
  });

  httpServer.listen(3000);
});
```

On Vercel Functions, Socket.IO works if the client uses the
WebSocket transport directly. Long-polling is not a WebSocket
upgrade. Keep room or presence state outside the function
instance -- a reconnect can land on a different instance.

```ts
// server.ts -- Vercel Function (not a Next.js custom server)
import http from "http";
import { Server } from "socket.io";

const server = http.createServer();
const io = new Server(server);

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    socket.send(data);
  });
});

export default server;
```

```ts
import { io } from "socket.io-client";

const socket = io("https://your-domain.com", {
  // Socket.IO appends /socket.io to the path by default,
  // so the full path becomes /api/socket-io/socket.io
  path: "/api/socket-io/socket.io",
  transports: ["websocket"], // required -- Socket.IO defaults to HTTP long-polling
});
```

## Reconnection across route changes

The App Router uses client-side navigation between routes. If your
WebSocket connection lives in a component that unmounts during
navigation, the connection closes and reopens on every page change.

Fix this by lifting the connection to a layout or context provider
that persists across routes:

```tsx
// app/layout.tsx
import { WebSocketProvider } from "./providers/websocket";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/providers/websocket.tsx
"use client";

import { createContext, useContext, useEffect, useRef } from "react";

const WsContext = createContext<WebSocket | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new WebSocket("wss://ws.yourapp.com");
    }
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <WsContext.Provider value={wsRef.current}>
      {children}
    </WsContext.Provider>
  );
}

export const useWebSocket = () => useContext(WsContext);
```

Place the provider in your root layout. The WebSocket connection
survives route changes because the root layout never unmounts.

## When to use a managed service

At some point, you are fighting the framework instead of building
your product. Here are the signs:

- You need rooms, presence, fanout, or replay across many function
  instances
- You are building reconnection logic, heartbeats, and presence
  tracking from scratch
- You need to scale beyond what a single WebSocket server handles
- You are spending more time on infrastructure than features

Managed services like
[Ably](https://ably.com/docs/getting-started/quickstart?utm_source=websocket-org&utm_medium=nextjs),
Pusher, and PubNub handle the WebSocket infrastructure. You get a
client library, the connection management is handled for you, and
your Next.js app stays deployable on Vercel. The trade-off is cost
and vendor dependency, but for most teams, that beats running and
scaling your own WebSocket infrastructure.

The integration is simpler too. Instead of managing connections
directly, you use the service's SDK:

```tsx
"use client";

import { useEffect, useState } from "react";
import Ably from "ably";

export function LiveUpdates({ channelName }: { channelName: string }) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const client = new Ably.Realtime({ authUrl: "/api/ably-token" });
    const channel = client.channels.get(channelName);

    channel.subscribe((msg) => {
      setMessages((prev) => [...prev, msg.data]);
    });

    return () => {
      channel.unsubscribe();
      client.close();
    };
  }, [channelName]);

  return (
    <ul>
      {messages.map((msg, i) => (
        <li key={i}>{msg}</li>
      ))}
    </ul>
  );
}
```

No custom server. No connection management. Deploys on Vercel
without changes.

## Pages Router differences

If you are using the Pages Router instead of the App Router, the
principles are the same but the syntax differs:

- Use `useEffect` in page components (all Pages Router components
  are client-side by default)
- API Routes live in `pages/api/` and work the same way for token
  generation
- No `"use client"` directive needed -- but `getServerSideProps`
  still runs on the server, so no WebSocket code there
- The `_app.tsx` wrapper is where you would place a connection
  provider for persistence across page changes

The Pages Router is more forgiving because it does not have the
server component / client component split. For server-side WebSocket
endpoints on Vercel, still use Vercel Functions rather than trying
to attach `ws` to a Pages API response object.

## Frequently Asked Questions

### Can I run a WebSocket server inside Next.js?

Not with the default cross-platform Next.js API. Next.js does not
expose the underlying HTTP server, so there is nowhere portable to
attach a `WebSocketServer`. On Vercel, use
`experimental_upgradeWebSocket()` in a Function route. When
self-hosting, use a custom server.

### Do WebSockets work on Vercel?

Yes, in public beta. Vercel Functions can serve WebSocket
connections when Fluid Compute is enabled. In Next.js, use
`experimental_upgradeWebSocket()` from `@vercel/functions`. Default
max duration is 5 minutes (Hobby cannot go higher; Pro/Enterprise
can set 800s, or 30 minutes as a per-function beta). Reconnects can
land on a different instance, so keep shared state outside memory.

### How do I use WebSockets in Next.js App Router?

All WebSocket code must be in client components. Add `"use client"`
at the top of the file. Create the WebSocket connection inside
`useEffect` to avoid SSR issues. If you need the connection to
persist across route changes, lift it to a React context provider in
your root layout.

### Why does my WebSocket code crash during SSR?

Next.js pre-renders client components on the server to generate
initial HTML. During this server render, browser APIs like
`WebSocket`, `window`, and `localStorage` do not exist. If your
code calls `new WebSocket()` at the module level or outside of
`useEffect`, it throws a `ReferenceError`. The fix: only
instantiate WebSocket inside `useEffect`, which exclusively runs
in the browser.

### Should I use Socket.IO with Next.js?

Socket.IO gives you reconnection, rooms, namespaces, and HTTP
long-polling fallback. These are real features that take effort to
build yourself. With a self-hosted Next.js custom server, Socket.IO
is a reasonable choice. On Vercel Functions, configure the client to
use the WebSocket transport directly and keep room or presence state
outside the function instance.

## Related Content

- [Building a WebSocket App](/guides/building-a-websocket-app/) --
  step-by-step from connection to production
- [WebSocket Reconnection](/guides/reconnection/) -- exponential
  backoff, jitter, and state recovery
- [JavaScript & Node.js WebSockets](/guides/languages/javascript/)
  -- the `ws` library and browser API in depth
- [WebSocket Authentication](/guides/authentication/) -- token
  patterns, JWT, and the auth handoff
- [Socket.IO vs WebSocket](/comparisons/socket-io/) -- when the
  abstraction layer is worth it
