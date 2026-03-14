---
title: 'wss vs ws: Secure WebSocket vs Unencrypted Explained'
description: >-
  wss:// is WebSocket over TLS (encrypted, port 443). ws:// is
  unencrypted (port 80). Always use wss:// in production — browsers
  block ws:// on HTTPS pages and proxies strip unencrypted traffic.
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2026-03-31'
lastUpdated: 2026-03-31
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
      ws:// is unencrypted WebSocket on port 80. wss:// is WebSocket
      over TLS on port 443. The relationship is the same as HTTP vs
      HTTPS. Always use wss:// in production.
  - q: 'Do I need SSL for WebSocket?'
    a: >-
      In production, yes. Browsers block unencrypted ws:// connections
      from HTTPS pages (mixed content). Corporate proxies often strip
      unencrypted WebSocket traffic. Use wss:// with a valid TLS
      certificate.
  - q: 'Does wss add latency?'
    a: >-
      The TLS handshake adds 1-2ms on modern hardware. After that,
      per-frame encryption overhead is negligible. The security and
      compatibility benefits far outweigh the cost.
  - q: 'Can browsers connect to ws:// from an HTTPS page?'
    a: >-
      No. All modern browsers enforce mixed content blocking. An
      HTTPS page cannot open a ws:// connection. The browser silently
      blocks it with no user prompt. Use wss:// instead.
  - q: 'How do I set up TLS for WebSocket in production?'
    a: >-
      Terminate TLS at your load balancer or reverse proxy (Nginx,
      AWS ALB, Cloudflare) and proxy plain ws:// to your backend.
      Use Let's Encrypt for free automated certificates. Do not
      terminate TLS in your application code.
---

:::note[Quick Answer]
`wss://` is WebSocket over TLS (encrypted, port 443). `ws://` is
unencrypted (port 80). Always use `wss://` in production --
browsers block `ws://` on HTTPS pages, corporate proxies strip
unencrypted WebSocket traffic, and there is no legitimate reason
to skip encryption in 2026.
:::

## ws:// vs wss:// at a Glance

| | `ws://` | `wss://` |
| --- | --- | --- |
| **Encryption** | None | TLS (same as HTTPS) |
| **Default port** | 80 | 443 |
| **Works on HTTPS pages** | No (mixed content) | Yes |
| **Passes through proxies** | Often stripped or blocked | Yes (encrypted tunnel) |
| **Production use** | Local development only | Required |

## Why wss:// Is Not Optional

Encryption is reason enough. But two practical issues make
`ws://` unusable in production even if security is not your
primary concern.

### Mixed content blocking

If your page is served over HTTPS -- and every production page
should be -- browsers refuse to open `ws://` connections. This
is the same mixed content policy that blocks HTTP images on
HTTPS pages. The connection fails silently. No error dialog.
No user prompt. Just a rejected WebSocket in the console.

```text
Mixed Content: The page was loaded over HTTPS, but attempted
to connect to the insecure WebSocket endpoint 'ws://...'.
This request has been blocked.
```

There is no workaround. No header, no flag, no user override.
If your page is HTTPS, your WebSocket must be `wss://`.

### Proxy and firewall interference

Corporate proxies, transparent proxies, and ISP-level
middleboxes inspect unencrypted traffic. They often don't
understand the WebSocket upgrade handshake and either drop the
connection or strip the `Upgrade` header. The result: your
WebSocket works on your home network and fails silently for
users behind corporate firewalls.

`wss://` solves this because the TLS tunnel is opaque to
intermediaries. They see an HTTPS connection to port 443 and
pass it through. This is the same reason services like
[Ably][ably-realtime], Pusher, and PubNub exclusively use
`wss://` for client connections -- `ws://` is simply
unreliable across real-world networks.

## TLS Performance

The performance argument against TLS died years ago.

The TLS 1.3 handshake adds one round trip -- roughly 1-2ms on
modern hardware. After the handshake, per-frame encryption
uses AES-GCM with hardware acceleration (AES-NI). The
overhead is microseconds per frame, not milliseconds.

For context: a WebSocket frame header is 2-14 bytes. TLS adds
roughly 29 bytes of overhead per record (21 bytes for TLS 1.2,
fewer for TLS 1.3). On a 100-byte message, that is a 29%
size increase. On a 1KB message, it is under 3%. The CPU cost
of encrypting either is unmeasurable in a flame graph.

WebSocket connections are long-lived. You pay the handshake
cost once, then send thousands of frames over the same
connection. The amortized TLS cost per message is effectively
zero.

## Browser Behavior Differences

Browsers handle `ws://` and `wss://` differently in ways that
matter for debugging:

**Certificate errors are silent.** When an HTTPS page loads an
image from a server with a bad certificate, the browser shows a
warning. When a `wss://` connection fails due to a certificate
error, the browser fires a generic `onerror` event with no
details. The `CloseEvent.code` is typically `1006` (abnormal
closure) with an empty `reason` string. You get no indication
that the certificate was the problem.

**No certificate override.** HTTPS pages with invalid
certificates show a "proceed anyway" button. WebSocket
connections do not. A bad certificate means no connection,
period.

**DevTools visibility.** Chrome and Firefox show WebSocket
frames in the Network tab, but only if you select the
connection before messages start flowing. There is no
retroactive capture. This applies to both `ws://` and
`wss://`, but with `wss://` you also cannot use Wireshark to
inspect traffic as a fallback.

## TLS Termination in Production

Most production deployments do not terminate TLS in the
application. The standard pattern:

```text
Client (wss://) --> Load Balancer (TLS termination)
                        --> Backend (ws://)
```

Your load balancer or reverse proxy handles the certificate and
encryption. Your application server receives plain `ws://`
connections on an internal network. This is simpler, performs
better, and centralizes certificate management.

### Nginx configuration

Nginx terminates TLS and proxies `ws://` to the backend. The key
lines: `listen 443 ssl` for the TLS listener, `proxy_http_version
1.1` (HTTP/1.0 doesn't support upgrades), and the `Upgrade` /
`Connection` header forwarding. Set `proxy_read_timeout` to at
least 24 hours — Nginx defaults to 60 seconds and will drop idle
WebSocket connections. See the
[Nginx WebSocket configuration guide](/guides/infrastructure/nginx/)
for a full production config with SSL, health checks, and
upstream tuning.

### Other termination points

- **AWS ALB** -- terminates TLS with ACM certificates, forwards
  WebSocket connections to target groups on port 80
- **Cloudflare** -- terminates TLS at the edge, proxies to your
  origin over `ws://` or `wss://`
- **HAProxy** -- TLS termination with WebSocket-aware
  connection handling and health checks

## Certificate Setup

### Production: Let's Encrypt

Use [Let's Encrypt](https://letsencrypt.org/) with Certbot for
free, automated TLS certificates. Certificates renew every 90
days. Certbot handles renewal automatically.

```bash
# Install certbot and get a certificate
sudo certbot --nginx -d example.com

# Verify auto-renewal works
sudo certbot renew --dry-run
```

If you terminate TLS at a cloud load balancer (AWS ALB,
Cloudflare), use their built-in certificate management instead.
AWS Certificate Manager is free for ALB-attached certificates.

### Development: mkcert

Browsers silently reject WebSocket connections to servers with
self-signed certificates. Unlike HTTPS pages, there is no
"click to proceed anyway" dialog. The connection fails with a
generic error and no explanation.

Use [mkcert](https://github.com/FiloSottile/mkcert) to create
locally-trusted development certificates:

```bash
# Install mkcert (macOS)
brew install mkcert
mkcert -install

# Create certificates for localhost
mkcert localhost 127.0.0.1 ::1
# Creates localhost+2.pem and localhost+2-key.pem
```

Then use these certificates in your development server. Node.js
example:

```javascript
const https = require('https');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const server = https.createServer({
  cert: fs.readFileSync('localhost+2.pem'),
  key: fs.readFileSync('localhost+2-key.pem'),
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  ws.on('message', (data) => ws.send(data));
});

server.listen(8443);
```

## Common Mistakes

### Hardcoded ws:// in client code

This is the most common WebSocket bug. A developer uses
`ws://` during development, it works on localhost, and the
hardcoded URL ships to production. It fails on every HTTPS
page.

Match the page protocol instead:

```javascript
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${location.host}/ws`);
```

### Certificate hostname mismatch

Your TLS certificate must match the hostname in the `wss://`
URL. If your certificate is for `example.com` but your client
connects to `wss://api.example.com`, the connection fails
silently. The browser fires `onerror` with no useful details.

Check with OpenSSL:

```bash
openssl s_client -connect api.example.com:443 \
  -servername api.example.com < /dev/null 2>&1 \
  | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"
```

If the hostname is not in the SAN list, the certificate will
not work for WebSocket connections to that hostname.

### Missing proxy_http_version in Nginx

Nginx defaults to HTTP/1.0 for upstream connections. HTTP/1.0
does not support the `Upgrade` mechanism. Your WebSocket
handshake will fail with a `400 Bad Request` from the backend.
Always set `proxy_http_version 1.1` in your WebSocket location
block.

## Frequently Asked Questions

### What is the difference between ws and wss?

`ws://` is unencrypted WebSocket on port 80. `wss://` is
WebSocket over TLS on port 443. The framing format and
message semantics are identical -- the only difference is
whether the TCP connection is wrapped in TLS. Use `wss://`
for everything except `localhost` during development.

### Do I need SSL for WebSocket?

Yes. Beyond encryption, `wss://` is required for
compatibility. Browsers block `ws://` from HTTPS pages
(mixed content policy), and network intermediaries regularly
interfere with unencrypted WebSocket traffic. The only
environment where `ws://` works reliably is `localhost`.

### Does wss add latency?

The TLS 1.3 handshake adds one round trip -- roughly 1-2ms
on modern hardware. After that, per-frame encryption adds
microseconds with hardware-accelerated AES. WebSocket
connections are long-lived, so the handshake cost is paid
once and amortized across thousands of messages. TLS
latency will not appear in your performance budget.

### Can browsers connect to ws:// from an HTTPS page?

No. Every modern browser enforces mixed content blocking.
An HTTPS page cannot open a `ws://` connection. Chrome,
Firefox, Safari, and Edge all block it silently -- no
prompt, no override, no workaround. The only fix is to use
`wss://`. This has been enforced since Chrome 61 (2017) and
is now universal.

### How do I set up TLS for WebSocket in production?

Terminate TLS at your load balancer or reverse proxy, not
in your application. Use Let's Encrypt with Certbot for free
certificates, or use your cloud provider's certificate
management (AWS ACM, Cloudflare). Proxy plain `ws://` to your
backend over the internal network. See the
[Nginx configuration](#nginx-configuration) above for a
working example.

## Related Content

- [WebSocket API Reference](/reference/websocket-api/) -- browser
  API for creating and managing WebSocket connections
- [WebSocket Port Numbers](/reference/ports/) -- why WebSocket
  uses ports 80 and 443, and why custom ports fail in production
- [The Road to WebSockets](/guides/road-to-websockets/) -- how
  WebSocket fits into the evolution of realtime web protocols
- [Nginx WebSocket Proxy](/guides/infrastructure/nginx/) -- how to
  configure TLS termination and WebSocket proxying in Nginx
- [WebSocket Protocol Deep Dive](/guides/websocket-protocol/) --
  the framing, handshake, and protocol internals behind ws and wss

[ably-realtime]:
  https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=wss-vs-ws
