---
title: "Debugging WebSocket Connections in Chrome DevTools"
description:
  "Find and inspect WebSocket frames in Chrome DevTools. Read sent and received
  messages, diagnose connection failures, and debug common WebSocket issues."
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-19
lastUpdated: 2026-03-19
category: guide
keywords:
  - websocket debugging
  - chrome devtools websocket
  - websocket network tab
  - websocket frames
  - debug websocket connection
  - websocket messages tab
  - websocket troubleshooting
seo:
  keywords:
    - debug websocket chrome
    - chrome devtools websocket messages
    - websocket not connecting
    - websocket disconnecting
    - inspect websocket frames
faq:
  - q: "Where do I find WebSocket connections in Chrome DevTools?"
    a:
      "Open DevTools (F12), go to the Network tab, and click the WS filter
      button. This shows only WebSocket connections. Click a connection to see
      the Headers tab (handshake details) and Messages tab (individual frames
      with timestamps, direction, and payload)."
  - q: "Why does my WebSocket connection show a 101 status code?"
    a:
      "101 Switching Protocols is the correct, successful response for a
      WebSocket handshake. It means the server accepted the upgrade request
      and the connection is now open. If you see 101, the handshake worked.
      Problems with messages or disconnects happen after this point."
  - q: "How do I debug a WebSocket that won't connect?"
    a:
      "Check the Network tab for the failed upgrade request. A 403 usually
      means authentication failed. A 400 means a bad request, often from a
      missing or incorrect Sec-WebSocket-Key header. No request at all means
      a CSP or mixed-content block. Check the Console tab for errors."
  - q: "Can I send test messages to a WebSocket from Chrome DevTools?"
    a:
      "Not directly from DevTools UI, but you can use the Console tab. Store
      a reference to your WebSocket object, then call ws.send('test') from
      the console. For new connections, create one with
      new WebSocket('wss://your-url') and interact with it programmatically."
  - q: "Why do my WebSocket messages show as binary instead of text?"
    a:
      "Chrome displays binary frames as 'Binary Frame' with the byte length.
      This happens when the server sends data as ArrayBuffer or Blob instead
      of text. If you expect JSON but see binary, check your server's frame
      type. Most WebSocket libraries let you configure whether to send text
      or binary frames."
---

:::note[Quick Answer]
Open Chrome DevTools (F12), go to the Network tab, click the **WS**
filter. Click any WebSocket connection, then switch to the **Messages**
tab. Green arrows are sent frames, red arrows are received. Each frame
shows its timestamp, payload, and size.
:::

Most developers discover WebSocket debugging by accident. They open
the Network tab expecting to see their messages as individual HTTP
requests, find nothing, and assume the connection isn't working. The
frames are there -- they're just hidden behind a UI that Chrome doesn't
make obvious.

## Finding WebSocket connections in the Network tab

Open DevTools with F12 (or Cmd+Option+I on Mac). Go to the Network
tab. By default, it shows every HTTP request, fetch call, and asset
load. Your WebSocket connection is buried in that list as a single
entry with status code `101 Switching Protocols`.

The fastest way to find it: click the **WS** filter button in the
toolbar. This hides everything except WebSocket connections. If you
don't see a WS filter, your Chrome version groups it under the
filter dropdown -- look for it there.

Once filtered, you'll see one entry per WebSocket connection. Click
it. You get three useful tabs:

- **Headers** -- the HTTP upgrade request and response, including
  `Sec-WebSocket-Key`, `Sec-WebSocket-Accept`, any subprotocols,
  and cookies sent during the handshake
- **Messages** -- every frame sent and received over this connection
- **Timing** -- when the connection was established

The Messages tab is where the real debugging happens.

## Reading frames in the Messages tab

Each row in the Messages tab represents a single WebSocket frame.
The columns tell you:

- **Direction** -- green upward arrow = sent by the client, red
  downward arrow = received from the server
- **Data** -- the frame payload (text frames show their content,
  binary frames show byte length)
- **Length** -- payload size in bytes
- **Time** -- timestamp relative to the connection opening

Text frames display their content inline. If you're sending JSON,
you'll see the raw JSON string. Click a frame to expand it and get
a formatted view -- Chrome will pretty-print JSON automatically.

Binary frames show as `Binary Frame (N bytes)`. You can click to
see the hex dump, but for practical debugging, if you're seeing
binary when you expect text, the problem is usually on the server
side -- check whether your server library is sending text or binary
frame opcodes.

### What the frame types mean

WebSocket has distinct opcodes for different frame types. In
Chrome's Messages tab, you'll see:

- **Text frames** -- your application data as UTF-8 strings
- **Binary frames** -- application data as raw bytes
- **Ping/Pong frames** -- keepalive heartbeats (Chrome hides these
  by default; some connections use them to detect dead connections)
- **Close frames** -- connection termination with a close code

Close frames are particularly useful for debugging disconnects. A
clean close shows the close code (1000 for normal, 1001 for going
away, 1006 for abnormal). See the
[close codes reference](/reference/close-codes/) for the full list.

## Three scenarios you'll actually debug

### "Why isn't my connection opening?"

Check the Network tab without the WS filter. Look for the upgrade
request. If it exists:

- **403 Forbidden** -- your auth token is invalid or missing. Check
  the request headers for cookies or token parameters
- **400 Bad Request** -- malformed upgrade request, often caused by
  a proxy stripping WebSocket headers
- **502/504** -- your load balancer or reverse proxy doesn't support
  WebSocket upgrades. Nginx needs `proxy_set_header Upgrade` and
  `proxy_set_header Connection "upgrade"` explicitly

If no request appears at all:

```javascript
// Check the Console tab for these common blockers:
// "Mixed Content: wss:// on https:// page" -- use wss://, not ws://
// "Refused to connect -- CSP" -- add ws: or wss: to connect-src
// "WebSocket connection to 'wss://...' failed"
//   -- DNS resolution failed, server unreachable, or port blocked
```

The Console tab often has the answer before the Network tab does.
A Content Security Policy blocking `connect-src` will prevent the
request from ever being made.

### "Why am I getting disconnected?"

Filter to WS in the Network tab. Look at the last frame in the
Messages tab. Three patterns:

**Clean close (close frame present).** The server or client sent a
close frame with a code. Code 1000 means intentional. Code 1001
means the server is shutting down. Code 1008 means a policy
violation -- usually a message that failed server-side validation.

**Abrupt disconnect (no close frame).** The connection entry shows
`(failed)` or just stops. This means the TCP connection dropped
without a WebSocket close handshake. Causes: network interruption,
server crash, load balancer timeout, or an idle connection timeout
on a proxy. If it happens consistently after the same duration,
check your infrastructure's idle timeout settings.

**Rapid reconnect loop.** You see connections opening and closing
immediately. This usually means the server is rejecting after
handshake -- check the first received frame for an error message.
Or it means your client-side reconnection code has no backoff and
is hammering the server.

### "Why aren't my messages arriving?"

Open the Messages tab and verify the frame was actually sent.
If you see the green arrow but no response:

- The server received it but didn't respond -- add server-side
  logging
- The server responded to a different connection -- you have
  multiple WebSocket instances open (common React bug, see
  [best practices](/guides/best-practices/))
- The message format is wrong -- check if the server expects a
  specific JSON schema and silently drops malformed messages

If you don't see the green arrow, your client code isn't calling
`send()` or is calling it before the connection is open:

```javascript
// This fails silently -- ws isn't open yet
const ws = new WebSocket("wss://example.com/ws");
ws.send("hello"); // readyState is CONNECTING, not OPEN

// Do this instead
ws.addEventListener("open", () => {
  ws.send("hello");
});
```

## Console API for programmatic debugging

The Messages tab works for interactive debugging, but for
production issues that are hard to reproduce, add event listeners
directly. Paste this into the Console tab to intercept all frames
on an existing connection:

```javascript
// Monkey-patch WebSocket to log all frame activity
const OrigWS = WebSocket;
window.WebSocket = function (...args) {
  const ws = new OrigWS(...args);
  ws.addEventListener("open", () =>
    console.log("[WS] opened:", args[0])
  );
  ws.addEventListener("message", (e) =>
    console.log("[WS] received:", e.data)
  );
  ws.addEventListener("close", (e) =>
    console.log("[WS] closed:", e.code, e.reason)
  );
  ws.addEventListener("error", () =>
    console.log("[WS] error")
  );
  return ws;
};
```

This patches `WebSocket` globally, so any new connections created
after this point will log to the console. Useful for catching
connection leaks -- if you see multiple `[WS] opened` logs when
you expect one, your code is creating duplicate connections.

For existing connections, if you have a reference to the WebSocket
object (check your framework's state or window globals), you can
attach listeners directly:

```javascript
// If your app exposes the socket (e.g., window.socket)
window.socket.addEventListener("close", (e) => {
  console.log("Close code:", e.code, "Reason:", e.reason);
  console.log("Was clean:", e.wasClean);
});
```

## Firefox DevTools differences

Firefox's Network tab shows WebSocket connections the same way --
filter by WS, click a connection, view messages. The main
differences:

- Firefox shows ping/pong frames by default (Chrome hides them)
- Firefox labels frames as "Sent" and "Received" with text instead
  of colored arrows
- Firefox's message inspector has a built-in JSON tree view that
  handles nested structures better than Chrome's formatter
- Both browsers show binary frames, but Firefox gives a slightly
  better hex viewer

For basic debugging, either browser works. If you're specifically
debugging keepalive issues or ping/pong timing, Firefox is more
useful because it doesn't hide those frames.

## When DevTools isn't enough: Wireshark

Browser DevTools show you WebSocket frames after TLS decryption
and protocol parsing. Sometimes you need to go deeper -- seeing
the raw TCP segments, TLS handshake, or HTTP upgrade at the wire
level.

Wireshark can capture WebSocket traffic with the `websocket`
display filter. For encrypted connections (wss://), you'll need to
configure your browser to export TLS session keys via the
`SSLKEYLOGFILE` environment variable. This is advanced territory,
but it's the only way to debug issues where the problem is below
the WebSocket layer -- TLS certificate problems, TCP window
sizing, or proxy interference that Chrome's Network tab can't
surface.

For most debugging scenarios, Chrome DevTools is enough. Reach for
Wireshark when you've exhausted what the browser can tell you and
suspect the issue is at the transport or TLS layer. If you're
running WebSocket connections at scale,
managed services like [Ably][ably-debugging], Pusher, or PubNub
provide built-in connection state inspection and message tracing
that replaces much of this manual debugging.

[ably-debugging]:
  https://ably.com/docs/connect?utm_source=websocket-org&utm_medium=debugging-chrome

## Frequently Asked Questions

### Where do I find WebSocket connections in Chrome DevTools?

Open DevTools (F12 or Cmd+Option+I), navigate to the Network tab,
and click the **WS** filter in the toolbar. This filters out
everything except WebSocket connections. Each connection appears as
a single row with status `101 Switching Protocols`. Click it to
see the handshake headers and all frames exchanged. If your page
has already established the connection before you opened DevTools,
you might need to reload -- DevTools only captures connections made
while it's open, unless you've enabled "Preserve log."

### Why does my WebSocket show a 101 status code?

HTTP 101 means the server accepted the upgrade from HTTP to
WebSocket. This is the expected, successful response. The full
flow: your client sends an HTTP GET with `Upgrade: websocket` and
`Connection: Upgrade` headers, and the server replies with 101 to
confirm the switch. After this exchange, both sides communicate
using WebSocket frames, not HTTP. If you see 101, your connection
is working at the handshake level. Look at the Messages tab for
frame-level issues.

### How do I debug a WebSocket that won't connect?

Start with the Console tab -- connection failures often produce
error messages there before the Network tab shows anything. Check
for mixed content warnings (`ws://` on an `https://` page), CSP
violations (`connect-src` missing `wss:`), and DNS failures.
Then check the Network tab for the upgrade request's HTTP status.
A 403 points to auth. A 502 points to your reverse proxy.
No request at all usually means a client-side block.

### Can I send test messages from Chrome DevTools?

Yes, through the Console tab. If your application stores the
WebSocket reference on a global (like `window.socket`), call
`window.socket.send('your message')` directly. If not, create a
test connection: `const ws = new WebSocket('wss://your-url')`.
Once `ws.readyState === 1` (OPEN), call `ws.send()`. You can
also use the [WebSocket echo server](/tools/websocket-echo-server/)
at `wss://echo.websocket.org` to test basic connectivity without
needing your own server.

### Why do my messages show as binary instead of text?

WebSocket frames have an opcode that marks them as text (0x1) or
binary (0x2). Chrome reads this opcode and displays accordingly.
If your server sends data as an `ArrayBuffer`, `Buffer`, or
`Blob`, the frame uses the binary opcode regardless of whether the
content is human-readable. Fix this on the server side -- most
libraries have an option to send text frames explicitly. In
Node.js with `ws`, for example, `ws.send(data)` sends text if
`data` is a string and binary if it's a `Buffer`.

## Related Content

- [WebSocket Close Codes](/reference/close-codes/) -- understand
  what each close code means when debugging disconnects
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) --
  how frames, opcodes, and the handshake work at the wire level
- [Best Practices](/guides/best-practices/) -- avoid common
  mistakes like connection leaks that make debugging harder
- [WebSocket API Reference](/reference/websocket-api/) -- the
  browser API for WebSocket, including events and readyState
- [Building a WebSocket App](/guides/building-a-websocket-app/) --
  implement a working connection with proper error handling
