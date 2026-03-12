---
title: 'WebSocket Port Numbers: 80 vs 443 & Custom Ports'
description: 'WebSocket uses ports 80 (ws://) and 443 (wss://) — the same as HTTP. No dedicated port exists. Always use 443 in production for firewall compatibility.'
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-12'
lastUpdated: 2026-03-12
category: reference
sidebar:
  order: 4
keywords:
  - websocket port
  - websocket port number
  - what port does websocket use
  - ws port
  - wss port
seo:
  keywords:
    - websocket port
    - websocket port number
    - what port does websocket use
    - websocket default port
    - ws port 80
    - wss port 443
faq:
  - q: 'What port does WebSocket use?'
    a: 'WebSocket uses port 80 for unencrypted connections (ws://) and port 443 for encrypted connections (wss://). These are the same ports as HTTP and HTTPS. There is no dedicated WebSocket port.'
  - q: 'Can I use a custom port for WebSocket?'
    a: 'Yes, WebSocket servers can listen on any port. However, non-standard ports like 8080 are often blocked by corporate firewalls. Use port 443 (wss://) in production for maximum compatibility.'
  - q: 'Do I need to open special firewall ports for WebSocket?'
    a: 'No. WebSocket connections start as HTTP requests on port 80 or 443, then upgrade to the WebSocket protocol on the same port. If your firewall allows HTTPS traffic, WebSocket connections on port 443 will work.'
---

:::note[Quick Answer]
WebSocket uses **port 80** for `ws://` and **port 443** for `wss://` — the
same ports as HTTP and HTTPS. There is no dedicated WebSocket port. This is
intentional: WebSocket connections pass through any firewall or proxy that
already allows web traffic.
:::

## Default Ports

WebSocket shares its ports with HTTP because every WebSocket connection
starts as an HTTP request. The client sends an HTTP `Upgrade` request on
port 80 or 443, the server responds with `101 Switching Protocols`, and
from that point the connection speaks WebSocket — but it never changes
port.

This is deliberate. By reusing HTTP ports, WebSocket avoids requiring
new firewall rules or proxy configurations. If your infrastructure
serves web traffic, it can serve WebSocket traffic too.

## Port Reference

| Port | Protocol | URI Scheme | Use in Production |
| ---- | -------- | ---------- | ---------------------------------------- |
| 80 | HTTP | `ws://` | No — unencrypted, use for local dev only |
| 443 | HTTPS | `wss://` | Yes — encrypted, firewall-friendly |
| 8080 | Custom | `ws://` | No — often blocked by firewalls |

## Why There Is No Dedicated WebSocket Port

IANA never assigned a separate port for WebSocket, and
[RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455#section-1.7)
explicitly defines `ws://` as port 80 and `wss://` as port 443.

This was a practical decision. A new port would have required every
corporate firewall, proxy, and load balancer to be reconfigured before
WebSocket traffic could flow. By piggybacking on HTTP ports, WebSocket
worked immediately on existing infrastructure — no IT tickets required.

## Always Use Port 443 in Production

Use `wss://` (port 443) for every production deployment. There are no
good reasons to use `ws://` outside of local development:

- **Encryption**: TLS protects data in transit.
  Unencrypted WebSocket traffic is readable by any network intermediary.
- **Firewall compatibility**: Many corporate networks block
  all traffic except ports 80 and 443. Some block port 80 too, allowing
  only HTTPS.
- **Proxy traversal**: HTTP proxies that inspect traffic
  will often break unencrypted WebSocket connections because they don't
  understand the binary frames. TLS prevents this interference.
- **Browser requirements**: Mixed content policies in
  modern browsers block `ws://` connections from pages served over
  `https://`.

## Common Issues with Custom Ports

Using a non-standard port like 8080, 3000, or 9090 works in development
but creates problems in production:

**Corporate firewalls** typically allow only ports 80 and 443 outbound.
Your users behind these networks simply cannot connect to a WebSocket
server on port 8080 — the connection will time out silently.

**Transparent proxies** on corporate and hotel networks intercept traffic
on non-standard ports and either block it or attempt to parse it as HTTP,
breaking the WebSocket connection.

**Cloud load balancers** (AWS ALB, Cloudflare, etc.) expect WebSocket
traffic on 80/443 by default. Custom listener ports add complexity
with no benefit.

If you use a custom port in development, put a reverse proxy like
[Nginx](/guides/infrastructure/nginx/) in front of it to expose
port 443 in production.

## Frequently Asked Questions

### What port does WebSocket use?

Port 80 for unencrypted connections (`ws://`) and port 443 for encrypted
connections (`wss://`) — the same ports as HTTP and HTTPS. There is no
separate "WebSocket port." The connection starts as a normal HTTP request
and upgrades via the `Upgrade` header on the same port.

### Can I use a custom port for WebSocket?

Yes, a WebSocket server can listen on any TCP port. In Node.js, for
example, you can bind to port 8080 or any other available port. However,
non-standard ports are frequently blocked by corporate firewalls, hotel
networks, and mobile carriers. For production, always use port 443 with
TLS.

### Do I need to open special firewall ports for WebSocket?

No. WebSocket connections use ports 80 and 443 — the same as regular
web traffic — so no special firewall rules are needed. The connection
begins as an HTTP request that any web-friendly firewall already
permits, then upgrades in-place. If your network allows HTTPS,
WebSocket over `wss://` will work.

### Why does my WebSocket connection fail on a corporate network?

Corporate networks block outbound traffic except ports 80 and 443, and
some run transparent proxies that interfere with unencrypted WebSocket
frames. The fix: use `wss://` on port 443. TLS prevents proxy
interference, and port 443 passes through virtually every firewall.

### What is the difference between ws:// and wss://?

`ws://` is unencrypted WebSocket (default port 80) and `wss://` is
encrypted WebSocket over TLS (default port 443). The relationship is
identical to `http://` vs `https://`. Always use `wss://` in production
for security, firewall compatibility, and to avoid mixed content
browser errors.

## Related Content

- [WebSocket Protocol Guide](/guides/websocket-protocol/) — How the
  handshake and upgrade mechanism works
- [WebSocket API Reference](/reference/websocket-api/) — Browser API
  for creating and managing connections
- [WebSocket Security Guide](/guides/security/) — TLS, authentication,
  and common vulnerabilities
- [Nginx WebSocket Configuration](/guides/infrastructure/nginx/) —
  Reverse proxy setup for WebSocket on port 443
- [Building a WebSocket App](/guides/building-a-websocket-app/) —
  Step-by-step guide covering connection setup
