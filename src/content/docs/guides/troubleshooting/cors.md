---
title: "WebSocket CORS Errors: Why They Don't Work Like HTTP"
description:
  "WebSocket doesn't use CORS. Learn what actually causes cross-origin
  WebSocket errors: mixed content, origin validation, proxy headers,
  and framework config."
author: Matthew O'Riordan
authorRole: "Co-founder & CEO, Ably"
date: 2026-03-14
lastUpdated: 2026-03-14
category: guide
keywords:
  - websocket cors
  - websocket cross origin
  - websocket mixed content
  - websocket origin header
  - websocket access-control-allow-origin
  - websocket reverse proxy cors
  - websocket cors error
seo:
  keywords:
    - websocket cors error
    - websocket cross origin blocked
    - websocket access-control-allow-origin
    - websocket cors policy
    - django channels cors
    - spring boot websocket cors
faq:
  - q: "Do WebSockets use CORS?"
    a:
      "No. WebSocket connections bypass the browser's CORS mechanism
      entirely. There is no preflight OPTIONS request and no
      Access-Control-Allow-Origin header exchange. The browser sends an
      Origin header during the HTTP upgrade handshake, but it does not
      enforce any CORS policy on the response. Origin validation is the
      server's responsibility."
  - q: "Why do I get a CORS error with WebSocket?"
    a:
      "You almost certainly don't. The error is likely mixed content
      blocking (connecting to ws:// from an https:// page), a reverse
      proxy stripping the Upgrade header, or a framework's HTTP CORS
      middleware rejecting the handshake request before it reaches the
      WebSocket handler. Check your browser console for the exact error
      message."
  - q: "How do I fix WebSocket cross-origin issues in Nginx?"
    a:
      "Ensure your Nginx proxy passes the Upgrade and Connection headers
      to the backend. Add 'proxy_set_header Upgrade $http_upgrade' and
      'proxy_set_header Connection upgrade' to your location block. Also
      pass the Origin and Host headers so the backend can validate them."
  - q: "Should I validate the Origin header on my WebSocket server?"
    a:
      "Yes, always. Without origin validation, any website can open a
      WebSocket connection to your server using your users' cookies. This
      is Cross-Site WebSocket Hijacking (CSWSH), and it's a real
      vulnerability. Check the Origin header during the handshake and
      reject connections from untrusted origins."
  - q: "Why does my WebSocket work on localhost but fail in production?"
    a:
      "Three common causes: your production site uses HTTPS but you're
      connecting to ws:// instead of wss://, your reverse proxy or load
      balancer is not forwarding WebSocket upgrade headers, or your
      framework's CORS middleware is blocking the HTTP handshake request
      before it reaches the WebSocket handler."
---

:::note[Quick Answer]
WebSocket does not use CORS. There is no preflight request, no
`Access-Control-Allow-Origin` header, and no browser-enforced
cross-origin policy. When you search "websocket cors error," the
actual problem is almost always mixed content blocking, a reverse
proxy stripping headers, or framework middleware interfering with
the upgrade handshake.
:::

If you're searching for "websocket cors," you're probably staring
at a browser error that looks like a CORS rejection. It isn't. The
browser's CORS mechanism — preflight `OPTIONS` requests,
`Access-Control-Allow-Origin` headers, credential checks — applies
to `fetch()` and `XMLHttpRequest`. WebSocket sidesteps all of it.

Understanding why saves hours of debugging the wrong thing.

## How WebSocket handshakes actually work

A WebSocket connection starts as an HTTP `GET` with an `Upgrade`
header. The browser includes an `Origin` header in this request,
just like any other HTTP request. But here's the critical
difference: the browser does not send a preflight `OPTIONS`
request, and it does not check the response for CORS headers.

```text
GET /chat HTTP/1.1
Host: api.example.com
Upgrade: websocket
Connection: Upgrade
Origin: https://app.example.com
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

The server sees the `Origin` header and can choose to reject the
connection — but if it responds with `101 Switching Protocols`,
the browser accepts it regardless of what domain the page is on.
No `Access-Control-Allow-Origin` needed. No preflight. The
connection is open.

This is by design. RFC 6455 delegates origin checking to the
server. The browser sends the `Origin` header so the server has
the information to make a decision, but enforcement is entirely
server-side.

## What's actually breaking: the four real problems

### Mixed content blocking

This is the most common "cors error" for WebSockets. If your page
is served over `https://`, the browser blocks connections to
`ws://` (unencrypted WebSocket). The error message varies by
browser but often mentions "insecure content" or "mixed content."

The fix is straightforward: use `wss://` instead of `ws://`.
Always. There's no good reason to use unencrypted WebSocket in
production. If your development setup uses `ws://localhost`, switch
to a conditional that uses `wss://` in production:

```javascript
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${location.host}/ws`);
```

### Reverse proxy stripping upgrade headers

This is the second most common cause. Your WebSocket handshake
goes through Nginx, Apache, a CDN, or a cloud load balancer. The
proxy handles it as a normal HTTP request and either strips the
`Upgrade` header or responds with a `400`/`403` before the request
reaches your WebSocket server.

The symptoms: connections work when hitting the backend directly
but fail through the proxy. The error might look like a CORS
rejection because the proxy returns an HTTP error response without
the headers your client expects.

Here's the Nginx configuration that fixes this:

```nginx
location /ws {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;

    # These two lines are non-negotiable for WebSocket
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Pass origin and host for server-side validation
    proxy_set_header Host $host;
    proxy_set_header Origin $http_origin;
    proxy_set_header X-Real-IP $remote_addr;

    # WebSocket connections are long-lived
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

The `proxy_http_version 1.1` line matters. HTTP/1.0 does not
support the `Upgrade` mechanism. If your proxy defaults to 1.0
for backend connections, the handshake fails silently.

For detailed Nginx WebSocket configuration, see the
[Nginx infrastructure guide](/guides/infrastructure/nginx/).

### Framework CORS middleware blocking the handshake

This is the one that actually involves CORS — but not on the
WebSocket connection itself. Many web frameworks run all incoming
HTTP requests through CORS middleware before routing. The
WebSocket upgrade starts as an HTTP `GET`, so the CORS middleware
intercepts it and rejects it because the `Origin` doesn't match
the allowed list.

The fix depends on your framework:

**Django Channels:** Django's CORS middleware (`django-cors-headers`)
runs on all HTTP requests, including the upgrade handshake. You
need to either add the WebSocket origin to `CORS_ALLOWED_ORIGINS`
or, better, exclude the WebSocket path from CORS middleware and
handle origin validation in your WebSocket consumer:

```python
# consumers.py — validate Origin in the WebSocket consumer
class ChatConsumer(AsyncWebsocketConsumer):
    async def websocket_connect(self, message):
        origin = dict(self.scope["headers"]).get(
            b"origin", b""
        ).decode()
        allowed = ["https://app.example.com"]
        if origin not in allowed:
            await self.close(code=4003)
            return
        await self.accept()
```

**Spring Boot:** The `@CrossOrigin` annotation and
`WebMvcConfigurer` CORS settings apply to HTTP endpoints. For
WebSocket, configure allowed origins separately in
`WebSocketConfigurer`:

```java
@Configuration
@EnableWebSocket
public class WsConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(
        WebSocketHandlerRegistry registry
    ) {
        registry
            .addHandler(chatHandler(), "/ws/chat")
            .setAllowedOrigins("https://app.example.com");
    }
}
```

**Express/Node.js:** If you're using the `cors` middleware, it
runs before `express-ws` or `ws` handles the upgrade. Either
allow the origin in the cors config or skip cors for the
WebSocket path and validate manually:

```javascript
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  const allowed = ["https://app.example.com"];
  if (!allowed.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

### Cross-Site WebSocket Hijacking (CSWSH)

This isn't a bug — it's a security vulnerability that exists
because WebSocket skips CORS. Any website can open a WebSocket
connection to your server. If your server uses cookies for
authentication, the browser will send those cookies with the
upgrade request. A malicious page can connect to your WebSocket
endpoint, authenticated as the visiting user, and read whatever
the server sends.

This is why origin validation is not optional. Always check the
`Origin` header during the handshake:

```javascript
// Server-side origin validation (Node.js with ws)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  const trusted = [
    "https://app.example.com",
    "https://staging.example.com",
  ];

  if (!trusted.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
```

For defense in depth, combine origin validation with token-based
authentication rather than relying on cookies alone.
[Managed WebSocket services][ably-ws] handle origin validation and
token auth out of the box, which removes this entire class of
vulnerability. See the
[authentication guide](/guides/authentication/) for token patterns
you can implement yourself.

[ably-ws]:
  https://ably.com/websockets?utm_source=websocket-org&utm_medium=cors

## A debugging checklist

When your WebSocket connection fails and you suspect "CORS":

1. **Read the actual error message.** "Mixed Content" is not
   CORS. "Unexpected response code: 400" is not CORS. "Connection
   closed before receiving a handshake response" is not CORS.
2. **Check the protocol.** HTTPS page + `ws://` = mixed content
   block. Use `wss://`.
3. **Check the proxy.** Open browser DevTools, Network tab, filter
   by WS. If the request shows a `400` or `403` from the proxy,
   the proxy isn't forwarding the upgrade.
4. **Check framework middleware.** If you're using Django, Spring,
   or Express with CORS middleware, it may block the HTTP upgrade
   before the WebSocket handler sees it.
5. **Check the server response.** If the server returns HTTP
   headers without `101 Switching Protocols`, something between
   the client and the server is intercepting the request.

## Frequently Asked Questions

### Do WebSockets use CORS?

No, and understanding this saves significant debugging time.
CORS is a browser-enforced mechanism for `fetch()` and
`XMLHttpRequest` that uses preflight `OPTIONS` requests and
response headers like `Access-Control-Allow-Origin`. WebSocket
connections bypass this entirely. The browser sends an `Origin`
header during the upgrade handshake as information for the server,
but it never checks the response for CORS headers. If the server
responds with `101 Switching Protocols`, the connection opens —
regardless of origin. This is defined in
[RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455) and is
intentional: origin enforcement is the server's job.

### Why do I get a CORS error with WebSocket?

Almost every "WebSocket CORS error" is actually something else.
The three most common culprits: mixed content blocking
(`ws://` from an `https://` page), a reverse proxy that strips the
`Upgrade` header and returns an HTTP error, or framework middleware
(Django's `django-cors-headers`, Spring's `@CrossOrigin`,
Express's `cors`) that rejects the HTTP upgrade request before it
reaches the WebSocket handler. Check your browser's DevTools
console for the exact error text — the wording tells you which
problem you have. "Mixed Content" and "blocked insecure content"
mean protocol mismatch. "Unexpected response code" means proxy or
server misconfiguration.

### How do I fix WebSocket cross-origin issues in Nginx?

The fix is two non-negotiable headers: `Upgrade` and `Connection`.
Without them, Nginx treats the upgrade request as a normal HTTP
request and either proxies it incorrectly or returns a `400`.
You also need `proxy_http_version 1.1` because HTTP/1.0 doesn't
support connection upgrades. Beyond that, pass through `Host` and
`Origin` so your backend can validate origins, and set
`proxy_read_timeout` to something much longer than the default
60 seconds — WebSocket connections are long-lived, and Nginx will
close idle connections once the timeout expires. See the full
[Nginx WebSocket configuration guide](/guides/infrastructure/nginx/)
for production-ready configs with SSL termination and health
checks.

### Should I validate the Origin header on my WebSocket server?

Yes — this is a security requirement, not a nice-to-have. Because
browsers don't enforce CORS on WebSocket, any website can open a
connection to your server. If you authenticate with cookies (which
the browser sends automatically with the upgrade request), a
malicious page can connect as the logged-in user and receive
whatever data you send. This is Cross-Site WebSocket Hijacking
(CSWSH). Validate the `Origin` header during the handshake and
reject connections from untrusted origins. For stronger protection,
combine origin checks with token-based authentication — tokens
aren't sent automatically, so a malicious page can't use them.

### Why does my WebSocket work locally but fail in production?

Local development hides three problems that production exposes.
First, localhost often uses `http://` so `ws://` works fine — but
production uses `https://`, which blocks `ws://` as mixed content.
Second, there's no reverse proxy locally, but production routes
through Nginx, AWS ALB, Cloudflare, or similar — any of which can
strip WebSocket upgrade headers if not configured correctly.
Third, framework CORS middleware often allows `localhost` by
default but rejects your production domain. Start debugging by
checking these three things in order: protocol (`wss://` not
`ws://`), proxy headers, framework CORS config. For infrastructure
specifics, see the
[AWS ALB](/guides/infrastructure/aws/alb/) and
[Cloudflare](/guides/infrastructure/cloudflare/) guides.

## Related Content

- [WebSocket Security Hardening](/guides/security/) — TLS
  configuration, origin validation, and attack surface reduction
- [WebSocket Authentication](/guides/authentication/) — token-based
  auth patterns that work with cross-origin WebSocket connections
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/) —
  production proxy configuration with upgrade header forwarding
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) —
  the HTTP upgrade handshake and framing at the wire level
- [Building a WebSocket App](/guides/building-a-websocket-app/) —
  end-to-end implementation including cross-origin deployment
