---
title: 'wss vs ws: Secure WebSocket vs Unencrypted Explained'
description: >-
  wss:// is WebSocket over TLS (encrypted). ws:// is unencrypted. Always use
  wss:// in production — browsers block ws:// on HTTPS pages and proxies may
  strip unencrypted WebSocket traffic.
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-12'
lastUpdated: 2026-03-12
category: reference
sidebar:
  order: 5
keywords:
  - wss vs ws
  - websocket ssl
  - websocket tls
  - wss websocket
  - secure websocket
seo:
  keywords:
    - wss vs ws
    - websocket ssl
    - websocket tls
    - wss websocket
    - secure websocket
    - websocket encryption
faq:
  - q: 'What is the difference between ws and wss?'
    a: >-
      ws:// is unencrypted WebSocket. wss:// is WebSocket over TLS
      (encrypted). The relationship is the same as HTTP vs HTTPS. Always use
      wss:// in production.
  - q: 'Do I need SSL for WebSocket?'
    a: >-
      In production, yes. Browsers block unencrypted ws:// connections from
      HTTPS pages (mixed content). Corporate proxies often strip unencrypted
      WebSocket traffic. Use wss:// with a valid TLS certificate.
  - q: 'Does wss add latency?'
    a: >-
      The TLS handshake adds 1-2ms on modern hardware. After that, per-frame
      encryption overhead is negligible. The security and compatibility
      benefits far outweigh the minimal performance cost.
---

:::note[Quick Answer]
`wss://` is WebSocket over TLS (encrypted). `ws://` is unencrypted.
The relationship is the same as HTTPS vs HTTP. Always use `wss://` in
production — browsers block `ws://` on HTTPS pages, and corporate
proxies regularly strip unencrypted WebSocket traffic.
:::

## ws:// vs wss:// at a Glance

| | `ws://` | `wss://` |
| --- | --- | --- |
| **Encryption** | None | TLS (same as HTTPS) |
| **Default port** | 80 | 443 |
| **Works on HTTPS pages** | No (blocked by mixed content) | Yes |
| **Passes through proxies** | Often stripped or blocked | Yes (encrypted tunnel) |
| **Production use** | Local development only | Required |

## Why wss:// Is Required in Practice

Encryption is reason enough, but two practical issues make
`ws://` unusable in production even if you don't care about
security.

### Mixed content blocking

If your page is served over HTTPS — and every production page
should be — browsers refuse to open `ws://` connections. This is
the same mixed content policy that blocks loading HTTP images on
HTTPS pages. The connection silently fails. No error dialog, no
user prompt, just a failed WebSocket in the console.

```text
Mixed Content: The page was loaded over HTTPS, but attempted
to connect to the insecure WebSocket endpoint 'ws://...'.
This request has been blocked.
```

There is no workaround. If your page is HTTPS, your WebSocket
must be `wss://`.

### Proxy and firewall interference

Corporate proxies, transparent proxies, and some ISP-level
middleboxes inspect unencrypted traffic. They often don't understand
the WebSocket upgrade handshake and either drop the connection or
strip the `Upgrade` header. The result: your WebSocket works fine
on your home network and fails silently for a subset of users
behind corporate firewalls.

`wss://` solves this because the TLS tunnel is opaque to
intermediaries. They see an HTTPS connection to port 443 and
pass it through.

## TLS Performance

The TLS handshake adds roughly 1-2ms of latency on modern
hardware. After the handshake, per-frame encryption overhead is
negligible — AES-GCM on modern CPUs with hardware acceleration
adds microseconds per frame, not milliseconds.

The performance argument for `ws://` made sense in 2010. It
doesn't in 2026.

## TLS Termination Patterns

Most production deployments don't terminate TLS at the application
level. The typical pattern:

```text
Client (wss://) --> Load Balancer/Proxy (TLS termination)
                        --> Backend (ws://)
```

The load balancer or reverse proxy handles the TLS certificate and
encryption. Your application server receives plain `ws://`
connections on an internal network. This is simpler, faster, and
lets you manage certificates in one place.

Common TLS termination points:

- **Nginx** — handles TLS and proxies `ws://` to your backend
  using `proxy_pass` with `Upgrade` headers
- **Cloudflare** — terminates TLS at the edge, proxies to
  your origin over `ws://` or `wss://`
- **AWS ALB** — terminates TLS with ACM certificates, forwards
  WebSocket connections to target groups
- **HAProxy** — TLS termination with WebSocket-aware
  connection handling

## Common Issues

### Self-signed certificates

Browsers silently reject WebSocket connections to servers with
self-signed or invalid TLS certificates. Unlike HTTPS, there is
no "click to proceed anyway" dialog. The connection just fails
with a generic error.

For development, use [mkcert](https://github.com/FiloSottile/mkcert)
to create locally-trusted certificates. For production, use
[Let's Encrypt](https://letsencrypt.org/) (free, automated) or
any real certificate authority.

### Protocol mismatch in JavaScript

Hardcoding `ws://` in client code is the most common mistake.
Match the page protocol instead:

```javascript
// Bad: hardcoded ws:// will fail on HTTPS pages
const ws = new WebSocket('ws://example.com/ws');

// Good: match the page protocol
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
```

## Frequently Asked Questions

### What is the difference between ws and wss?

`ws://` is unencrypted WebSocket. `wss://` is WebSocket over
TLS — identical framing and message format, different transport
security. The relationship mirrors HTTP vs HTTPS. Use `wss://`
for everything except `localhost` during development.

### Do I need SSL for WebSocket?

Yes. Beyond encryption, `wss://` is required for compatibility.
Browsers block `ws://` from HTTPS pages, and network
intermediaries regularly interfere with unencrypted WebSocket
connections. The only place `ws://` works reliably is
`localhost`.

### Does wss add latency?

The TLS handshake adds 1-2ms on modern hardware. Per-frame
encryption overhead is in the microsecond range with
hardware-accelerated AES. TLS latency is not a factor in
your performance budget.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) — browser
  API for creating and managing WebSocket connections
- [The Road to WebSockets](/guides/road-to-websockets/) — how
  WebSocket fits into the evolution of realtime web protocols
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) —
  the framing, handshake, and protocol internals behind ws and wss
- [Nginx WebSocket Proxy](/guides/infrastructure/nginx/) — how to
  configure TLS termination and WebSocket proxying in Nginx
- [Cloudflare WebSocket Proxy](/guides/infrastructure/cloudflare/)
  — Cloudflare configuration for WebSocket connections
