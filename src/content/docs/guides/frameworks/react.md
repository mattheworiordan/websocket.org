---
title: "WebSockets in React: Hooks, Lifecycle, and Pitfalls"
description:
  "Use WebSockets in React without leaking connections or
  re-rendering on every message. Covers custom hooks, StrictMode,
  context providers, and reconnection."
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
date: 2026-03-23
lastUpdated: 2026-03-23
category: guide
keywords:
  - react websocket
  - usewebsocket react
  - websocket react hook
  - react real-time
  - react websocket context
seo:
  keywords:
    - react websocket
    - usewebsocket react hook
    - websocket react tutorial
    - react real-time data
    - react websocket context provider
    - react 18 strictmode websocket
    - websocket custom hook react
faq:
  - q: "Why does my WebSocket connect twice in React?"
    a:
      "React 18 StrictMode mounts, unmounts, and remounts components in
      development. Each mount creates a new WebSocket. Your useEffect
      cleanup must close the connection on unmount, and your code must
      handle the remount gracefully."
  - q: "Should I use useState or useRef for a WebSocket in React?"
    a:
      "Use useRef. A WebSocket instance is not render state — you never
      want a re-render when the socket object changes. useState would
      trigger a re-render on every reconnect. useRef holds the instance
      without affecting the render cycle."
  - q: "How do I avoid re-renders on every WebSocket message in React?"
    a:
      "Store incoming messages in a ref instead of state. Use
      requestAnimationFrame or a throttled setState to batch updates.
      For high-frequency data like stock tickers, update the DOM
      directly via refs and skip React's reconciliation entirely."
  - q: "When should I use react-use-websocket vs a custom hook?"
    a:
      "react-use-websocket works for prototypes and simple use cases.
      Build your own hook when you need custom reconnection logic,
      message queuing, authentication token refresh on reconnect, or
      fine-grained control over which components re-render."
  - q: "Should I put my WebSocket in React Context?"
    a:
      "Yes, for most apps. A context provider at the app root creates
      one connection shared across components. This avoids prop
      drilling and ensures the connection lifecycle is independent
      from any single component's lifecycle."
tags:
  - websocket
  - react
  - javascript
  - hooks
  - real-time
  - guide
  - how-to
  - framework
---

:::note[Quick Answer]
Use `useRef` to hold the WebSocket instance, `useEffect` to open and
close it, and a context provider to share it across components.
Never create a WebSocket inside a component body or with `useState`.
React 18 StrictMode will double-mount your component in dev --- your
cleanup function must close the connection or you will leak sockets.
:::

The number one mistake React developers make with WebSockets:
creating the connection inside a component that mounts and unmounts.
The component re-renders, the effect re-runs, and suddenly you have
three open connections to the same server. In StrictMode, this
happens on the first render.

This guide covers the patterns that work in production.

## The Wrong Way: WebSocket in useState

This is what most tutorials show, and it breaks immediately:

```javascript
// DON'T DO THIS
function Chat() {
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("wss://example.com/ws");
    setWs(socket); // triggers a re-render
    return () => socket.close();
  }, []);

  return <div>...</div>;
}
```

Problems: `setWs` triggers a re-render. In StrictMode, the effect
runs twice (mount, unmount, remount), so you get two connections
briefly and one closed socket. If any child component depends on
`ws` from state, it re-renders when the socket reconnects.

## The Right Way: useRef for the Socket Instance

A WebSocket connection is not render state. You never want the UI
to re-render because the socket object changed. Use a ref:

```javascript
function Chat() {
  const wsRef = useRef(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = new WebSocket("wss://example.com/ws");
    wsRef.current = socket;

    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, JSON.parse(event.data)]);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      socket.close(1000, "component unmounted");
    };
  }, []);

  const send = useCallback((data) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return <div>...</div>;
}
```

The ref holds the socket without triggering renders. The cleanup
function closes it on unmount. `send` uses `useCallback` so child
components that receive it do not re-render unnecessarily.

## React 18 StrictMode: Why You Connect Twice

React 18 StrictMode deliberately double-invokes effects in
development to help you find missing cleanup. Your component mounts,
the effect runs and opens a WebSocket. React unmounts the component,
the cleanup runs and closes the socket. React remounts the component,
the effect runs again and opens a new socket.

This is working as intended. If your cleanup properly closes the
connection, the double-mount is harmless --- you briefly open and
close one extra connection in dev mode only. In production,
StrictMode does not double-mount.

If you see two connections in production, the problem is not
StrictMode. Check for:

- Missing dependency array (effect runs on every render)
- Parent component remounting the child unnecessarily
- A key prop change that forces a fresh mount

## Custom Hook: useWebSocket

Encapsulate connection, reconnection, and cleanup in a reusable
hook. This is the pattern that scales across a real application:

```javascript
function useWebSocket(url, options = {}) {
  const { onMessage, onOpen, onClose, reconnect = true } = options;
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      onOpen?.();
    };

    socket.onmessage = (event) => {
      onMessage?.(JSON.parse(event.data));
    };

    socket.onclose = (event) => {
      onClose?.(event);
      if (reconnect && event.code !== 1000) {
        scheduleReconnect();
      }
    };

    socket.onerror = () => socket.close();
  }, [url, onMessage, onOpen, onClose, reconnect]);
```

The reconnection logic uses exponential backoff with jitter:

```javascript
  const scheduleReconnect = useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt >= 10) return; // stop after 10 attempts

    const baseDelay = Math.min(1000 * 2 ** attempt, 30000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    reconnectTimer.current = setTimeout(() => {
      attemptRef.current += 1;
      connect();
    }, delay);
  }, [connect]);
```

And the effect that ties it together:

```javascript
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, "hook cleanup");
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send, wsRef };
}
```

Usage is clean:

```javascript
function Chat() {
  const [messages, setMessages] = useState([]);

  const { send } = useWebSocket("wss://example.com/ws", {
    onMessage: (data) => setMessages((prev) => [...prev, data]),
  });

  return <div>...</div>;
}
```

### Stale Closures: The Silent Bug

The `onMessage` callback captures `setMessages` from the initial
render. This works because `setMessages` is stable --- React
guarantees that state setters do not change between renders. But if
your callback references other state or props, you will read stale
values.

The fix: use a ref to hold the latest callback:

```javascript
const onMessageRef = useRef(onMessage);
useEffect(() => {
  onMessageRef.current = onMessage;
}, [onMessage]);

// Inside connect():
socket.onmessage = (event) => {
  onMessageRef.current?.(JSON.parse(event.data));
};
```

This ensures the socket always calls the latest version of your
handler without re-creating the connection when the callback changes.

## Context Provider: One Connection, Many Components

For any app with more than two components that need WebSocket data,
use a context provider. This separates the connection lifecycle from
the component lifecycle:

```javascript
const WebSocketContext = createContext(null);

function WebSocketProvider({ url, children }) {
  const [status, setStatus] = useState("connecting");
  const ws = useWebSocket(url, {
    onOpen: () => setStatus("connected"),
    onClose: () => setStatus("disconnected"),
  });

  return (
    <WebSocketContext.Provider value={{ ...ws, status }}>
      {children}
    </WebSocketContext.Provider>
  );
}

function useSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useSocket outside WebSocketProvider");
  return ctx;
}
```

Mount the provider at the app root:

```javascript
function App() {
  return (
    <WebSocketProvider url="wss://example.com/ws">
      <Dashboard />
      <Chat />
      <Notifications />
    </WebSocketProvider>
  );
}
```

Now `Dashboard`, `Chat`, and `Notifications` share one connection.
The connection stays alive even if individual components unmount and
remount. This is how connection lifecycle should work --- tied to
the app, not to a page or tab.

### When NOT to Use Context

Context triggers re-renders in every consumer when the value changes.
If your context value updates on every message (because you store
messages in state on the provider), every consumer re-renders on
every message. Two ways to handle this:

1. **Split contexts**: one for the `send` function (stable), one for
   incoming data (changes frequently). Components that only send
   do not re-render.
2. **External store**: use `useSyncExternalStore` to subscribe
   components to a message store outside React. This gives you
   per-component subscriptions without context re-render overhead.

## Performance: High-Frequency Messages

If your WebSocket delivers 50+ messages per second (stock prices,
game state, sensor data), calling `setState` on every message will
kill your frame rate. React batches state updates in event handlers,
but WebSocket `onmessage` runs outside React's batching in older
versions.

### Option 1: Throttle State Updates

Buffer messages in a ref and flush to state on a schedule:

```javascript
const bufferRef = useRef([]);
const [display, setDisplay] = useState([]);

socket.onmessage = (event) => {
  bufferRef.current.push(JSON.parse(event.data));
};

useEffect(() => {
  const id = setInterval(() => {
    if (bufferRef.current.length > 0) {
      setDisplay((prev) => [...prev, ...bufferRef.current]);
      bufferRef.current = [];
    }
  }, 100); // flush 10x per second
  return () => clearInterval(id);
}, []);
```

### Option 2: Skip React Entirely for Hot Data

For a real-time price ticker, you do not need React's
reconciliation. Write directly to the DOM:

```javascript
function PriceTicker({ symbol }) {
  const priceRef = useRef(null);

  useEffect(() => {
    const { wsRef } = getSharedSocket();
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.symbol === symbol && priceRef.current) {
        priceRef.current.textContent = data.price.toFixed(2);
      }
    };
    wsRef.current?.addEventListener("message", handler);
    return () => {
      wsRef.current?.removeEventListener("message", handler);
    };
  }, [symbol]);

  return <span ref={priceRef}>--</span>;
}
```

Zero re-renders. The DOM updates at the speed of incoming messages.
Use this for leaf components showing a single rapidly-changing value.
Do not use it for complex UI --- that is where React's diffing
earns its keep.

## Libraries: react-use-websocket

[react-use-websocket](https://github.com/robtaussig/react-use-websocket)
is the most popular React WebSocket library (~3k GitHub stars). It
wraps the WebSocket API in a hook with reconnection, message
history, and shared connections.

```javascript
import useWebSocket from "react-use-websocket";

function Feed() {
  const { lastJsonMessage, sendJsonMessage } = useWebSocket(
    "wss://example.com/ws",
    { shouldReconnect: () => true }
  );

  return <div>{lastJsonMessage?.text}</div>;
}
```

It works for prototypes and apps where you do not need to control
the connection details. The trade-offs:

- **Re-renders on every message** by default. `lastJsonMessage`
  updates state on each incoming message. For high-frequency
  streams, this is a performance cliff.
- **Limited reconnection control.** You get `shouldReconnect` and
  `reconnectAttempts`, but not custom backoff, token refresh on
  reconnect, or queue-and-replay of messages sent while
  disconnected.
- **Shared connections are global.** The `share: true` option uses
  a module-level singleton, which does not play well with tests
  or multiple environments.

**My recommendation:** Use `react-use-websocket` for internal tools
and prototypes. Build a custom hook for production apps where you
need auth token rotation, message queuing, or selective re-renders.
The custom hook in this guide is ~40 lines --- it is not much code
to own.

## Connection Lifecycle vs Component Lifecycle

The hardest mental model shift for React developers: your WebSocket
connection should outlive any single component. Components mount and
unmount as users navigate. The WebSocket should stay connected.

```text
Component A       Component B       Component C
  mount              mount             mount
  unmount            unmount           unmount

WebSocket ─────────────────────────────────────────
  connected ────────────────────────── connected
```

If you tie the connection to a component, navigating away closes
the socket. When the user navigates back, the component remounts,
opens a new connection, and misses any messages sent in between.

The fix is the context provider pattern above. The provider lives
at the app root and stays mounted. Components subscribe to messages
through context or an external store.

For apps with authentication, the connection lifecycle ties to the
auth session, not the route. Open the socket when the user logs in.
Close it when they log out. Refresh the auth token on reconnect.

## When NOT to Use WebSockets in React

If your data updates every 30 seconds or less frequently, skip
WebSockets entirely. Use SWR, React Query, or a simple `setInterval`
with `fetch`. Polling is simpler to implement, easier to debug, and
works through every proxy and firewall without configuration. WebSocket
connections consume server resources even when idle. A dashboard that
refreshes once a minute does not justify a persistent connection per
user.

## Reconnection in React

Reconnection logic lives in the hook, not in the component. The
key requirements:

1. **Exponential backoff with jitter.** Fixed intervals cause a
   thundering herd when the server restarts. Start at 1s, double
   each attempt, cap at 30s, add random jitter.
2. **Stable ref across reconnects.** When the socket reconnects,
   update `wsRef.current` to the new socket. Components using
   `send` through the ref automatically use the new connection.
3. **Max retry limit.** Stop reconnecting after 10-15 attempts.
   Show the user a "connection lost" state instead of silently
   burning battery.
4. **Token refresh.** If your WebSocket URL includes an auth token,
   fetch a fresh token before each reconnect attempt. Expired
   tokens mean the reconnect will fail with a 401 and waste an
   attempt.

See the [reconnection guide](/guides/reconnection/) for the full
backoff algorithm and server-side considerations.

## Frequently Asked Questions

### Why does my WebSocket connect twice in React?

React 18 StrictMode double-mounts components in development to
expose missing cleanup. Your `useEffect` runs, opens a socket, then
React unmounts the component (calling the cleanup, which should
close the socket), and remounts it (opening a new socket). This
only happens in dev mode. If you see double connections in
production, check for missing dependency arrays, parent components
that remount children, or key prop changes. The fix is always the
same: make sure your cleanup function closes the socket.

### Should I use useState or useRef for a WebSocket?

Use `useRef`. A WebSocket instance is a mutable object that should
not participate in React's render cycle. Putting it in `useState`
means every reconnect triggers a re-render of the component and
all its children. `useRef` holds the socket silently. The only
state you should store in `useState` is data derived from messages
--- the messages themselves, connection status, or error state
that the UI needs to display.

### How do I avoid re-renders on every WebSocket message?

Three approaches depending on message frequency. Under 1 message
per second: just use `useState`, React handles it fine. Between
1-50 messages per second: buffer messages in a ref and flush to
state every 100ms with `setInterval`. Over 50 messages per second:
bypass React entirely and write to the DOM via refs. The
`PriceTicker` example above shows this pattern. You can also use
`useSyncExternalStore` with a custom store that only notifies
subscribers whose data actually changed.

### When should I use react-use-websocket vs a custom hook?

Use `react-use-websocket` when you want something working in 5
minutes and performance is not a concern --- internal dashboards,
admin tools, prototypes. Build your own hook when you need custom
reconnection with token refresh, message queuing for offline
periods, selective re-renders, or when you are sending more than
a few messages per second. The custom hook in this guide is
straightforward to extend because you own the code.

### Should I put my WebSocket in React Context?

Yes, for almost every app. A context provider at the app root
keeps the connection alive across route changes and gives every
component access without prop drilling. The exception: if you
have dozens of components consuming the context and the context
value updates frequently, use split contexts or
`useSyncExternalStore` to avoid cascading re-renders. For most
apps, a single context with a stable `send` function and a
separate message subscription mechanism works well.

## Related Content

- [WebSocket Reconnection: State Sync and Recovery](/guides/reconnection/)
  --- full backoff algorithm, session resumption, state sync
- [JavaScript WebSocket: Browser API & Node.js](/guides/languages/javascript/)
  --- the underlying API this guide builds on
- [Building a WebSocket Application](/guides/building-a-websocket-app/)
  --- end-to-end architecture for real-time apps
- [WebSocket Best Practices](/guides/best-practices/) --- security,
  error handling, and production deployment patterns
- [WebSocket at Scale](/guides/websockets-at-scale/) --- what
  changes when you go from 100 to 100,000 connections

If you need managed WebSocket infrastructure with built-in
reconnection and state recovery, services like
[Ably](https://ably.com/websockets?utm_source=websocket-org&utm_medium=react),
[Pusher](https://pusher.com/websockets), and
[PubNub](https://www.pubnub.com/) provide React SDKs that handle
connection management so you can focus on application logic.
