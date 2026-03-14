---
title: 'WebSocket Port Numbers: Default 80, 443 & Custom Ports'
description: 'WebSocket uses port 80 (ws://) and 443 (wss://). No dedicated port exists. Use 443 in production — custom ports get blocked by firewalls and proxies.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-26'
lastUpdated: 2026-03-26
category: reference
sidebar:
  order: 4
keywords:
  - websocket port
  - websocket port number
  - what port does websocket use
  - ws port
  - wss port
  - websocket custom port
seo:
  keywords:
    - websocket port
    - websocket port number
    - what port does websocket use
    - websocket default port
    - ws port 80
    - wss port 443
    - websocket firewall port
faq:
  - q: 'What port does WebSocket use?'
    a: 'WebSocket uses port 80 for unencrypted connections (ws://) and port 443 for encrypted connections (wss://). These are the same ports as HTTP and HTTPS. No dedicated WebSocket port exists — RFC 6455 defines it this way.'
  - q: 'Can I use a custom port for WebSocket?'
    a: 'Yes, WebSocket servers can bind to any TCP port. However, non-standard ports are blocked by most corporate firewalls and transparent proxies. Use port 443 with TLS in production.'
  - q: 'Do I need to open special firewall ports for WebSocket?'
    a: 'No. WebSocket connections start as HTTP on port 80 or 443, then upgrade in-place. If your firewall allows HTTPS, WebSocket over wss:// on port 443 will work without any rule changes.'
  - q: 'Why does my WebSocket connection fail on a corporate network?'
    a: 'Corporate networks block outbound traffic on non-standard ports and run transparent proxies that break unencrypted WebSocket frames. The fix: use wss:// on port 443. TLS prevents proxy interference.'
  - q: 'Is Sec-WebSocket-Protocol related to port selection?'
    a: 'No. Sec-WebSocket-Protocol negotiates a subprotocol (like graphql-ws or mqtt) for message formatting. It has nothing to do with TCP ports. The name confuses people because "protocol" sounds network-level, but it operates at the application layer.'
---

:::note[Quick Answer]
WebSocket uses **port 80** for `ws://` and **port 443** for `wss://` —
the same ports as HTTP and HTTPS. No dedicated WebSocket port exists.
Use port 443 with TLS in production. Custom ports work in development
but get blocked by corporate firewalls and transparent proxies.
:::

## Default Ports

Every WebSocket connection starts as an HTTP request. The client
sends an `Upgrade` request on port 80 or 443, the server responds
with `101 Switching Protocols`, and the connection switches to the
WebSocket binary frame protocol on the same port. It never changes
port.

[RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455#section-1.7)
explicitly defines `ws://` as port 80 and `wss://` as port 443.
IANA never assigned a separate port for WebSocket, and that was
deliberate.

| Port | Scheme | Encrypted | Production Use |
| ---- | ------ | --------- | --------------------------------------- |
| 80 | `ws://` | No | No — local dev only |
| 443 | `wss://` | Yes (TLS) | Yes — always use this |
| 8080 | `ws://` | No | No — blocked by most firewalls |
| 3000 | `ws://` | No | No — dev server convention only |

## Why WebSocket Reuses HTTP Ports

A new port would have required every corporate firewall, proxy,
and load balancer to be reconfigured before WebSocket traffic could
flow. That would have killed adoption.

By reusing ports 80 and 443, WebSocket works on any network that
allows web traffic. No IT tickets. No firewall exceptions. The
upgrade handshake looks like normal HTTP to every intermediary
until the `101` response, at which point the connection is already
established.

This also means WebSocket benefits from existing TLS infrastructure.
Your certificate, CDN, and load balancer all work without
modification.

## Always Use Port 443 in Production

Use `wss://` for every production deployment. There are no good
exceptions:

- **Encryption**: Unencrypted WebSocket traffic is readable by any
  network intermediary. TLS protects data in transit.
- **Firewall traversal**: Many corporate networks allow only ports
  80 and 443 outbound. Some block port 80 too.
- **Proxy compatibility**: Transparent proxies that inspect traffic
  will corrupt unencrypted WebSocket binary frames. They see
  non-HTTP data and either drop the connection or mangle it. TLS
  prevents this because the proxy cannot read the encrypted content.
- **Browser mixed content**: Pages served over `https://` cannot
  open `ws://` connections. The browser blocks them silently.

## Custom Ports: Development vs Production

Custom ports like 3000, 8080, or 9090 are fine for local
development. They cause problems in production.

### When custom ports work

- Local development where you control the network
- Internal services behind a VPN where firewall rules are yours
- Testing environments on private networks

### When custom ports fail

**Corporate firewalls** allow only ports 80 and 443 outbound. A
WebSocket server on port 8080 is unreachable. The connection times
out with no error message — the user sees nothing.

**Transparent proxies** on corporate and hotel networks intercept
non-standard ports. They attempt to parse WebSocket binary frames
as HTTP. The connection breaks immediately or after the first
message.

**Mobile carriers** sometimes restrict outbound ports. Users on
cellular networks may not reach your server on port 3000.

### Port conflicts during development

Running multiple servers locally means port collisions. Node.js
gives you `EADDRINUSE`. The fix is straightforward:

```javascript
const server = require('http').createServer();
const port = process.env.PORT || 8080;

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} in use. Try ${port + 1}`);
    process.exit(1);
  }
});
```

Use environment variables for port assignment. Hard-coding ports
across multiple services guarantees conflicts.

## Firewall and Corporate Proxy Behavior

Corporate networks are the biggest source of WebSocket connection
failures. Here is what actually happens:

1. **Outbound port filtering**: The firewall drops TCP SYN packets
   to any port other than 80 and 443. Your connection attempt
   hangs until it times out.
2. **Transparent HTTP proxies**: The proxy intercepts port 80
   traffic, sees the `Upgrade` header, and either strips it or
   rejects the request. The WebSocket handshake never completes.
3. **Deep packet inspection**: Some firewalls inspect TLS traffic
   using a corporate root CA. Even `wss://` on port 443 can fail
   if the proxy does not support WebSocket upgrade over its
   intercepted TLS connection.

The solution for cases 1 and 2 is `wss://` on port 443. For case
3, there is no client-side fix — the network administrator must
configure the inspection proxy to pass WebSocket upgrades through.

## Cloud Provider Port Restrictions

Cloud load balancers expect WebSocket traffic on standard ports.
Here is what each major provider supports:

**AWS Application Load Balancer (ALB)**: Supports WebSocket on
any listener port, but the default setup uses 80 and 443. ALB
handles the TLS termination and forwards the upgraded connection
to your backend. No special configuration needed — ALB recognizes
the `Upgrade` header automatically.

**Cloudflare**: Proxies WebSocket traffic only on
[specific ports](https://developers.cloudflare.com/fundamentals/reference/network-ports/).
Ports 80, 443, 8080, and 8443 work. Port 3000 does not. If you
use Cloudflare as your CDN and your WebSocket server runs on a
non-standard port, connections will fail.

**Google Cloud Load Balancer**: Supports WebSocket on ports 80 and
443. The backend service must use the same protocol (HTTP or
HTTPS) that the client connects with.

**Azure Application Gateway**: Supports WebSocket on standard
ports. Enable WebSocket in the gateway's Settings > Configuration
blade, then set the backend HTTP setting's request timeout above
the default 30 seconds — idle WebSocket connections get terminated
when the timeout expires.

## Reverse Proxies and WebSocket Ports

In production, your WebSocket server typically runs on an internal
port (like 8080) behind a reverse proxy that exposes port 443. The
proxy handles TLS termination and forwards the upgrade request.

### Nginx

```nginx
upstream websocket_backend {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Three things that trip people up:

- `proxy_http_version 1.1` is mandatory. HTTP/1.0 does not
  support connection upgrades.
- Without `proxy_set_header Upgrade` and `Connection`, Nginx
  strips those headers and the handshake fails silently.
- `proxy_read_timeout` defaults to 60 seconds. Idle WebSocket
  connections will be closed unless you increase it.

### AWS ALB

ALB supports WebSocket without special configuration. It detects
the `Upgrade` header and holds the connection open. Set the idle
timeout appropriately — the default is 60 seconds, which will
drop idle WebSocket connections. At
[Ably](https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=ports),
we run WebSocket connections through multiple load balancer tiers,
and idle timeout tuning is one of the first things to get right.
Services like [Pusher](https://pusher.com/) and
[PubNub](https://www.pubnub.com/) face similar configuration
requirements at their scale.

## Sec-WebSocket-Protocol Is Not About Ports

This catches people because the name includes "Protocol." The
`Sec-WebSocket-Protocol` header negotiates a _subprotocol_ — an
application-layer agreement about message format, like
`graphql-ws` or `mqtt`. It has zero relationship to TCP ports or
network-level protocol selection.

A WebSocket connection on port 443 using `Sec-WebSocket-Protocol:
graphql-ws` is still on port 443. The subprotocol tells both sides
how to interpret the messages, not where to send them. See the
[headers reference](/reference/headers/) for the full details on
how subprotocol negotiation works.

## Frequently Asked Questions

### What port does WebSocket use?

Port 80 for unencrypted connections (`ws://`) and port 443 for
encrypted connections (`wss://`). These are the same ports as HTTP
and HTTPS. The WebSocket RFC intentionally avoided defining a new
port — reusing HTTP ports meant WebSocket worked immediately on
existing infrastructure without firewall changes.

### Can I use a custom port for WebSocket?

Yes, a WebSocket server can listen on any TCP port. Bind to 8080,
3000, or anything else during development. But non-standard ports
are blocked by corporate firewalls, hotel networks, and some mobile
carriers. For production, always put a reverse proxy (Nginx, ALB)
in front that exposes port 443 with TLS. Your backend can still
run on whatever port you like internally.

### Do I need to open special firewall ports for WebSocket?

No. WebSocket connections use ports 80 and 443 — the same as
regular web traffic. The connection starts as a normal HTTP request
that any web-friendly firewall already permits, then upgrades
in-place on the same port. If your network allows HTTPS, WebSocket
over `wss://` will work without additional firewall rules.

### Why does my WebSocket connection fail on a corporate network?

Three things happen on corporate networks: outbound port filtering
blocks non-standard ports, transparent proxies strip the `Upgrade`
header from unencrypted HTTP requests, and deep packet inspection
can interfere even with TLS. The fix for most cases: use `wss://`
on port 443. TLS prevents proxy interference, and port 443 passes
through virtually every firewall.

### Is Sec-WebSocket-Protocol related to port selection?

No. Despite the name, `Sec-WebSocket-Protocol` negotiates an
application-layer subprotocol (like `graphql-ws` or `mqtt`) that
defines message format. It does not affect which TCP port the
connection uses. A WebSocket connection on port 443 with
`Sec-WebSocket-Protocol: mqtt` is still on port 443. See the
[headers reference](/reference/headers/) for how subprotocol
negotiation works during the handshake.

## Related Content

- [WebSocket Headers Reference](/reference/headers/) — Every
  handshake header explained, including Sec-WebSocket-Protocol
- [WSS vs WS](/reference/wss-vs-ws/) — Why encrypted WebSocket
  connections are mandatory in production
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/) —
  Complete reverse proxy setup for WebSocket
- [WebSocket Security Guide](/guides/security/) — TLS,
  authentication, and common vulnerabilities
- [WebSocket Protocol Guide](/guides/websocket-protocol/) — How
  the handshake and upgrade mechanism works
