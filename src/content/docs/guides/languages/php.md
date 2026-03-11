---
title: 'PHP WebSocket: Ratchet, Swoole & ReactPHP Guide'
description:
  'Build PHP WebSocket servers with Ratchet, Swoole, and ReactPHP. Covers event
  loops, persistent connections, chat apps, and production deployment with
  Supervisor and Docker.'
sidebar:
  order: 7
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - php websocket
  - ratchet websocket
  - swoole websocket
  - reactphp websocket
seo:
  keywords:
    - php websocket
    - ratchet websocket
    - swoole websocket
    - reactphp websocket
    - php websocket server
    - php real-time
faq:
  - q: 'How do I create a WebSocket server in PHP?'
    a:
      'Use Ratchet, the most popular PHP WebSocket library. Install via
      Composer, create a class implementing MessageComponentInterface, and run
      it with ReactPHP event loop. Swoole is another option offering higher
      performance through a C extension.'
  - q: 'Can PHP handle WebSocket connections?'
    a:
      'Yes. While PHP traditional request-response model does not natively
      support persistent connections, libraries like Ratchet (built on ReactPHP)
      and Swoole run PHP as a long-lived process with an event loop, enabling
      WebSocket support.'
  - q: 'Which PHP WebSocket library should I use?'
    a:
      'Use Ratchet for most projects - it is well-documented and built on
      ReactPHP. Use Swoole for high-performance needs (it is a C extension). Use
      Laravel WebSockets or Laravel Reverb if you are already in the Laravel
      ecosystem.'
---

:::note[Quick Answer]
Use **Ratchet** (built on ReactPHP) for most PHP WebSocket
projects. Use **Swoole** for high-performance needs. PHP's traditional
request-response model requires an event loop library to support persistent
WebSocket connections.
:::

## Introduction to WebSockets in PHP

PHP's evolution from a server-side scripting language to a capable platform for
real-time applications has made it a viable choice for WebSocket development.
While PHP's traditional request-response model doesn't naturally align with
WebSocket's persistent connections, modern PHP with libraries like Ratchet,
ReactPHP, and Swoole has overcome these limitations, enabling developers to
build scalable real-time applications.

The transformation of PHP's capabilities in the real-time space represents one
of the most significant evolutions in the language's history. Traditionally,
PHP's architecture was designed around the concept of script execution
lifecycles that begin with a request and end with a response, making memory
management and resource cleanup automatic but also limiting the language's
ability to maintain state between requests. The introduction of event loops,
async programming patterns, and long-running processes has fundamentally changed
this paradigm, allowing PHP to compete with languages specifically designed for
concurrent, persistent connections.

This evolution has been particularly important for organizations heavily
invested in PHP infrastructure. Rather than requiring a complete technology
stack change to implement real-time features, developers can now extend their
existing PHP applications with WebSocket capabilities, sharing business logic,
database connections, and authentication systems between traditional web
endpoints and real-time communication channels.

The PHP WebSocket ecosystem has matured significantly, offering both pure PHP
implementations and high-performance extensions. Whether you're adding real-time
features to an existing PHP application or building a dedicated WebSocket
server, PHP provides the tools necessary for production-ready implementations.
The ecosystem now includes solutions ranging from pure PHP libraries that
prioritize ease of integration to high-performance extensions that can rival
compiled languages in throughput and latency characteristics.

## Why Choose PHP for WebSockets

PHP's ubiquity in web development makes it an attractive choice for teams
already invested in the PHP ecosystem. The ability to share code between your
web application and WebSocket server, use the same business logic, and maintain
a consistent technology stack reduces complexity and development time.

The strategic advantage of using PHP for WebSocket development becomes
particularly apparent in organizations where PHP powers the primary web
application. Shared authentication systems, database models, business logic
layers, and validation rules can be seamlessly integrated into WebSocket
servers, ensuring consistency between real-time and traditional web features.
This code reuse significantly reduces the development overhead compared to
introducing an entirely separate technology stack for real-time functionality.

Additionally, PHP's extensive ecosystem of packages and frameworks provides
immediate access to mature libraries for common tasks like database interaction,
caching, logging, and third-party API integration. This ecosystem advantage
means that WebSocket applications can leverage existing, well-tested solutions
rather than reimplementing common functionality or dealing with the relative
immaturity of libraries in newer programming languages.

Modern PHP (7.4+) offers significant performance improvements, making it
suitable for handling thousands of concurrent WebSocket connections. The
introduction of async capabilities through libraries like ReactPHP and native
extensions like Swoole has transformed PHP into a capable platform for
event-driven, non-blocking I/O operations essential for WebSocket servers.

The performance characteristics of modern PHP, particularly when combined with
extensions like Swoole, can be surprising to developers familiar only with
traditional PHP request-response patterns. Swoole's coroutine-based architecture
allows a single PHP process to handle thousands of concurrent connections
efficiently, with performance profiles that compete favorably with Node.js and
other event-driven platforms. This performance leap has opened up use cases that
were previously impractical for PHP applications.

## Setting Up Your PHP WebSocket Project

Start by setting up a modern PHP environment with Composer for dependency
management. PHP's ecosystem provides multiple WebSocket implementations, each
with different strengths.

The choice of WebSocket implementation in PHP depends largely on your
performance requirements, existing infrastructure, and development team
expertise. Ratchet provides the most accessible entry point for developers
familiar with traditional PHP development patterns, offering a pure PHP solution
that requires no special server extensions or configuration changes. ReactPHP
builds on this foundation with a more comprehensive async ecosystem, while
Swoole offers maximum performance at the cost of requiring a specific server
extension.

```bash
# Create project directory
mkdir php-websocket-app
cd php-websocket-app

# Initialize Composer
composer init

# Install Ratchet and ReactPHP
composer require cboden/ratchet react/event-loop react/socket
```

## Building a WebSocket Server with Ratchet

Ratchet is the most popular PHP WebSocket library, built on top of ReactPHP.
Here's a comprehensive server implementation demonstrating connection
management, message routing, and room-based communication.

The Ratchet implementation shown below illustrates several important concepts in
PHP WebSocket development. The use of SplObjectStorage for client management
provides an efficient way to track connections while maintaining weak references
that won't prevent garbage collection. The room-based messaging system
demonstrates how to implement complex routing logic while maintaining clean
separation of concerns, making the code maintainable even as features grow.

```php
<?php
namespace App;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

class WebSocketServer implements MessageComponentInterface {
    protected $clients;
    protected $rooms;
    protected $clientInfo;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->rooms = [];
        $this->clientInfo = [];
        echo "WebSocket Server started\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        // Store the new connection
        $this->clients->attach($conn);

        // Generate unique client ID
        $clientId = uniqid('client_', true);
        $this->clientInfo[$conn->resourceId] = [
            'id' => $clientId,
            'connection' => $conn,
            'rooms' => [],
            'metadata' => []
        ];

        // Send welcome message
        $conn->send(json_encode([
            'type' => 'welcome',
            'client_id' => $clientId,
            'timestamp' => time()
        ]));

        echo "New connection: {$clientId} ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        try {
            $data = json_decode($msg, true);

            if (!$data || !isset($data['type'])) {
                $this->sendError($from, 'Invalid message format');
                return;
            }

            $this->handleMessage($from, $data);

        } catch (\Exception $e) {
            $this->sendError($from, 'Error processing message: ' . $e->getMessage());
            echo "Error: {$e->getMessage()}\n";
        }
    }

    protected function handleMessage(ConnectionInterface $from, array $data) {
        $clientInfo = $this->clientInfo[$from->resourceId];

        switch ($data['type']) {
            case 'broadcast':
                $this->broadcastMessage($from, $data['message'] ?? '');
                break;

            case 'join_room':
                $this->joinRoom($from, $data['room'] ?? '');
                break;

            case 'leave_room':
                $this->leaveRoom($from, $data['room'] ?? '');
                break;

            case 'room_message':
                $this->sendToRoom($from, $data['room'] ?? '', $data['message'] ?? '');
                break;

            case 'private_message':
                $this->sendPrivateMessage($from, $data['to'] ?? '', $data['message'] ?? '');
                break;

            case 'set_metadata':
                $this->setClientMetadata($from, $data['metadata'] ?? []);
                break;

            default:
                $this->sendError($from, 'Unknown message type: ' . $data['type']);
        }
    }

    protected function broadcastMessage(ConnectionInterface $from, string $message) {
        $clientInfo = $this->clientInfo[$from->resourceId];
        $payload = json_encode([
            'type' => 'broadcast',
            'from' => $clientInfo['id'],
            'message' => $message,
            'timestamp' => time()
        ]);

        foreach ($this->clients as $client) {
            if ($from !== $client) {
                $client->send($payload);
            }
        }

        echo "Broadcast from {$clientInfo['id']}: {$message}\n";
    }

    protected function joinRoom(ConnectionInterface $conn, string $room) {
        if (empty($room)) {
            $this->sendError($conn, 'Room name required');
            return;
        }

        $clientInfo = &$this->clientInfo[$conn->resourceId];

        // Create room if it doesn't exist
        if (!isset($this->rooms[$room])) {
            $this->rooms[$room] = [];
        }

        // Add client to room
        if (!in_array($conn->resourceId, $this->rooms[$room])) {
            $this->rooms[$room][] = $conn->resourceId;
            $clientInfo['rooms'][] = $room;

            // Notify client
            $conn->send(json_encode([
                'type' => 'room_joined',
                'room' => $room,
                'members' => count($this->rooms[$room])
            ]));

            // Notify room members
            $this->notifyRoom($room, [
                'type' => 'member_joined',
                'room' => $room,
                'client_id' => $clientInfo['id'],
                'total_members' => count($this->rooms[$room])
            ], $conn);

            echo "Client {$clientInfo['id']} joined room: {$room}\n";
        }
    }

    protected function leaveRoom(ConnectionInterface $conn, string $room) {
        $clientInfo = &$this->clientInfo[$conn->resourceId];

        if (isset($this->rooms[$room])) {
            $key = array_search($conn->resourceId, $this->rooms[$room]);
            if ($key !== false) {
                unset($this->rooms[$room][$key]);
                $this->rooms[$room] = array_values($this->rooms[$room]);

                // Remove room from client's room list
                $roomKey = array_search($room, $clientInfo['rooms']);
                if ($roomKey !== false) {
                    unset($clientInfo['rooms'][$roomKey]);
                    $clientInfo['rooms'] = array_values($clientInfo['rooms']);
                }

                // Clean up empty rooms
                if (empty($this->rooms[$room])) {
                    unset($this->rooms[$room]);
                }

                // Notify room members
                if (isset($this->rooms[$room])) {
                    $this->notifyRoom($room, [
                        'type' => 'member_left',
                        'room' => $room,
                        'client_id' => $clientInfo['id'],
                        'total_members' => count($this->rooms[$room])
                    ]);
                }

                echo "Client {$clientInfo['id']} left room: {$room}\n";
            }
        }
    }

    protected function sendToRoom(ConnectionInterface $from, string $room, string $message) {
        if (!isset($this->rooms[$room])) {
            $this->sendError($from, 'Room does not exist');
            return;
        }

        $clientInfo = $this->clientInfo[$from->resourceId];

        if (!in_array($from->resourceId, $this->rooms[$room])) {
            $this->sendError($from, 'You are not in this room');
            return;
        }

        $payload = json_encode([
            'type' => 'room_message',
            'room' => $room,
            'from' => $clientInfo['id'],
            'message' => $message,
            'timestamp' => time()
        ]);

        foreach ($this->rooms[$room] as $resourceId) {
            if ($resourceId !== $from->resourceId && isset($this->clientInfo[$resourceId])) {
                $this->clientInfo[$resourceId]['connection']->send($payload);
            }
        }

        echo "Room message in {$room} from {$clientInfo['id']}\n";
    }

    protected function sendPrivateMessage(ConnectionInterface $from, string $toClientId, string $message) {
        $fromInfo = $this->clientInfo[$from->resourceId];
        $toConn = null;

        // Find recipient connection
        foreach ($this->clientInfo as $info) {
            if ($info['id'] === $toClientId) {
                $toConn = $info['connection'];
                break;
            }
        }

        if (!$toConn) {
            $this->sendError($from, 'Recipient not found');
            return;
        }

        $toConn->send(json_encode([
            'type' => 'private_message',
            'from' => $fromInfo['id'],
            'message' => $message,
            'timestamp' => time()
        ]));

        echo "Private message from {$fromInfo['id']} to {$toClientId}\n";
    }

    protected function setClientMetadata(ConnectionInterface $conn, array $metadata) {
        $this->clientInfo[$conn->resourceId]['metadata'] = array_merge(
            $this->clientInfo[$conn->resourceId]['metadata'],
            $metadata
        );

        $conn->send(json_encode([
            'type' => 'metadata_updated',
            'metadata' => $this->clientInfo[$conn->resourceId]['metadata']
        ]));
    }

    protected function notifyRoom(string $room, array $message, ConnectionInterface $exclude = null) {
        if (!isset($this->rooms[$room])) {
            return;
        }

        $payload = json_encode($message);

        foreach ($this->rooms[$room] as $resourceId) {
            if (isset($this->clientInfo[$resourceId])) {
                $conn = $this->clientInfo[$resourceId]['connection'];
                if ($exclude === null || $conn !== $exclude) {
                    $conn->send($payload);
                }
            }
        }
    }

    protected function sendError(ConnectionInterface $conn, string $error) {
        $conn->send(json_encode([
            'type' => 'error',
            'message' => $error,
            'timestamp' => time()
        ]));
    }

    public function onClose(ConnectionInterface $conn) {
        $clientInfo = $this->clientInfo[$conn->resourceId] ?? null;

        if ($clientInfo) {
            // Remove from all rooms
            foreach ($clientInfo['rooms'] as $room) {
                $this->leaveRoom($conn, $room);
            }

            // Remove client info
            unset($this->clientInfo[$conn->resourceId]);

            echo "Connection closed: {$clientInfo['id']}\n";
        }

        // Remove from clients storage
        $this->clients->detach($conn);
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Error: {$e->getMessage()}\n";
        $conn->close();
    }
}

// Create and run the server
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new WebSocketServer()
        )
    ),
    8080,
    '0.0.0.0'
);

echo "WebSocket server running on port 8080\n";
$server->run();
```

## Building a PHP WebSocket Client

While PHP is primarily used for WebSocket servers, you can also create WebSocket
clients for testing or integration with other services.

PHP WebSocket clients are particularly useful in server-to-server communication
scenarios, automated testing environments, and integration with third-party
WebSocket APIs. The client implementation demonstrates important patterns like
automatic reconnection with exponential backoff, which is crucial for
maintaining reliable connections in production environments where network
conditions may vary.

```php
<?php
use React\EventLoop\Loop;
use Ratchet\Client\Connector;
use Ratchet\Client\WebSocket;
use Ratchet\RFC6455\Messaging\MessageInterface;

class WebSocketClient {
    private $loop;
    private $connector;
    private $connection;
    private $uri;
    private $reconnectInterval = 5;
    private $isConnected = false;

    public function __construct(string $uri) {
        $this->uri = $uri;
        $this->loop = Loop::get();
        $this->connector = new Connector($this->loop);
    }

    public function connect(): Promise {
        return $this->connector($this->uri)->then(
            function(WebSocket $conn) {
                $this->connection = $conn;
                $this->isConnected = true;
                echo "Connected to {$this->uri}\n";

                $conn->on('message', [$this, 'onMessage']);
                $conn->on('close', [$this, 'onClose']);
                $conn->on('error', [$this, 'onError']);

                return $conn;
            },
            function($e) {
                echo "Connection failed: {$e->getMessage()}\n";
                $this->scheduleReconnect();
                throw $e;
            }
        );
    }

    public function send($data): void {
        if ($this->isConnected && $this->connection) {
            $message = is_array($data) ? json_encode($data) : $data;
            $this->connection->send($message);
        } else {
            echo "Not connected, cannot send message\n";
        }
    }

    public function onMessage(MessageInterface $msg): void {
        echo "Received: {$msg->getPayload()}\n";

        try {
            $data = json_decode($msg->getPayload(), true);
            $this->handleMessage($data);
        } catch (\Exception $e) {
            echo "Error processing message: {$e->getMessage()}\n";
        }
    }

    protected function handleMessage(array $data): void {
        switch ($data['type'] ?? '') {
            case 'welcome':
                echo "Client ID: {$data['client_id']}\n";
                break;

            case 'message':
                echo "Message from {$data['from']}: {$data['message']}\n";
                break;

            default:
                echo "Received: " . json_encode($data) . "\n";
        }
    }

    public function onClose(): void {
        $this->isConnected = false;
        $this->connection = null;
        echo "Connection closed\n";
        $this->scheduleReconnect();
    }

    public function onError(\Exception $e): void {
        echo "Error: {$e->getMessage()}\n";
    }

    protected function scheduleReconnect(): void {
        echo "Reconnecting in {$this->reconnectInterval} seconds...\n";
        $this->loop->addTimer($this->reconnectInterval, function() {
            $this->connect();
        });
    }

    public function run(): void {
        $this->connect();
        $this->loop->run();
    }
}

// Usage
$client = new WebSocketClient('ws://localhost:8080');
$client->run();
```

## Performance Optimization with Swoole

For high-performance WebSocket applications, Swoole provides a coroutine-based
approach that significantly outperforms traditional PHP implementations.

Swoole represents a paradigm shift in PHP application architecture, introducing
true async programming capabilities that were previously unavailable in the PHP
ecosystem. The coroutine-based approach allows developers to write code that
appears synchronous while actually being non-blocking, making it easier to
reason about async operations without the callback complexity found in other
async systems. This approach can handle tens of thousands of concurrent
connections on a single server, making it suitable for large-scale real-time
applications.

```php
<?php
use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\WebSocket\Frame;

$server = new Server("0.0.0.0", 9501);

$server->on('open', function (Server $server, Request $request) {
    echo "Connection opened: {$request->fd}\n";
    $server->push($request->fd, json_encode([
        'type' => 'welcome',
        'fd' => $request->fd
    ]));
});

$server->on('message', function (Server $server, Frame $frame) {
    echo "Received: {$frame->data}\n";

    // Broadcast to all connected clients
    foreach ($server->connections as $fd) {
        if ($server->isEstablished($fd)) {
            $server->push($fd, $frame->data);
        }
    }
});

$server->on('close', function ($server, $fd) {
    echo "Connection closed: {$fd}\n";
});

$server->start();
```

## Testing WebSocket Applications

Testing WebSocket functionality requires specialized approaches. Here's how to
test WebSocket servers using PHPUnit and WebSocket client libraries.

```php
<?php
use PHPUnit\Framework\TestCase;
use Ratchet\Client\Connector;
use Ratchet\Client\WebSocket;
use React\EventLoop\Loop;

class WebSocketServerTest extends TestCase {
    private $loop;
    private $connector;

    protected function setUp(): void {
        $this->loop = Loop::get();
        $this->connector = new Connector($this->loop);
    }

    public function testConnection() {
        $connected = false;

        $this->connector('ws://localhost:8080')->then(
            function(WebSocket $conn) use (&$connected) {
                $connected = true;
                $conn->close();
            }
        );

        $this->loop->addTimer(1, function() use (&$connected) {
            $this->assertTrue($connected, 'Failed to connect to WebSocket server');
            $this->loop->stop();
        });

        $this->loop->run();
    }

    public function testBroadcastMessage() {
        $received = [];

        // Connect two clients
        $client1 = $this->connector('ws://localhost:8080');
        $client2 = $this->connector('ws://localhost:8080');

        Promise\all([$client1, $client2])->then(function($connections) use (&$received) {
            [$conn1, $conn2] = $connections;

            $conn2->on('message', function($msg) use (&$received) {
                $received[] = json_decode($msg->getPayload(), true);
            });

            // Send broadcast from client 1
            $conn1->send(json_encode([
                'type' => 'broadcast',
                'message' => 'Test broadcast'
            ]));

            $this->loop->addTimer(1, function() use ($conn1, $conn2) {
                $conn1->close();
                $conn2->close();
                $this->loop->stop();
            });
        });

        $this->loop->run();

        $this->assertNotEmpty($received);
        $this->assertEquals('broadcast', $received[0]['type']);
    }
}
```

## Production Deployment

Deploying PHP WebSocket servers requires careful consideration of process
management and resource allocation. Use supervisor or systemd to manage your
WebSocket server process, ensuring automatic restarts on failure.

Configure PHP appropriately for long-running processes. Disable time limits,
increase memory limits as needed, and implement proper error logging. Use
opcache for better performance, but be aware of potential issues with code
changes in long-running processes.

## Security Considerations

Implement proper authentication and authorization for WebSocket connections.
Validate all incoming data and implement rate limiting to prevent abuse. Use TLS
(wss://) for encrypted connections in production environments.

Protect against common attacks like cross-site WebSocket hijacking by validating
the Origin header. Implement message size limits and connection limits per IP
address. Regular security audits and updates are essential for maintaining a
secure WebSocket infrastructure.

## Conclusion

PHP has evolved into a capable platform for WebSocket development, offering
multiple implementation approaches from pure PHP solutions like Ratchet to
high-performance extensions like Swoole. While PHP's traditional architecture
presents some challenges for persistent connections, modern tools and techniques
make it possible to build scalable, production-ready WebSocket applications. The
ability to leverage existing PHP knowledge and infrastructure makes it an
attractive choice for teams already invested in the PHP ecosystem.

## PHP's Transformation for Real-Time Applications

The transformation of PHP from a simple scripting language to a platform capable
of handling persistent WebSocket connections represents one of the most
significant evolutions in web development. This transformation wasn't just
technical; it required a fundamental shift in how developers think about PHP
applications. The traditional request-response model that made PHP so successful
for web development had to be reimagined for the persistent, event-driven world
of WebSockets.

Modern PHP's performance improvements have been nothing short of remarkable. PHP
7 brought performance improvements of up to 100% over PHP 5.6, while PHP 8's JIT
compiler pushes performance even further. When combined with extensions like
Swoole, PHP can achieve performance levels that rival compiled languages for
many WebSocket use cases. This performance, combined with PHP's ease of
deployment and familiar syntax, makes it an increasingly attractive option for
real-time applications.

The ecosystem adaptation has been equally impressive. Traditional PHP frameworks
like Laravel and Symfony have added WebSocket support, allowing developers to
leverage their existing knowledge while building real-time features. This
integration means that organizations with significant PHP investments can add
WebSocket functionality without rewriting their entire application stack. The
ability to share business logic, models, and services between traditional HTTP
endpoints and WebSocket handlers reduces development time and maintains
consistency across the application.

The deployment story for PHP WebSocket applications has also improved
dramatically. Container technologies like Docker make it easy to package and
deploy long-running PHP processes, while process managers like Supervisor ensure
reliability. Cloud platforms increasingly support PHP WebSocket applications,
recognizing that modern PHP is capable of far more than traditional web serving.

Looking forward, PHP's WebSocket story continues to evolve. The language's
ongoing performance improvements, combined with growing library support and
community knowledge, position PHP as a viable choice for real-time applications.
For organizations with existing PHP infrastructure and expertise, the ability to
add WebSocket capabilities without switching technology stacks represents
significant value.

## Frequently Asked Questions

### How do I create a WebSocket server in PHP?

Use Ratchet, the most popular PHP WebSocket library. Install via Composer,
create a class implementing `MessageComponentInterface`, and run it with
ReactPHP's event loop. Swoole is another option offering higher performance
through a C extension.

### Can PHP handle WebSocket connections?

Yes. While PHP's traditional request-response model does not natively support
persistent connections, libraries like Ratchet (built on ReactPHP) and Swoole
run PHP as a long-lived process with an event loop, enabling WebSocket support.

### Which PHP WebSocket library should I use?

Use Ratchet for most projects — it is well-documented and built on ReactPHP. Use
Swoole for high-performance needs (it is a C extension). Use Laravel WebSockets
or Laravel Reverb if you are already in the Laravel ecosystem.

## Related Content

- [JavaScript WebSocket Guide](/guides/languages/javascript/) — browser and
  Node.js WebSocket implementation
- [Python WebSocket Guide](/guides/languages/python/) — asyncio-based WebSocket
  server and client
- [Building a WebSocket Application](/guides/building-a-websocket-app/) —
  hands-on tutorial with cursor sharing
- [WebSocket Security Guide](/guides/security/) — authentication, TLS, and CSWSH
  protection
- [WebSockets at Scale](/guides/websockets-at-scale/) — architecture for
  millions of concurrent connections
