---
title: 'Cloudflare WebSockets: CDN, Workers & Durable Objects'
description:
  'How to proxy WebSocket connections through Cloudflare CDN, build edge
  WebSocket handlers with Workers, and manage stateful connections with Durable
  Objects.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
publishedDate: 2025-09-01T00:00:00.000Z
updatedDate: 2025-09-01T00:00:00.000Z
lastUpdated: 2026-03-10
category: infrastructure
tags:
  - cloudflare
  - websocket
  - cdn
  - workers
  - durable-objects
seo:
  keywords:
    - cloudflare websocket
    - cloudflare workers websocket
    - durable objects websocket
    - cloudflare websocket proxy
    - cloudflare websocket support
    - websocket ddos protection
    - cloudflare edge websocket
date: '2024-09-02'
faq:
  - q: 'Does Cloudflare support WebSocket connections?'
    a:
      'Yes. Cloudflare proxies WebSocket connections on all plans, including
      Free. Enable the orange cloud (proxy) for your DNS record and WebSocket
      traffic passes through automatically with DDoS protection. No special
      configuration is needed for basic proxying.'
  - q: 'How do Cloudflare Workers handle WebSockets?'
    a:
      'Workers can accept WebSocket upgrade requests at the edge using the
      WebSocket API. A Worker calls new WebSocketPair() to create a
      server/client pair, processes messages in the fetch handler, and responds
      with HTTP 101. For persistent state, pair Workers with Durable Objects.'
  - q: 'What are Durable Objects and why use them for WebSockets?'
    a:
      'Durable Objects provide single-threaded, stateful JavaScript execution at
      the edge. Each object has a unique ID, persistent storage, and guaranteed
      single-instance execution. This makes them ideal for WebSocket use cases
      like chat rooms or collaborative editing where state must be consistent.'
  - q: 'What are the Cloudflare WebSocket connection limits?'
    a:
      'Free and Pro plans allow WebSocket connections with a 100-second idle
      timeout. Business and Enterprise plans have higher limits and configurable
      timeouts. Cloudflare does not charge per WebSocket connection, only per
      Worker invocation if you use Workers.'
---

:::note[Quick Answer] Cloudflare supports WebSocket proxying on all plans,
including Free. Just enable the proxy (orange cloud) on your DNS record. For
edge WebSocket logic, use Workers. For stateful connections (chat,
collaboration), use Durable Objects. :::

Cloudflare provides multiple ways to handle WebSocket connections: through their
CDN proxy service, Workers for edge computing, and Durable Objects for stateful
WebSocket applications. This guide covers all three approaches with production
configurations.

## Quick Start: CDN Proxy Setup

Cloudflare's CDN automatically supports WebSocket connections when proxied
(orange cloud enabled):

```javascript
// DNS Configuration (via Cloudflare Dashboard or API)
{
  "type": "A",
  "name": "ws.example.com",
  "content": "192.0.2.1",  // Your origin server IP
  "proxied": true,          // Orange cloud - enables CDN + WebSocket
  "ttl": 1                  // Auto (when proxied)
}
```

## CDN Proxy Configuration

### WebSocket Support Requirements

Cloudflare CDN proxy supports WebSocket with these characteristics:

- **Automatic detection**: Recognizes `Upgrade: websocket` headers
- **Timeout limit**: 100 seconds of inactivity (non-configurable)
- **No message inspection**: Passes frames transparently
- **Global anycast network**: Routes to nearest data center
- **DDoS protection**: Automatic mitigation included

### Page Rules for WebSocket

Configure specific behaviors for WebSocket endpoints:

```javascript
// Via Cloudflare API
const pageRule = {
  targets: [
    {
      target: 'url',
      constraint: {
        operator: 'matches',
        value: 'ws.example.com/socket/*',
      },
    },
  ],
  actions: [
    { id: 'cache_level', value: 'bypass' },
    { id: 'disable_apps', value: 'on' },
    { id: 'disable_performance', value: 'on' },
    { id: 'ssl', value: 'full' },
  ],
  priority: 1,
  status: 'active',
};
```

### SSL/TLS Configuration

Configure SSL mode for WebSocket connections:

```yaml
# Recommended SSL settings
SSL/TLS Mode: Full (strict) # Validates origin certificate
Edge Certificates: Enabled # Free Universal SSL
Always Use HTTPS: Enabled # Force WSS connections
Minimum TLS Version: 1.2 # Security baseline
```

### Firewall Rules

Create firewall rules for WebSocket protection:

```javascript
// Firewall rule expression
(http.request.uri.path contains "/ws" and http.request.headers["upgrade"][0] eq "websocket")
and not ip.src in {192.0.2.0/24}  // Whitelist IPs
and (
  cf.threat_score > 30 or          // Block high threat scores
  not cf.bot_management.verified   // Block unverified bots
)
// Action: Block
```

### Rate Limiting Rules

Protect WebSocket endpoints from abuse:

```javascript
// Rate limiting configuration
{
  "description": "WebSocket connection rate limit",
  "match": {
    "request": {
      "url_pattern": "*/ws*",
      "methods": ["GET"],
      "headers": {
        "Upgrade": "websocket"
      }
    }
  },
  "threshold": 10,           // 10 requests
  "period": 60,             // per minute
  "action": {
    "mode": "challenge",    // or "block", "log"
    "timeout": 3600        // 1 hour
  }
}
```

## Cloudflare Workers WebSocket

### Basic Worker WebSocket Handler

```javascript
// worker.js
export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');

    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // Create WebSocket pair
    const [client, server] = Object.values(new WebSocketPair());

    // Handle the WebSocket on the server side
    server.accept();

    server.addEventListener('message', (event) => {
      // Echo messages back
      server.send(`Echo: ${event.data}`);
    });

    server.addEventListener('close', () => {
      console.log('WebSocket closed');
    });

    // Return WebSocket response
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
```

### Worker with Origin Passthrough

Connect to backend WebSocket server:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Check if it's a WebSocket request
    if (request.headers.get('Upgrade') === 'websocket') {
      // Change to backend WebSocket URL
      url.hostname = 'backend.example.com';
      url.protocol = 'wss:';

      // Create a new request with modified URL
      const modifiedRequest = new Request(url, request);

      // Add custom headers
      modifiedRequest.headers.set(
        'X-Forwarded-For',
        request.headers.get('CF-Connecting-IP')
      );
      modifiedRequest.headers.set(
        'X-Real-IP',
        request.headers.get('CF-Connecting-IP')
      );

      // Pass through to origin
      return fetch(modifiedRequest);
    }

    // Handle non-WebSocket requests
    return new Response('WebSocket endpoint only', { status: 400 });
  },
};
```

### Worker with Authentication

Implement JWT authentication:

```javascript
import jwt from '@tsndr/cloudflare-worker-jwt';

export default {
  async fetch(request, env, ctx) {
    // Extract token from query string or header
    const url = new URL(request.url);
    const token =
      url.searchParams.get('token') ||
      request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      // Verify JWT token
      const isValid = await jwt.verify(token, env.JWT_SECRET);

      if (!isValid) {
        return new Response('Invalid token', { status: 401 });
      }

      // Decode token to get user info
      const payload = jwt.decode(token);

      // Create WebSocket connection
      const [client, server] = Object.values(new WebSocketPair());

      // Attach user context
      const wsHandler = new WebSocketHandler(server, payload.userId);

      // Return authenticated WebSocket
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      return new Response('Authentication failed', { status: 401 });
    }
  },
};

class WebSocketHandler {
  constructor(websocket, userId) {
    this.websocket = websocket;
    this.userId = userId;
    this.websocket.accept();

    this.websocket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
  }

  handleMessage(message) {
    // Process authenticated messages
    console.log(`User ${this.userId}: ${message}`);
    this.websocket.send(`Authenticated echo: ${message}`);
  }
}
```

## Durable Objects for Stateful WebSocket

### Room-Based Chat Implementation

```javascript
// durable-object.js
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.messages = [];
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      // Create WebSocket pair
      const [client, server] = Object.values(new WebSocketPair());

      // Accept WebSocket
      server.accept();

      // Create session
      const session = {
        websocket: server,
        id: crypto.randomUUID(),
        joined: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP'),
      };

      // Add to sessions
      this.sessions.push(session);

      // Set up event handlers
      server.addEventListener('message', async (event) => {
        await this.handleMessage(session, event.data);
      });

      server.addEventListener('close', () => {
        this.handleClose(session);
      });

      // Send existing messages
      for (const msg of this.messages.slice(-50)) {
        server.send(JSON.stringify(msg));
      }

      // Broadcast join message
      this.broadcast(
        {
          type: 'user_joined',
          userId: session.id,
          timestamp: session.joined,
        },
        session
      );

      return new Response(null, { status: 101, webSocket: client });
    }

    // Return room statistics
    return new Response(
      JSON.stringify({
        sessions: this.sessions.length,
        messages: this.messages.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  async handleMessage(session, message) {
    try {
      const data = JSON.parse(message);

      // Store message
      const msg = {
        id: crypto.randomUUID(),
        userId: session.id,
        content: data.content,
        timestamp: new Date().toISOString(),
      };

      this.messages.push(msg);

      // Persist to storage (optional)
      await this.state.storage.put(`message:${msg.id}`, msg);

      // Broadcast to all sessions
      this.broadcast(msg);
    } catch (error) {
      session.websocket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
    }
  }

  handleClose(session) {
    // Remove from sessions
    this.sessions = this.sessions.filter((s) => s.id !== session.id);

    // Broadcast leave message
    this.broadcast({
      type: 'user_left',
      userId: session.id,
      timestamp: new Date().toISOString(),
    });
  }

  broadcast(message, exclude = null) {
    const data = JSON.stringify(message);

    for (const session of this.sessions) {
      if (session !== exclude) {
        try {
          session.websocket.send(data);
        } catch (error) {
          // Handle send errors
          console.error(`Failed to send to ${session.id}:`, error);
        }
      }
    }
  }
}

// worker.js - Routes requests to Durable Objects
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomName = url.pathname.slice(1) || 'default';

    // Get Durable Object instance
    const roomId = env.CHAT_ROOMS.idFromName(roomName);
    const room = env.CHAT_ROOMS.get(roomId);

    // Forward request to Durable Object
    return room.fetch(request);
  },
};
```

### Durable Object with Hibernation

Optimize costs with WebSocket hibernation:

```javascript
export class HibernatingChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Enable WebSocket hibernation
    this.state.getWebSockets().forEach((ws) => {
      this.handleWebSocket(ws);
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());

      // Accept and tag the WebSocket
      this.state.acceptWebSocket(server, {
        userId: crypto.randomUUID(),
        joined: Date.now(),
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('WebSocket only', { status: 400 });
  }

  async webSocketMessage(ws, message) {
    // Called when hibernated WebSocket receives message
    const metadata = ws.deserializeAttachment();

    // Process message
    const data = JSON.parse(message);
    const response = {
      type: 'message',
      userId: metadata.userId,
      content: data.content,
      timestamp: Date.now(),
    };

    // Broadcast to all connected WebSockets
    this.state.getWebSockets().forEach((websocket) => {
      websocket.send(JSON.stringify(response));
    });
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // Called when hibernated WebSocket closes
    const metadata = ws.deserializeAttachment();

    // Notify others
    this.state.getWebSockets().forEach((websocket) => {
      if (websocket !== ws) {
        websocket.send(
          JSON.stringify({
            type: 'user_left',
            userId: metadata.userId,
          })
        );
      }
    });
  }

  handleWebSocket(ws) {
    // Set up handlers for existing WebSockets after wakeup
    const metadata = ws.deserializeAttachment();
    console.log(`Restored WebSocket for user ${metadata.userId}`);
  }
}
```

### State Management and Persistence

```javascript
export class PersistentRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('roomData');
      this.roomData = stored || {
        messages: [],
        users: {},
        created: Date.now(),
      };
    });
  }

  async saveState() {
    // Persist state to storage
    await this.state.storage.put('roomData', this.roomData);
  }

  async fetch(request) {
    // Set up alarm for periodic saves
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + 60000); // Every minute
    }

    // Handle WebSocket connections...
  }

  async alarm() {
    // Called by alarm trigger
    await this.saveState();

    // Clean up old messages
    const oneHourAgo = Date.now() - 3600000;
    this.roomData.messages = this.roomData.messages.filter(
      (msg) => msg.timestamp > oneHourAgo
    );

    // Set next alarm
    await this.state.storage.setAlarm(Date.now() + 60000);
  }
}
```

## Performance Optimization

### Message Batching

Reduce operations by batching messages:

```javascript
class BatchingWebSocket {
  constructor(ws) {
    this.ws = ws;
    this.queue = [];
    this.batchTimer = null;
    this.batchSize = 10;
    this.batchDelay = 100; // ms
  }

  send(message) {
    this.queue.push(message);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  flush() {
    if (this.queue.length === 0) return;

    const batch = {
      type: 'batch',
      messages: this.queue.splice(0, this.batchSize),
    };

    this.ws.send(JSON.stringify(batch));

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Continue if more messages
    if (this.queue.length > 0) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }
}
```

### Connection Pooling

Manage connection limits efficiently:

```javascript
class ConnectionPool {
  constructor(maxConnections = 100) {
    this.connections = new Map();
    this.maxConnections = maxConnections;
    this.waitQueue = [];
  }

  async addConnection(ws, metadata) {
    // Check capacity
    if (this.connections.size >= this.maxConnections) {
      // Queue or reject
      if (this.waitQueue.length < 10) {
        return new Promise((resolve, reject) => {
          this.waitQueue.push({ ws, metadata, resolve, reject });

          // Timeout after 5 seconds
          setTimeout(() => {
            const index = this.waitQueue.findIndex((item) => item.ws === ws);
            if (index !== -1) {
              this.waitQueue.splice(index, 1);
              reject(new Error('Connection timeout'));
            }
          }, 5000);
        });
      } else {
        throw new Error('Connection pool full');
      }
    }

    // Add connection
    this.connections.set(ws, {
      ...metadata,
      connected: Date.now(),
    });

    return true;
  }

  removeConnection(ws) {
    this.connections.delete(ws);

    // Process wait queue
    if (this.waitQueue.length > 0) {
      const { ws: queuedWs, metadata, resolve } = this.waitQueue.shift();
      this.addConnection(queuedWs, metadata).then(resolve);
    }
  }
}
```

## Limitations and Workarounds

### Cloudflare CDN Limitations

| Limitation              | Value                              | Workaround                 |
| ----------------------- | ---------------------------------- | -------------------------- |
| Idle timeout            | 100 seconds                        | Implement heartbeat/ping   |
| Message size            | No limit (but counted for billing) | Chunk large messages       |
| Connections per IP      | No hard limit                      | Rate limiting recommended  |
| Geographic restrictions | Available globally                 | Use Workers for edge logic |

### Worker Limitations

| Resource              | Limit           | Workaround                                |
| --------------------- | --------------- | ----------------------------------------- |
| CPU time              | 10-50ms         | Use Durable Objects for longer processing |
| Memory                | 128MB           | Stream large data                         |
| WebSocket connections | 1000 per Worker | Use multiple Workers                      |
| Subrequests           | 50 per request  | Batch operations                          |

### Durable Object Limitations

| Resource              | Limit         | Notes                       |
| --------------------- | ------------- | --------------------------- |
| Memory                | 128MB         | Per Durable Object instance |
| CPU time              | 30 seconds    | Per request                 |
| WebSocket connections | No hard limit | Memory constrained          |
| Storage               | 1GB           | Per Durable Object          |
| Storage operations    | 1000/sec      | Use batching                |

## Monitoring and Analytics

### Workers Analytics

```javascript
// Track WebSocket metrics
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    // Track connection attempt
    await env.METRICS.increment('websocket.connections.attempted');

    try {
      if (request.headers.get('Upgrade') === 'websocket') {
        const [client, server] = Object.values(new WebSocketPair());

        // Track successful connection
        await env.METRICS.increment('websocket.connections.established');

        server.accept();

        server.addEventListener('message', async (event) => {
          // Track messages
          await env.METRICS.increment('websocket.messages.received');
          await env.METRICS.increment(
            'websocket.bytes.received',
            event.data.length
          );
        });

        server.addEventListener('close', async () => {
          // Track disconnection
          await env.METRICS.increment('websocket.connections.closed');

          // Track connection duration
          const duration = Date.now() - startTime;
          await env.METRICS.recordTime(
            'websocket.connection.duration',
            duration
          );
        });

        return new Response(null, { status: 101, webSocket: client });
      }
    } catch (error) {
      await env.METRICS.increment('websocket.connections.failed');
      throw error;
    }
  },
};
```

### Custom Analytics Dashboard

```javascript
// Analytics endpoint
export async function handleAnalytics(request, env) {
  const stats = await env.METRICS.getStats();

  return new Response(
    JSON.stringify({
      connections: {
        attempted: stats['websocket.connections.attempted'] || 0,
        established: stats['websocket.connections.established'] || 0,
        failed: stats['websocket.connections.failed'] || 0,
        active: stats['websocket.connections.active'] || 0,
      },
      messages: {
        sent: stats['websocket.messages.sent'] || 0,
        received: stats['websocket.messages.received'] || 0,
        errors: stats['websocket.messages.errors'] || 0,
      },
      bandwidth: {
        sent: stats['websocket.bytes.sent'] || 0,
        received: stats['websocket.bytes.received'] || 0,
      },
      performance: {
        avgConnectionDuration: stats['websocket.connection.duration.avg'] || 0,
        avgMessageLatency: stats['websocket.message.latency.avg'] || 0,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

## Cost Optimization

### Understanding Cloudflare Pricing

Workers pricing components:

- **Requests**: $0.50 per million requests
- **CPU time**: $0.02 per million CPU milliseconds
- **Durable Objects**: $0.15 per million requests + storage

### Cost Calculation Example

```javascript
function calculateMonthlyCost(metrics) {
  const pricing = {
    requests: 0.5 / 1_000_000,
    cpuMs: 0.02 / 1_000_000,
    durableObjectRequests: 0.15 / 1_000_000,
    durableObjectStorage: 0.2, // per GB-month
    bandwidth: 0.09, // per GB after 10TB
  };

  const costs = {
    workers: metrics.requests * pricing.requests,
    cpu: metrics.cpuMs * pricing.cpuMs,
    durableObjects: metrics.doRequests * pricing.durableObjectRequests,
    storage: metrics.storageGB * pricing.durableObjectStorage,
    bandwidth: Math.max(0, metrics.bandwidthGB - 10000) * pricing.bandwidth,
  };

  costs.total = Object.values(costs).reduce((a, b) => a + b, 0);

  return costs;
}

// Example: Chat application with 10,000 daily active users
const monthlyCost = calculateMonthlyCost({
  requests: 10_000 * 100 * 30, // 100 requests per user per day
  cpuMs: 10_000 * 1000 * 30, // 1 second CPU per user per day
  doRequests: 10_000 * 50 * 30, // 50 DO requests per user per day
  storageGB: 10, // 10GB stored messages
  bandwidthGB: 100, // 100GB monthly bandwidth
});

console.log(`Monthly cost: $${monthlyCost.total.toFixed(2)}`);
```

### Optimization Strategies

1. **Use hibernation**: Reduce Durable Object costs
2. **Implement caching**: Minimize origin requests
3. **Batch operations**: Reduce request count
4. **Compress messages**: Lower bandwidth usage
5. **Regional routing**: Use closest data centers

## Security Best Practices

### DDoS Protection

```javascript
// Rate limiting with Durable Objects
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.connections = new Map();
  }

  async fetch(request) {
    const ip = request.headers.get('CF-Connecting-IP');
    const now = Date.now();

    // Get connection history
    const history = this.connections.get(ip) || [];

    // Remove old entries
    const recentHistory = history.filter((time) => now - time < 60000);

    // Check rate limit
    if (recentHistory.length >= 10) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Add new connection
    recentHistory.push(now);
    this.connections.set(ip, recentHistory);

    // Allow connection
    return new Response('OK', { status: 200 });
  }
}
```

### Origin Validation

```javascript
// Validate WebSocket origin
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];

    if (!allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Process WebSocket connection...
  },
};
```

## Testing WebSocket Connections

### Testing Cloudflare Workers

```javascript
// test.js
import { unstable_dev } from 'wrangler';

describe('WebSocket Worker', () => {
  let worker;

  beforeAll(async () => {
    worker = await unstable_dev('src/worker.js', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should upgrade to WebSocket', async () => {
    const response = await worker.fetch('https://example.com', {
      headers: {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
      },
    });

    expect(response.status).toBe(101);
    expect(response.webSocket).toBeDefined();
  });
});
```

### Load Testing

```bash
# Using wscat for basic testing
wscat -c wss://ws.example.com/socket

# Using artillery for load testing
npm install -g artillery
artillery quick --count 100 --num 10 wss://ws.example.com/socket
```

## Troubleshooting

### Common Issues

1. **100-second timeout disconnections**
   - Implement heartbeat mechanism
   - Send ping every 30-60 seconds

2. **Connection refused errors**
   - Verify DNS proxy status (orange cloud)
   - Check firewall rules
   - Validate SSL configuration

3. **High latency**
   - Use Argo Smart Routing
   - Implement regional failover
   - Optimize message size

4. **Durable Object limits**
   - Implement connection pooling
   - Use hibernation API
   - Shard across multiple objects

## Best Practices

1. **Always use WSS**: Cloudflare enforces HTTPS/WSS for proxied connections
2. **Implement heartbeat**: Prevent 100-second timeout disconnections
3. **Handle reconnection**: Build robust reconnection logic client-side
4. **Monitor metrics**: Track connections, errors, and performance
5. **Use Durable Objects wisely**: Stateful applications benefit most
6. **Implement rate limiting**: Protect against abuse
7. **Validate origins**: Prevent CSRF attacks
8. **Optimize for edge**: Minimize subrequests and CPU usage
9. **Plan for scale**: Design with Cloudflare's limits in mind
10. **Test globally**: Verify performance across regions

## Additional Resources

- [Cloudflare WebSocket Documentation](https://developers.cloudflare.com/workers/learning/using-websockets/)
- [Durable Objects Documentation](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Network Map](https://www.cloudflare.com/network/)

## FAQ

### Does Cloudflare support WebSocket connections?

Yes. Cloudflare proxies WebSocket connections on all plans, including Free.
Enable the orange cloud (proxy) for your DNS record and WebSocket traffic passes
through automatically with DDoS protection. No special configuration is needed
for basic proxying.

### How do Cloudflare Workers handle WebSockets?

Workers can accept WebSocket upgrade requests at the edge using the WebSocket
API. A Worker calls `new WebSocketPair()` to create a server/client pair,
processes messages in the fetch handler, and responds with HTTP 101. For
persistent state, pair Workers with Durable Objects.

### What are Durable Objects and why use them for WebSockets?

Durable Objects provide single-threaded, stateful JavaScript execution at the
edge. Each object has a unique ID, persistent storage, and guaranteed
single-instance execution. This makes them ideal for WebSocket use cases like
chat rooms or collaborative editing where state must be consistent.

### What are the Cloudflare WebSocket connection limits?

Free and Pro plans allow WebSocket connections with a 100-second idle timeout.
Business and Enterprise plans have higher limits and configurable timeouts.
Cloudflare does not charge per WebSocket connection, only per Worker invocation
if you use Workers.

## Related Content

- [Nginx WebSocket Proxy Guide](/guides/infrastructure/nginx/) - Configure Nginx
  as a WebSocket reverse proxy
- [AWS ALB WebSocket Guide](/guides/infrastructure/aws/alb/) - WebSocket
  configuration for AWS load balancers
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  for millions of connections
- [WebSocket Security Guide](/guides/security/) - Authentication, encryption,
  and common vulnerabilities
- [Kubernetes WebSocket Guide](/guides/infrastructure/kubernetes/) - Running
  WebSocket servers in Kubernetes

---

_This guide is maintained by
[Matthew O'Riordan](https://twitter.com/mattyoriordan), Co-founder & CEO of
[Ably](https://ably.com), the real-time data platform. For corrections or
suggestions, please
[open an issue](https://github.com/websockets/websocket.org/issues)._
