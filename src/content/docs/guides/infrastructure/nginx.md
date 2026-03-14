---
title: 'Nginx WebSocket Proxy: Config, SSL & Load Balancing'
description:
  'Copy-paste Nginx configs for WebSocket proxying with SSL/TLS termination,
  sticky sessions, health checks, and timeouts. Covers HTTP/1.1, HTTP/2, and
  HTTP/3.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
publishedDate: 2025-09-01T00:00:00.000Z
updatedDate: 2025-09-01T00:00:00.000Z
lastUpdated: 2026-03-14
category: infrastructure
tags:
  - nginx
  - websocket
  - infrastructure
  - proxy
  - load-balancing
  - ssl
seo:
  keywords:
    - nginx websocket
    - nginx websocket proxy
    - nginx websocket proxy pass
    - nginx websocket configuration
    - nginx websocket ssl
    - nginx websocket load balancing
    - nginx upgrade websocket
    - proxy_set_header upgrade
date: '2024-09-02'
faq:
  - q: 'How do I configure Nginx to proxy WebSocket connections?'
    a:
      'Add proxy_set_header Upgrade $http_upgrade and proxy_set_header
      Connection "upgrade" to your location block, alongside proxy_pass pointing
      to your backend. These headers tell Nginx to pass the HTTP Upgrade
      handshake through to the upstream server.'
  - q: 'Why do my WebSocket connections drop after 60 seconds through Nginx?'
    a:
      'Nginx defaults proxy_read_timeout to 60 seconds. Idle WebSocket
      connections with no traffic will be closed. Increase it with
      proxy_read_timeout 3600s and ensure your application sends ping/pong
      frames to keep the connection alive.'
  - q: 'How do I enable SSL/TLS for WebSockets behind Nginx?'
    a:
      'Configure a standard ssl server block with your certificate and key, then
      proxy_pass to your backend over plain ws://. Nginx handles TLS termination
      so clients connect via wss:// while your backend avoids the TLS overhead.'
  - q: 'Do I need sticky sessions for WebSocket load balancing in Nginx?'
    a:
      'Yes. WebSocket connections are stateful and long-lived, so all frames for
      a session must reach the same backend. Use ip_hash or the sticky directive
      (Nginx Plus) in your upstream block to ensure session affinity.'
---

:::note[Quick Answer]
Add `proxy_set_header Upgrade $http_upgrade` and
`proxy_set_header Connection "upgrade"` to your Nginx location block to proxy
WebSocket connections. Set `proxy_read_timeout` to a high value (e.g. 3600s) to
prevent idle connection drops.
:::

Nginx sits in front of most WebSocket deployments as a reverse proxy.
This guide provides copy-paste configs for proxying, load balancing,
SSL/TLS termination, and related operational concerns.

## Quick Start: Basic WebSocket Proxy

```nginx
http {
    upstream websocket_backend {
        server backend1.example.com:8080;
    }

    server {
        listen 80;
        server_name ws.example.com;

        location /ws {
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Connection Upgrade Map

If the same `location` serves both regular HTTP and WebSocket traffic,
use a `map` to set the `Connection` header conditionally:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

## SSL/TLS Configuration

Nginx terminates TLS so clients connect via `wss://` while backends
use plain `ws://`:

```nginx
server {
    listen 443 ssl http2;
    server_name ws.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /path/to/chain.pem;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ws.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Security Headers

```nginx
server {
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss://ws.example.com" always;
}
```

## Load Balancing

WebSocket load balancing has a constraint that HTTP load balancing
does not: connections are long-lived and stateful. A round-robin
strategy sends the upgrade request to one backend, but subsequent
frames could land on a different one -- and the connection breaks.

### Sticky Sessions (IP Hash)

Every frame in a session must reach the same backend:

```nginx
upstream websocket_backend {
    ip_hash;

    server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend3.example.com:8080 max_fails=3 fail_timeout=30s;

    keepalive 64;
}
```

### Least Connections Algorithm

```nginx
upstream websocket_backend {
    least_conn;

    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 weight=1;

    server backup.example.com:8080 backup;
}
```

### Health Checks

Active health checks require Nginx Plus. Open-source Nginx uses
passive checks via `max_fails`:

```nginx
# Passive health checks (open-source Nginx)
upstream websocket_backend {
    server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
}

# Active health checks (Nginx Plus only)
# upstream websocket_backend {
#     zone backend_zone 64k;
#     server backend1.example.com:8080;
#     health_check interval=5s fails=3 passes=2 uri=/health;
# }
```

## Timeout Configuration

WebSocket connections are long-lived. The default 60-second
`proxy_read_timeout` will kill idle connections:

```nginx
location /ws {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

A 7-day timeout is generous. The trade-off: zombie connections
(where the client has disappeared but the TCP socket stays open)
tie up backend resources until the timeout expires. Set your
application's WebSocket ping/pong interval to 30-60 seconds so
Nginx sees traffic and keeps the connection, while your backend
detects dead clients via missing pong responses.

At the OS level, enable TCP keepalive with `tcp_nodelay on` and
`tcp_nopush on` in the `http` block. These are separate from
WebSocket-level pings -- TCP keepalive detects dead network paths,
while WebSocket pings detect unresponsive applications.

## HTTP/3 Configuration (Experimental)

Requires an Nginx build with QUIC support. WebSocket-over-HTTP/3
uses [RFC 9220](https://tools.ietf.org/html/rfc9220) extended
CONNECT:

```nginx
server {
    listen 443 quic reuseport;
    listen 443 ssl http2;
    server_name ws.example.com;

    http3 on;
    add_header Alt-Svc 'h3=":443"; ma=86400' always;
    quic_retry on;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.3;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Buffering and Performance

Disable proxy buffering for WebSocket traffic to avoid added latency:

```nginx
location /ws {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_buffering off;
    proxy_request_buffering off;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
}
```

## Logging

Add `upgrade` and `upstream_addr` fields to track WebSocket
connections:

```nginx
http {
    log_format websocket '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        'upgrade=$http_upgrade '
                        'upstream_addr=$upstream_addr '
                        'upstream_response_time=$upstream_response_time';

    access_log /var/log/nginx/websocket_access.log websocket;

    # Skip health check noise
    map $request_uri $loggable {
        ~^/health$ 0;
        default 1;
    }
    access_log /var/log/nginx/access.log combined if=$loggable;
}
```

For debugging, enable per-location debug logging:

```nginx
location /ws {
    error_log /var/log/nginx/ws_debug.log debug;
}
```

## CORS Configuration

WebSocket handshakes are regular HTTP requests, so CORS preflight
applies if your client and server are on different origins:

```nginx
location /ws {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Sec-WebSocket-Protocol' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        return 204;
    }

    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Replace `'$http_origin'` with a specific domain in production.
Using `'*'` does not work with `Access-Control-Allow-Credentials`.

## Rate Limiting

```nginx
http {
    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

    server {
        location /ws {
            limit_req zone=ws_limit burst=20 nodelay;
            limit_conn ws_conn 5;
            limit_req_status 429;
            limit_conn_status 429;

            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

## Complete Production Configuration

Everything above combined into a single config:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 10240;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;

    log_format websocket '$remote_addr [$time_local] '
                        '"$request" $status '
                        'upgrade=$http_upgrade '
                        'upstream=$upstream_addr';

    access_log /var/log/nginx/access.log websocket;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

    upstream websocket_backend {
        ip_hash;
        server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
        server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
        server backend3.example.com:8080 max_fails=3 fail_timeout=30s;
        keepalive 64;
    }

    server {
        listen 443 ssl http2;
        server_name ws.example.com;

        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/private/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_stapling on;
        ssl_stapling_verify on;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;

        location /ws {
            limit_req zone=ws_limit burst=20 nodelay;
            limit_conn ws_conn 5;

            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;

            proxy_buffering off;
            proxy_request_buffering off;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        location /nginx_status {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            deny all;
        }
    }

    server {
        listen 80;
        server_name ws.example.com;
        return 301 https://$server_name$request_uri;
    }
}
```

## Troubleshooting

### Common Issues

1. **Connection immediately closes** -- Verify `Upgrade` and
   `Connection` headers are set and `proxy_http_version 1.1` is
   specified. HTTP/1.0 does not support `Upgrade`.

2. **Connection drops after 60 seconds** -- Raise
   `proxy_read_timeout`. Ensure your app sends ping/pong frames at
   a shorter interval than the timeout.

3. **502 Bad Gateway** -- Backend is unreachable. Check that the
   upstream servers are running and the port matches. Also verify
   the upstream block name in `proxy_pass` matches the `upstream`
   directive exactly.

4. **Performance degradation under load** -- Disable
   `proxy_buffering` for the WebSocket location. Raise
   `worker_connections` in the `events` block. Check
   `ulimit -n` on the Nginx host -- each WebSocket connection
   holds an open file descriptor on both the client and backend
   side.

### Monitoring Active Connections

Enable `stub_status` to track connection counts:

```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

`Active connections` in the output includes WebSocket connections.
A steady climb with no plateau means connections are leaking -- your
backend is not closing them properly.

### Testing WebSocket Connectivity

```bash
# Test the upgrade handshake with curl
curl -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
    https://ws.example.com/ws

# Or use wscat for an interactive session
npx wscat -c wss://ws.example.com/ws
```

## FAQ

### How do I configure Nginx to proxy WebSocket connections?

Add `proxy_set_header Upgrade $http_upgrade` and
`proxy_set_header Connection "upgrade"` to your location block, alongside
`proxy_pass` pointing to your backend. You also need
`proxy_http_version 1.1` because the default HTTP/1.0 does not support
the `Upgrade` mechanism. Without these three directives, Nginx strips
the upgrade headers and the WebSocket handshake fails with a 400 or
drops silently.

### Why do my WebSocket connections drop after 60 seconds?

Nginx defaults `proxy_read_timeout` to 60 seconds. If no data crosses
the connection in that window, Nginx closes it. Set
`proxy_read_timeout 3600s` (or longer) and make sure your application
sends WebSocket ping/pong frames at a shorter interval than the
timeout. Both `proxy_send_timeout` and `proxy_connect_timeout` should
also be raised for long-lived connections.

### How do I enable SSL/TLS for WebSockets behind Nginx?

Configure a standard `ssl` server block with your certificate and key,
then `proxy_pass` to your backend over plain `ws://`. Nginx handles TLS
termination so clients connect via `wss://` while your backend avoids
the overhead. Add an HTTP-to-HTTPS redirect on port 80 so clients
cannot accidentally downgrade to an unencrypted connection.

### Do I need sticky sessions for WebSocket load balancing?

Yes. WebSocket connections are stateful and long-lived, so every frame
in a session must reach the same backend. Use `ip_hash` or the `sticky`
directive (Nginx Plus) in your upstream block. Note that `ip_hash`
breaks when clients share a NAT IP. For those cases, cookie-based
stickiness (Nginx Plus) or application-level routing is more reliable.

## Related Content

- [WebSocket Protocol Guide](/guides/websocket-protocol/) - How the handshake
  and framing work under the hood
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  for handling millions of connections
- [AWS ALB WebSocket Guide](/guides/infrastructure/aws/alb/) - WebSocket
  configuration for AWS Application Load Balancer
- [Cloudflare WebSocket Guide](/guides/infrastructure/cloudflare/) - Proxying
  WebSockets through Cloudflare
- [WebSocket Security Guide](/guides/security/) - Authentication, encryption,
  and common vulnerabilities

---

_This guide is maintained by
[Matthew O'Riordan](https://twitter.com/mattyoriordan), Co-founder & CEO of
[Ably][ably-platform], the realtime data platform.
For corrections or suggestions, please
[open an issue](https://github.com/websockets/websocket.org/issues)._

[ably-platform]:
  https://ably.com?utm_source=websocket-org&utm_medium=nginx-websocket
