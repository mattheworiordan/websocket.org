---
title: 'C# WebSocket: ASP.NET Core, SignalR & ClientWebSocket'
description:
  'Build C# WebSocket apps with ASP.NET Core middleware, ClientWebSocket, and
  SignalR. Covers .NET 6+, Unity integration, production deployment, and
  enterprise patterns.'
sidebar:
  order: 6
author: "Matthew O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: '2024-09-02'
lastUpdated: 2026-03-10
category: guide
keywords:
  - csharp websocket
  - aspnet core websocket
  - signalr vs websocket
  - clientwebsocket
seo:
  keywords:
    - csharp websocket
    - aspnet core websocket
    - signalr vs websocket
    - clientwebsocket
    - dotnet websocket
    - unity websocket
faq:
  - q: 'How do I use WebSockets in C# .NET?'
    a:
      'Use ClientWebSocket for clients and ASP.NET Core WebSocket middleware for
      servers. ASP.NET Core has built-in WebSocket support via UseWebSockets()
      middleware. For higher-level abstractions, use SignalR which adds
      automatic reconnection and hub-based messaging on top of WebSockets.'
  - q: 'What is the difference between SignalR and WebSockets?'
    a:
      'WebSockets are a raw protocol for bidirectional communication. SignalR is
      a Microsoft library built on top of WebSockets that adds features like
      automatic reconnection, fallback transports, hub-based routing, and
      strongly typed messages. SignalR uses WebSockets when available and falls
      back to other transports.'
  - q: 'Can I use WebSockets in Unity with C#?'
    a:
      'Yes. Use the ClientWebSocket class from System.Net.WebSockets or
      third-party libraries like NativeWebSocket. Unity supports WebSocket
      connections for multiplayer games, real-time data sync, and server
      communication across all platforms.'
---

:::note[Quick Answer]
Use **ASP.NET Core WebSocket middleware** for raw
WebSocket servers. Use **ClientWebSocket** for .NET clients. Use **SignalR**
when you want automatic reconnection, hub-based routing, and fallback
transports. SignalR uses WebSockets under the hood when available.
:::

If you're in the .NET ecosystem, use SignalR. It handles WebSocket
connections, reconnection, and fallback transports. Think of it as
Socket.IO for the .NET world. The raw `ClientWebSocket` API exists for
protocol-level control, but most teams never need it. Start with SignalR,
drop down to raw WebSockets only when you have a specific reason.

## SignalR: the default choice

SignalR is the most popular WebSocket abstraction in .NET. It gives you
hub-based routing, automatic reconnection, strongly typed messages, and
transport fallback (WebSockets, Server-Sent Events, long polling). It is
open source and ships with ASP.NET Core.

### Server hub

```csharp
using Microsoft.AspNetCore.SignalR;

public class ChatHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Clients.Others.SendAsync(
            "UserJoined", Context.ConnectionId
        );
        await base.OnConnectedAsync();
    }

    public async Task SendMessage(string user, string message)
    {
        // Broadcast to all connected clients
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }

    public async Task JoinRoom(string room)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, room);
        await Clients.Group(room).SendAsync(
            "SystemMessage", $"{Context.ConnectionId} joined {room}"
        );
    }

    public async Task SendToRoom(string room, string message)
    {
        await Clients.Group(room).SendAsync("ReceiveMessage", message);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up resources for this connection
        await base.OnDisconnectedAsync(exception);
    }
}
```

### Wiring up the server

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSignalR();

var app = builder.Build();
app.MapHub<ChatHub>("/chat");
app.Run();
```

### Client connection

```csharp
using Microsoft.AspNetCore.SignalR.Client;

var connection = new HubConnectionBuilder()
    .WithUrl("https://localhost:5001/chat")
    .WithAutomaticReconnect()  // retries with 0, 2, 10, 30 sec delays
    .Build();

connection.On<string, string>("ReceiveMessage", (user, msg) =>
{
    Console.WriteLine($"{user}: {msg}");
});

connection.Reconnecting += error =>
{
    Console.WriteLine("Connection lost, reconnecting...");
    return Task.CompletedTask;
};

await connection.StartAsync();
await connection.InvokeAsync("SendMessage", "Alice", "Hello");
```

SignalR handles reconnection automatically. When the connection drops, the
client retries with backoff and re-invokes the negotiation. You do not need
to write retry loops yourself, though you should handle the `Reconnecting`
and `Reconnected` events to update UI state or re-subscribe to groups.

## Raw ASP.NET Core WebSocket middleware

If you need protocol-level control, skip SignalR and use the built-in
middleware directly. This is the escape hatch for custom protocols, binary
framing, or interop with non-.NET clients that speak raw WebSocket.

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

app.Map("/ws", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        return;
    }

    using var ws = await context.WebSockets.AcceptWebSocketAsync();
    var buffer = new byte[4096];

    while (ws.State == WebSocketState.Open)
    {
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);

        if (result.MessageType == WebSocketMessageType.Close)
        {
            await ws.CloseAsync(
                WebSocketCloseStatus.NormalClosure,
                "Closing", CancellationToken.None
            );
            break;
        }

        // Echo back
        await ws.SendAsync(
            buffer.AsMemory(0, result.Count),
            result.MessageType,
            result.EndOfMessage,
            CancellationToken.None
        );
    }
});

app.Run();
```

This gives you a raw pipe. No reconnection, no routing, no message
framing beyond what the WebSocket protocol itself provides. You
handle connection tracking, cleanup, and all error recovery yourself.

## ClientWebSocket: the .NET client

`ClientWebSocket` is the built-in client for connecting to any WebSocket
server from .NET code. It works in console apps, background services,
MAUI apps, and anything running on .NET.

The class is `IDisposable` but not reusable. Once closed or faulted,
you must create a new instance. This is the most common source of
connection leaks in .NET WebSocket code.

```csharp
using System.Net.WebSockets;
using System.Text;

async Task ConnectWithReconnect(Uri uri, CancellationToken ct)
{
    var delay = TimeSpan.FromSeconds(1);
    var maxDelay = TimeSpan.FromSeconds(30);

    while (!ct.IsCancellationRequested)
    {
        using var ws = new ClientWebSocket();
        ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);

        try
        {
            await ws.ConnectAsync(uri, ct);
            delay = TimeSpan.FromSeconds(1); // reset on success

            var buffer = new byte[4096];
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                var msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Console.WriteLine($"Received: {msg}");
            }
        }
        catch (WebSocketException)
        {
            // Connection failed or dropped
        }

        // Exponential backoff
        await Task.Delay(delay, ct);
        delay = TimeSpan.FromSeconds(
            Math.Min(delay.TotalSeconds * 2, maxDelay.TotalSeconds)
        );
    }
}
```

Notice the `using` statement. Every iteration creates a fresh
`ClientWebSocket` and disposes it when the loop body exits. Without
this, you leak unmanaged socket handles. In long-running services, this
causes port exhaustion within hours.

## Three layers of WebSocket in .NET

There are three distinct layers to think about when building realtime
features in .NET. Choosing the right layer matters more than which
library you pick.

**Raw WebSockets** (`ClientWebSocket`, ASP.NET Core middleware) give you
a transport pipe. You get bidirectional bytes. Everything above that,
including message framing, reconnection, routing, authentication, and
connection tracking, is your responsibility. Use this layer when you
are building a custom protocol or need precise control over every frame.

**SignalR** sits on top of WebSockets and adds a protocol layer.
Reconnection, hub-based routing, fallback transports, strongly typed
messages. It is the Socket.IO of the .NET world and the most popular
choice in the ecosystem. But SignalR is not infrastructure. You still
deploy and manage servers. You still handle horizontal scaling (Redis
backplane or Azure SignalR Service). You still own state management,
failover, and capacity planning. When a server restarts, in-flight
connections drop and clients need to re-establish state.

**Managed realtime services** like [Ably][ably-home] operate at the
infrastructure layer. Scaling, connection state, message ordering,
and failure recovery are handled for you. You publish and subscribe
through an SDK and do not run WebSocket servers at all. The trade-off
is less control and a per-message cost, but you skip the operational
burden entirely.

Most .NET teams should start with SignalR. It covers 80% of use cases
with minimal code. When you outgrow what a single server can handle, or
when you need guaranteed delivery across regions, that is when the
infrastructure layer starts earning its keep.

[ably-home]: https://ably.com/?utm_source=websocket-org&utm_medium=csharp-websocket

## Performance is not your main problem

It is tempting to benchmark how many concurrent connections a single
.NET server can hold. 10K? 50K? 100K? The number does not matter as
much as you think. At some point you restart servers. You deploy new
versions. You scale horizontally. Every one of those events disrupts
connections.

The hard problems are state management (which clients are subscribed to
what), reliability (what happens to messages in transit during a
deploy), and failover (how fast do clients reconnect to a healthy
node). Raw connection count is a distraction from these questions.

If you find yourself tuning thread pool sizes and `SocketsHttpHandler`
buffer counts to squeeze out more connections per box, step back and
ask whether you should be running this infrastructure at all. For a
deeper look at what actually matters, see the
[WebSockets at scale](/guides/websockets-at-scale/) guide.

## .NET-specific gotchas

**Connection disposal.** `ClientWebSocket` implements `IDisposable`. If
you forget to dispose it, you leak socket handles. In hosted services
and background workers, this is easy to miss because the object lives
for the lifetime of a reconnect loop. Always wrap each connection
attempt in a `using` block.

**SignalR connection lifecycle in hosted services.** If you run a SignalR
client inside an `IHostedService` or `BackgroundService`, you need to
handle graceful shutdown. Stop the `HubConnection` in `StopAsync`,
not in a finalizer. Otherwise, the app shuts down with open
connections, and the server side sees abrupt disconnects instead of
clean closes:

```csharp
public class SignalRWorker : BackgroundService
{
    private readonly HubConnection _connection;

    public SignalRWorker()
    {
        _connection = new HubConnectionBuilder()
            .WithUrl("https://example.com/hub")
            .WithAutomaticReconnect()
            .Build();
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await _connection.StartAsync(ct);
        // Keep alive until cancellation
        await Task.Delay(Timeout.Infinite, ct);
    }

    public override async Task StopAsync(CancellationToken ct)
    {
        await _connection.StopAsync(ct);
        await _connection.DisposeAsync();
        await base.StopAsync(ct);
    }
}
```

**Thread pool starvation from sync-over-async.** Calling `.Result` or
`.Wait()` on WebSocket async methods blocks a thread pool thread.
Under load, this starves the pool and freezes the entire application.
Always use `await`. If you are in a synchronous context that cannot be
made async (rare in modern .NET), use `Task.Run` to offload rather than
blocking directly.

**Buffer sizing.** The default receive buffer is 4KB. If your messages
are larger, you need to loop on `ReceiveAsync` until `EndOfMessage` is
`true`, reassembling the fragments yourself. SignalR handles this for
you; raw `ClientWebSocket` does not.

## Frequently asked questions

### How do I use WebSockets in C# .NET?

Use `ClientWebSocket` for clients and ASP.NET Core WebSocket middleware
for servers. ASP.NET Core has built-in support via `UseWebSockets()`
middleware. For most applications, use SignalR instead of raw WebSockets.
SignalR adds automatic reconnection, hub-based routing, and transport
fallback so you write less boilerplate. Drop down to raw WebSockets only
when you need custom binary framing or protocol-level control.

### What is the difference between SignalR and WebSockets?

WebSockets are a transport protocol for bidirectional communication.
SignalR is a library built on top of WebSockets (and other transports)
that adds reconnection, hub routing, groups, strongly typed methods,
and fallback to SSE or long polling when WebSockets are unavailable.
The trade-off: SignalR adds latency from its own framing and
negotiation. For latency-sensitive binary protocols, raw WebSockets
are faster.

### Can I use WebSockets in Unity with C#?

Yes. Use `ClientWebSocket` from `System.Net.WebSockets` or a
third-party library like NativeWebSocket. Be aware that Unity uses
an older Mono runtime on some platforms, so test on your target
devices. WebGL builds cannot use `ClientWebSocket` and need a
JavaScript bridge or a Unity-specific WebSocket plugin.

### Should I use SignalR or raw WebSockets?

Use SignalR unless you have a specific reason not to. It handles
reconnection, transport negotiation, and message routing out of the
box. The main reasons to go raw: you need a custom binary protocol,
you are interoperating with non-.NET clients that do not speak the
SignalR protocol, or you need to minimize overhead for
latency-critical workloads.

## Related content

- [Java WebSocket Guide](/guides/languages/java/) - Spring Boot and
  Jakarta EE WebSocket implementation
- [JavaScript WebSocket Guide](/guides/languages/javascript/) - browser
  API and Node.js patterns
- [Building a WebSocket Application](/guides/building-a-websocket-app/)
  - hands-on tutorial with cursor sharing
- [WebSocket Security Guide](/guides/security/) - authentication, TLS,
  and protection patterns
- [WebSockets at Scale](/guides/websockets-at-scale/) - architecture
  for millions of concurrent connections
