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
lastUpdated: 2026-03-10
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

:::note[Quick Answer] Add `proxy_set_header Upgrade $http_upgrade` and
`proxy_set_header Connection "upgrade"` to your Nginx location block to proxy
WebSocket connections. Set `proxy_read_timeout` to a high value (e.g. 3600s) to
prevent idle connection drops. :::

Nginx is one of the most popular web servers and reverse proxies for WebSocket
applications. This comprehensive guide covers production-ready configurations
for WebSocket proxying, load balancing, SSL/TLS termination, and advanced
optimizations.

## Quick Start: Basic WebSocket Proxy

The minimal configuration to proxy WebSocket connections through Nginx:

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

## Core WebSocket Configuration

### Essential Headers

WebSocket requires specific HTTP headers for the upgrade handshake:

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;

    # Required WebSocket headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Preserve original request information
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Optional: Pass through custom headers
    proxy_set_header X-Forwarded-Host $server_name;
    proxy_set_header X-Forwarded-Port $server_port;
}
```

### Connection Upgrade Map

Optimize connection handling with a map directive:

```nginx
http {
    # Connection upgrade map for better performance
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
}
```

## SSL/TLS Configuration

### Basic SSL Setup

Enable secure WebSocket connections (WSS):

```nginx
server {
    listen 443 ssl http2;
    server_name ws.example.com;

    # SSL Certificate Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /path/to/chain.pem;

    # SSL Session Optimization
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

Add security headers for enhanced protection:

```nginx
server {
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Content Security Policy for WebSocket
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss://ws.example.com" always;
}
```

## Load Balancing

### Sticky Sessions (IP Hash)

WebSocket connections often require session persistence:

```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions based on client IP

    server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend3.example.com:8080 max_fails=3 fail_timeout=30s;

    # Keepalive connections to backend
    keepalive 64;
}

server {
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Connection pooling
        proxy_set_header Connection "";
    }
}
```

### Least Connections Algorithm

Distribute load based on active connections:

```nginx
upstream websocket_backend {
    least_conn;  # Route to server with least connections

    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 weight=1;

    # Backup server
    server backup.example.com:8080 backup;
}
```

### Health Checks

Configure health checks for backend servers (requires Nginx Plus or custom
module):

```nginx
upstream websocket_backend {
    zone backend_zone 64k;

    server backend1.example.com:8080;
    server backend2.example.com:8080;

    # Nginx Plus health check
    # health_check interval=5s fails=3 passes=2 uri=/health;
}

# Alternative: Passive health checks (works with open-source Nginx)
upstream websocket_backend {
    server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
}
```

## Timeout Configuration

WebSocket connections are long-lived and require appropriate timeout settings:

```nginx
location /ws {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeout Configuration
    proxy_connect_timeout 7d;  # Connection establishment timeout
    proxy_send_timeout 7d;     # Timeout for sending data to backend
    proxy_read_timeout 7d;     # Timeout for reading response from backend

    # Optional: Send periodic ping frames (requires 3rd party module)
    # proxy_socket_keepalive on;
}

# Global keepalive settings
http {
    keepalive_timeout 65;
    keepalive_requests 100;

    # TCP keepalive (at OS level)
    # Requires tcp_nodelay and tcp_nopush
    tcp_nodelay on;
    tcp_nopush on;
}
```

## HTTP/2 Configuration

Enable HTTP/2 for better performance (WebSocket over HTTP/2 requires RFC 8441
support):

```nginx
server {
    listen 443 ssl http2;
    server_name ws.example.com;

    # HTTP/2 specific settings
    http2_max_field_size 16k;
    http2_max_header_size 32k;
    http2_max_requests 1000;

    # HTTP/2 Push (if needed for related resources)
    # http2_push /app.js;
    # http2_push /app.css;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## HTTP/3 Configuration (Experimental)

Enable experimental HTTP/3 support with QUIC:

```nginx
server {
    # HTTP/3 (QUIC) - requires Nginx with QUIC support
    listen 443 quic reuseport;
    listen 443 ssl http2;

    server_name ws.example.com;

    # Enable HTTP/3
    http3 on;

    # Add Alt-Svc header for HTTP/3 discovery
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    # QUIC specific settings
    quic_retry on;
    quic_gso on;

    # SSL configuration (required for QUIC)
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.3;  # HTTP/3 requires TLS 1.3

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Buffering and Performance

Optimize buffer settings for WebSocket traffic:

```nginx
location /ws {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Disable buffering for real-time communication
    proxy_buffering off;

    # Buffer sizes
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # Disable request/response buffering
    proxy_request_buffering off;

    # Optional: Limit request body size
    client_max_body_size 10m;

    # WebSocket frame size settings
    # large_client_header_buffers 4 32k;
}
```

## Logging and Monitoring

### Access Log Format

Create a custom log format for WebSocket connections:

```nginx
http {
    # Custom log format for WebSocket
    log_format websocket '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'upgrade=$http_upgrade connection=$connection_upgrade '
                        'upstream_addr=$upstream_addr '
                        'upstream_response_time=$upstream_response_time '
                        'request_time=$request_time';

    access_log /var/log/nginx/websocket_access.log websocket;

    # Conditional logging (skip health checks)
    map $request_uri $loggable {
        ~^/health$ 0;
        default 1;
    }

    access_log /var/log/nginx/access.log combined if=$loggable;
}
```

### Error Logging

Configure appropriate error logging levels:

```nginx
# Global error log
error_log /var/log/nginx/error.log warn;

# Debug logging for specific location
location /ws {
    error_log /var/log/nginx/websocket_error.log debug;

    proxy_pass http://websocket_backend;
    # ... WebSocket configuration
}
```

### Metrics Export

Export metrics for monitoring systems:

```nginx
# Status endpoint for monitoring
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;
}

# JSON format status (requires nginx-module-vts or similar)
location /status {
    vhost_traffic_status_display;
    vhost_traffic_status_display_format json;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

## Rate Limiting

Protect against abuse with rate limiting:

```nginx
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

    server {
        location /ws {
            # Rate limiting
            limit_req zone=ws_limit burst=20 nodelay;
            limit_conn ws_conn 5;  # Max 5 concurrent connections per IP

            # Custom error pages for rate limiting
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

## CORS Configuration

Handle Cross-Origin Resource Sharing for WebSocket:

```nginx
location /ws {
    # CORS headers
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Max-Age' 1728000 always;
        add_header 'Content-Type' 'text/plain; charset=utf-8' always;
        add_header 'Content-Length' 0 always;
        return 204;
    }

    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Complete Production Configuration

Here's a comprehensive production-ready configuration:

```nginx
# /etc/nginx/nginx.conf

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
    default_type application/octet-stream;

    # Logging
    log_format websocket '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'upgrade=$http_upgrade connection=$connection_upgrade '
                        'upstream_addr=$upstream_addr '
                        'upstream_response_time=$upstream_response_time '
                        'request_time=$request_time';

    access_log /var/log/nginx/access.log websocket;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression (not for WebSocket frames)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/x-js text/x-cross-domain-policy application/x-font-ttf application/x-font-opentype application/vnd.ms-fontobject image/x-icon;

    # Connection upgrade map
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

    # Upstream backend
    upstream websocket_backend {
        ip_hash;

        server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
        server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
        server backend3.example.com:8080 max_fails=3 fail_timeout=30s;

        keepalive 64;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        listen 443 quic reuseport;
        server_name ws.example.com;

        # SSL Configuration
        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/private/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # SSL Optimization
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;
        ssl_stapling on;
        ssl_stapling_verify on;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Alt-Svc 'h3=":443"; ma=86400' always;

        # HTTP/3 settings
        http3 on;
        quic_retry on;

        # WebSocket endpoint
        location /ws {
            # Rate limiting
            limit_req zone=ws_limit burst=20 nodelay;
            limit_conn ws_conn 5;

            # Proxy configuration
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;

            # WebSocket headers
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;

            # Disable buffering
            proxy_buffering off;
            proxy_request_buffering off;

            # Buffer sizes
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;

            # Client settings
            client_max_body_size 10m;
            client_body_buffer_size 128k;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Status endpoint
        location /nginx_status {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            deny all;
        }
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name ws.example.com;
        return 301 https://$server_name$request_uri;
    }
}
```

## Troubleshooting

### Common Issues

1. **Connection immediately closes**
   - Verify `Upgrade` and `Connection` headers are set correctly
   - Check that `proxy_http_version 1.1` is specified

2. **Connection timeouts**
   - Increase `proxy_read_timeout` and `proxy_send_timeout`
   - Check firewall rules for long-lived connections

3. **502 Bad Gateway**
   - Verify backend servers are running
   - Check backend server logs
   - Ensure correct backend port configuration

4. **Performance issues**
   - Disable proxy buffering for real-time data
   - Optimize worker connections and processes
   - Monitor system resources

### Debug Mode

Enable debug logging for troubleshooting:

```nginx
error_log /var/log/nginx/debug.log debug;

# Or for specific location
location /ws {
    error_log /var/log/nginx/ws_debug.log debug;
    # ... rest of configuration
}
```

### Testing WebSocket Connection

Test your Nginx WebSocket configuration:

```bash
# Test basic connectivity
curl -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
    https://ws.example.com/ws

# Using wscat
npm install -g wscat
wscat -c wss://ws.example.com/ws
```

## Best Practices

1. **Use SSL/TLS**: Always use WSS (WebSocket Secure) in production environments
   to protect data transmission and ensure connection integrity
2. **Implement rate limiting**: Protect against abuse and DDoS attacks by
   carefully configuring connection and request limits based on your expected
   traffic patterns
3. **Monitor connections**: Track active connections and performance metrics
   using comprehensive logging and monitoring tools to maintain optimal service
   quality
4. **Set appropriate timeouts**: Balance between connection stability and
   resource usage by configuring timeouts that accommodate your application's
   specific communication patterns
5. **Use connection pooling**: Maintain keepalive connections to backend servers
   to reduce connection overhead and improve response times
6. **Implement health checks**: Ensure backend availability through regular
   health monitoring and automatic failover mechanisms
7. **Log strategically**: Balance between debugging capability and performance
   by implementing structured logging that captures essential information
   without overwhelming your log storage systems
8. **Optimize buffer sizes**: Adjust based on your message sizes and patterns to
   minimize memory usage while ensuring efficient data transmission
9. **Plan for scaling**: Use load balancing and session persistence
   appropriately, considering both horizontal scaling requirements and the
   stateful nature of WebSocket connections
10. **Regular updates**: Keep Nginx and SSL certificates up to date to maintain
    security standards and benefit from performance improvements and bug fixes

## Additional Resources

- [Nginx Official Documentation](http://nginx.org/en/docs/)
- [Nginx WebSocket Module](http://nginx.org/en/docs/http/websocket.html)
- [RFC 6455 - The WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [RFC 8441 - Bootstrapping WebSockets with HTTP/2](https://tools.ietf.org/html/rfc8441)

## FAQ

### How do I configure Nginx to proxy WebSocket connections?

Add `proxy_set_header Upgrade $http_upgrade` and
`proxy_set_header Connection "upgrade"` to your location block, alongside
`proxy_pass` pointing to your backend. These headers tell Nginx to pass the HTTP
Upgrade handshake through to the upstream server.

### Why do my WebSocket connections drop after 60 seconds?

Nginx defaults `proxy_read_timeout` to 60 seconds. Idle WebSocket connections
with no traffic will be closed. Increase it with `proxy_read_timeout 3600s` and
ensure your application sends ping/pong frames to keep the connection alive.

### How do I enable SSL/TLS for WebSockets behind Nginx?

Configure a standard `ssl` server block with your certificate and key, then
`proxy_pass` to your backend over plain `ws://`. Nginx handles TLS termination
so clients connect via `wss://` while your backend avoids the TLS overhead.

### Do I need sticky sessions for WebSocket load balancing?

Yes. WebSocket connections are stateful and long-lived, so all frames for a
session must reach the same backend. Use `ip_hash` or the `sticky` directive
(Nginx Plus) in your upstream block to ensure session affinity.

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
[Ably](https://ably.com), the real-time data platform. For corrections or
suggestions, please
[open an issue](https://github.com/websockets/websocket.org/issues)._
