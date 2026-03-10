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

:::note[Quick Answer] Use **ASP.NET Core WebSocket middleware** for raw
WebSocket servers. Use **ClientWebSocket** for .NET clients. Use **SignalR**
when you want automatic reconnection, hub-based routing, and fallback
transports. SignalR uses WebSockets under the hood when available. :::

C# and .NET provide one of the most comprehensive and mature ecosystems for
WebSocket development, offering everything from low-level `ClientWebSocket` APIs
to high-level frameworks like SignalR. This guide covers the full spectrum of
WebSocket implementation in the .NET ecosystem, from simple client-server
connections to enterprise-scale real-time applications.

The .NET platform's approach to WebSocket development emphasizes developer
productivity, type safety, and performance. The combination of C#'s powerful
language features, the extensive .NET Base Class Library, and the rich ecosystem
of third-party packages creates an environment where developers can focus on
business logic rather than low-level protocol implementation details.

## Why Choose C# and .NET for WebSocket Development?

The .NET ecosystem offers compelling advantages for WebSocket development that
make it a top choice for enterprise and scalable applications:

**Comprehensive Framework Support**: From the built-in `ClientWebSocket` class
to ASP.NET Core's sophisticated WebSocket middleware, .NET provides extensive
native support for WebSocket protocols without requiring external dependencies.

**Enterprise-Grade Performance**: .NET's just-in-time compilation, garbage
collection optimization, and runtime performance make it capable of handling
thousands of concurrent WebSocket connections efficiently.

**Rich Ecosystem**: SignalR for high-level real-time communication, ASP.NET Core
for web applications, and Unity integration for game development provide
solutions for every use case.

**Cross-Platform Compatibility**: With .NET Core/.NET 5+, your WebSocket
applications run on Windows, Linux, macOS, and in containers with consistent
performance characteristics.

**Excellent Async Programming Support**: C#'s async/await pattern provides
intuitive, efficient handling of WebSocket operations, making it easier to write
scalable applications that can handle thousands of concurrent connections
without complex threading logic.

**Strong Type System**: C#'s static typing helps catch WebSocket protocol errors
and serialization issues at compile time, reducing runtime errors and improving
overall application reliability. The type system also provides excellent
IntelliSense support, making development faster and less error-prone.

**Mature Tooling Ecosystem**: The .NET ecosystem includes excellent debugging
tools, performance profilers, and monitoring solutions that are essential for
diagnosing and optimizing WebSocket applications in production environments.
Visual Studio and Visual Studio Code provide sophisticated debugging
capabilities for real-time applications.

**Strong Typing and Tooling**: C#'s static typing system prevents many runtime
errors, while Visual Studio and other IDEs provide excellent debugging,
profiling, and development experiences.

**Security and Reliability**: Built-in security features, extensive logging
capabilities, and proven stability make .NET ideal for mission-critical
real-time applications.

**Scalability Options**: From simple in-memory solutions to Redis backplanes and
Azure Service Bus, .NET offers multiple paths to scale WebSocket applications
horizontally.

## Setting Up Your .NET WebSocket Project

Let's establish a comprehensive project structure that demonstrates both client
and server implementations across different .NET scenarios.

### Project Structure and Setup

Create a solution with multiple projects to demonstrate different WebSocket
implementation patterns:

```bash
# Create solution and projects
dotnet new sln -n WebSocketGuide
cd WebSocketGuide

# Core library for shared models and interfaces
dotnet new classlib -n WebSocketGuide.Core

# ASP.NET Core WebSocket server
dotnet new web -n WebSocketGuide.Server

# Console client application
dotnet new console -n WebSocketGuide.Client

# SignalR demo
dotnet new web -n WebSocketGuide.SignalR

# Unity client (create manually)
mkdir WebSocketGuide.Unity

# Test projects
dotnet new xunit -n WebSocketGuide.Tests

# Add projects to solution
dotnet sln add **/*.csproj
```

### Core Library Setup

In `WebSocketGuide.Core/WebSocketGuide.Core.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="System.Text.Json" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Options" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Hosting.Abstractions" Version="8.0.0" />
  </ItemGroup>
</Project>
```

### Server Project Setup

In `WebSocketGuide.Server/WebSocketGuide.Server.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="../WebSocketGuide.Core/WebSocketGuide.Core.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="StackExchange.Redis" Version="2.7.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="prometheus-net.AspNetCore" Version="8.0.1" />
  </ItemGroup>
</Project>
```

### Configuration System

Create a robust configuration system in
`WebSocketGuide.Core/Configuration/WebSocketOptions.cs`:

```csharp
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;

namespace WebSocketGuide.Core.Configuration;

public class WebSocketOptions : IValidateOptions<WebSocketOptions>
{
    public const string SectionName = "WebSocket";

    [Range(1, 100000)]
    public int MaxConnections { get; set; } = 10000;

    [Range(1024, 1024 * 1024)]  // 1KB to 1MB
    public int ReceiveBufferSize { get; set; } = 4 * 1024;

    [Range(1, 300)]  // 1 to 300 seconds
    public int KeepAliveIntervalSeconds { get; set; } = 30;

    [Range(1, 3600)]  // 1 second to 1 hour
    public int CloseTimeoutSeconds { get; set; } = 30;

    [Range(1024, 10 * 1024 * 1024)]  // 1KB to 10MB
    public long MaxMessageSize { get; set; } = 1024 * 1024; // 1MB

    public bool EnableCompression { get; set; } = true;

    public string[] AllowedOrigins { get; set; } = { "*" };

    public bool RequireAuthentication { get; set; } = false;

    public string AuthenticationScheme { get; set; } = "Bearer";

    public RateLimitOptions RateLimit { get; set; } = new();

    public RedisOptions? Redis { get; set; }

    public ValidateOptionsResult Validate(string? name, WebSocketOptions options)
    {
        var failures = new List<string>();

        if (options.MaxConnections <= 0)
            failures.Add("MaxConnections must be greater than 0");

        if (options.ReceiveBufferSize < 1024)
            failures.Add("ReceiveBufferSize must be at least 1024 bytes");

        if (options.MaxMessageSize <= 0)
            failures.Add("MaxMessageSize must be greater than 0");

        if (failures.Count > 0)
            return ValidateOptionsResult.Fail(failures);

        return ValidateOptionsResult.Success;
    }
}

public class RateLimitOptions
{
    public bool Enabled { get; set; } = true;

    [Range(1, 10000)]
    public int RequestsPerMinute { get; set; } = 60;

    [Range(1, 1000)]
    public int BurstSize { get; set; } = 10;

    public TimeSpan WindowSize { get; set; } = TimeSpan.FromMinutes(1);
}

public class RedisOptions
{
    [Required]
    public string ConnectionString { get; set; } = string.Empty;

    public string KeyPrefix { get; set; } = "websocket:";

    public int Database { get; set; } = 0;

    public TimeSpan CommandTimeout { get; set; } = TimeSpan.FromSeconds(5);

    public TimeSpan ConnectTimeout { get; set; } = TimeSpan.FromSeconds(5);
}

public class MonitoringOptions
{
    public bool EnableMetrics { get; set; } = true;
    public bool EnableHealthChecks { get; set; } = true;
    public bool EnableTracing { get; set; } = false;
    public string MetricsEndpoint { get; set; } = "/metrics";
    public string HealthEndpoint { get; set; } = "/health";
}
```

This guide covers WebSocket implementation in C# and .NET, including ASP.NET
Core, SignalR, and Unity patterns.

## .NET Client Implementation

### Using ClientWebSocket

The built-in `ClientWebSocket` class for .NET applications:

```csharp
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;

public class WebSocketClient
{
    private ClientWebSocket _webSocket;
    private CancellationTokenSource _cancellationTokenSource;
    private readonly Uri _uri;
    private readonly SemaphoreSlim _sendSemaphore = new(1, 1);

    public WebSocketClient(string uri)
    {
        _uri = new Uri(uri);
    }

    public async Task ConnectAsync()
    {
        _webSocket = new ClientWebSocket();
        _cancellationTokenSource = new CancellationTokenSource();

        // Configure WebSocket options
        _webSocket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
        _webSocket.Options.SetRequestHeader("Authorization", $"Bearer {GetAuthToken()}");
        _webSocket.Options.AddSubProtocol("chat");

        try
        {
            await _webSocket.ConnectAsync(_uri, _cancellationTokenSource.Token);
            Console.WriteLine($"Connected to {_uri}");

            // Start receiving messages
            _ = Task.Run(ReceiveLoop);

            // Send initial message
            await SendMessageAsync(new { type = "subscribe", channel = "updates" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Connection failed: {ex.Message}");
            throw;
        }
    }

    private async Task ReceiveLoop()
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);

        while (_webSocket.State == WebSocketState.Open)
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(
                    buffer,
                    _cancellationTokenSource.Token
                );

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(
                        buffer.Array, 0, result.Count
                    );
                    await HandleTextMessage(message);
                }
                else if (result.MessageType == WebSocketMessageType.Binary)
                {
                    await HandleBinaryMessage(
                        buffer.Array.Take(result.Count).ToArray()
                    );
                }
                else if (result.MessageType == WebSocketMessageType.Close)
                {
                    await HandleClose(result);
                    break;
                }
            }
            catch (WebSocketException ex)
            {
                Console.WriteLine($"WebSocket error: {ex.Message}");
                await HandleError(ex);
                break;
            }
        }
    }

    public async Task SendMessageAsync(object message)
    {
        if (_webSocket.State != WebSocketState.Open)
        {
            throw new InvalidOperationException("WebSocket is not connected");
        }

        var json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);

        await _sendSemaphore.WaitAsync();
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                true,
                _cancellationTokenSource.Token
            );
        }
        finally
        {
            _sendSemaphore.Release();
        }
    }

    public async Task SendBinaryAsync(byte[] data)
    {
        if (_webSocket.State != WebSocketState.Open)
        {
            throw new InvalidOperationException("WebSocket is not connected");
        }

        await _sendSemaphore.WaitAsync();
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(data),
                WebSocketMessageType.Binary,
                true,
                _cancellationTokenSource.Token
            );
        }
        finally
        {
            _sendSemaphore.Release();
        }
    }

    public async Task DisconnectAsync()
    {
        if (_webSocket.State == WebSocketState.Open)
        {
            await _webSocket.CloseAsync(
                WebSocketCloseStatus.NormalClosure,
                "Client disconnecting",
                CancellationToken.None
            );
        }

        _cancellationTokenSource?.Cancel();
        _webSocket?.Dispose();
    }

    private async Task HandleTextMessage(string message)
    {
        try
        {
            var json = JsonDocument.Parse(message);
            var type = json.RootElement.GetProperty("type").GetString();

            switch (type)
            {
                case "notification":
                    await HandleNotification(json.RootElement);
                    break;
                case "data":
                    await HandleData(json.RootElement);
                    break;
                default:
                    Console.WriteLine($"Unknown message type: {type}");
                    break;
            }
        }
        catch (JsonException)
        {
            Console.WriteLine($"Plain text message: {message}");
        }
    }

    private async Task HandleBinaryMessage(byte[] data)
    {
        Console.WriteLine($"Received binary data: {data.Length} bytes");
        // Process binary data
    }

    private async Task HandleClose(WebSocketReceiveResult result)
    {
        Console.WriteLine($"Connection closed: {result.CloseStatus} - {result.CloseStatusDescription}");
    }

    private async Task HandleError(Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
        // Implement reconnection logic
    }

    private async Task HandleNotification(JsonElement json)
    {
        var message = json.GetProperty("message").GetString();
        Console.WriteLine($"Notification: {message}");
    }

    private async Task HandleData(JsonElement json)
    {
        var data = json.GetProperty("data");
        Console.WriteLine($"Data received: {data}");
    }

    private string GetAuthToken()
    {
        // Retrieve authentication token
        return "your-auth-token";
    }
}
```

### Reconnecting WebSocket Client

Implement automatic reconnection with exponential backoff:

```csharp
using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Timers;
using Timer = System.Timers.Timer;

public class ReconnectingWebSocketClient : IDisposable
{
    private ClientWebSocket _webSocket;
    private readonly Uri _uri;
    private CancellationTokenSource _cancellationTokenSource;
    private readonly ConcurrentQueue<byte[]> _messageQueue = new();
    private Timer _reconnectTimer;
    private int _reconnectAttempts = 0;
    private bool _shouldReconnect = true;
    private bool _isDisposed = false;

    // Configuration
    private readonly int _maxReconnectAttempts = 10;
    private readonly TimeSpan _minReconnectDelay = TimeSpan.FromSeconds(1);
    private readonly TimeSpan _maxReconnectDelay = TimeSpan.FromSeconds(30);
    private readonly double _reconnectDecay = 1.5;

    public event EventHandler<string> MessageReceived;
    public event EventHandler<byte[]> BinaryMessageReceived;
    public event EventHandler Connected;
    public event EventHandler<string> Disconnected;
    public event EventHandler<Exception> ErrorOccurred;

    public WebSocketState State => _webSocket?.State ?? WebSocketState.None;
    public bool IsConnected => State == WebSocketState.Open;

    public ReconnectingWebSocketClient(string uri)
    {
        _uri = new Uri(uri);
    }

    public async Task ConnectAsync()
    {
        try
        {
            _webSocket = new ClientWebSocket();
            _cancellationTokenSource = new CancellationTokenSource();

            ConfigureWebSocket();

            await _webSocket.ConnectAsync(_uri, _cancellationTokenSource.Token);

            _reconnectAttempts = 0;
            Connected?.Invoke(this, EventArgs.Empty);

            // Process queued messages
            while (_messageQueue.TryDequeue(out var message))
            {
                await SendInternalAsync(message);
            }

            // Start receive loop
            _ = Task.Run(ReceiveLoopAsync);
        }
        catch (Exception ex)
        {
            ErrorOccurred?.Invoke(this, ex);

            if (_shouldReconnect && !IsMaxReconnectsReached())
            {
                ScheduleReconnect();
            }

            throw;
        }
    }

    private void ConfigureWebSocket()
    {
        _webSocket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
        _webSocket.Options.SetRequestHeader("User-Agent", "ReconnectingWebSocketClient/1.0");

        // Add any custom headers or sub-protocols
        ConfigureWebSocketOptions(_webSocket.Options);
    }

    protected virtual void ConfigureWebSocketOptions(ClientWebSocketOptions options)
    {
        // Override in derived class to add custom configuration
    }

    private async Task ReceiveLoopAsync()
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);
        var messageBuilder = new List<byte>();

        while (IsConnected && !_cancellationTokenSource.Token.IsCancellationRequested)
        {
            try
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await _webSocket.ReceiveAsync(buffer, _cancellationTokenSource.Token);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await HandleCloseAsync(result);
                        return;
                    }

                    messageBuilder.AddRange(buffer.Array.Take(result.Count));

                } while (!result.EndOfMessage);

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(messageBuilder.ToArray());
                    MessageReceived?.Invoke(this, message);
                }
                else if (result.MessageType == WebSocketMessageType.Binary)
                {
                    BinaryMessageReceived?.Invoke(this, messageBuilder.ToArray());
                }

                messageBuilder.Clear();
            }
            catch (WebSocketException ex)
            {
                ErrorOccurred?.Invoke(this, ex);
                await HandleDisconnectAsync(ex.Message);
                break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    public async Task SendAsync(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        await SendAsync(bytes, WebSocketMessageType.Text);
    }

    public async Task SendBinaryAsync(byte[] data)
    {
        await SendAsync(data, WebSocketMessageType.Binary);
    }

    private async Task SendAsync(byte[] data, WebSocketMessageType messageType)
    {
        if (IsConnected)
        {
            await SendInternalAsync(data, messageType);
        }
        else
        {
            // Queue message for sending after reconnection
            _messageQueue.Enqueue(data);
        }
    }

    private async Task SendInternalAsync(byte[] data,
        WebSocketMessageType messageType = WebSocketMessageType.Text)
    {
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(data),
                messageType,
                true,
                _cancellationTokenSource.Token
            );
        }
        catch (WebSocketException ex)
        {
            ErrorOccurred?.Invoke(this, ex);
            _messageQueue.Enqueue(data); // Re-queue on failure
            throw;
        }
    }

    private async Task HandleCloseAsync(WebSocketReceiveResult result)
    {
        var reason = result.CloseStatusDescription ?? "No reason provided";
        Disconnected?.Invoke(this, reason);

        if (_shouldReconnect && result.CloseStatus != WebSocketCloseStatus.NormalClosure)
        {
            await HandleDisconnectAsync(reason);
        }
    }

    private async Task HandleDisconnectAsync(string reason)
    {
        Disconnected?.Invoke(this, reason);

        if (_shouldReconnect && !IsMaxReconnectsReached())
        {
            ScheduleReconnect();
        }
    }

    private void ScheduleReconnect()
    {
        var delay = GetReconnectDelay();
        _reconnectAttempts++;

        Console.WriteLine($"Reconnecting in {delay.TotalSeconds:F1} seconds (attempt #{_reconnectAttempts})");

        _reconnectTimer?.Dispose();
        _reconnectTimer = new Timer(delay.TotalMilliseconds);
        _reconnectTimer.Elapsed += async (sender, e) =>
        {
            _reconnectTimer.Dispose();

            if (_shouldReconnect && !_isDisposed)
            {
                await ConnectAsync();
            }
        };
        _reconnectTimer.Start();
    }

    private TimeSpan GetReconnectDelay()
    {
        var delay = TimeSpan.FromMilliseconds(
            _minReconnectDelay.TotalMilliseconds *
            Math.Pow(_reconnectDecay, _reconnectAttempts)
        );

        return delay > _maxReconnectDelay ? _maxReconnectDelay : delay;
    }

    private bool IsMaxReconnectsReached()
    {
        return _reconnectAttempts >= _maxReconnectAttempts;
    }

    public async Task DisconnectAsync()
    {
        _shouldReconnect = false;
        _reconnectTimer?.Dispose();

        if (IsConnected)
        {
            await _webSocket.CloseAsync(
                WebSocketCloseStatus.NormalClosure,
                "Client disconnecting",
                CancellationToken.None
            );
        }

        _cancellationTokenSource?.Cancel();
    }

    public void Dispose()
    {
        if (_isDisposed) return;

        _isDisposed = true;
        _shouldReconnect = false;

        _reconnectTimer?.Dispose();
        _cancellationTokenSource?.Cancel();
        _cancellationTokenSource?.Dispose();
        _webSocket?.Dispose();
    }
}
```

## ASP.NET Core WebSocket Server

### Basic WebSocket Middleware

Configure WebSocket support in ASP.NET Core:

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();

        // Add WebSocket manager service
        services.AddSingleton<WebSocketConnectionManager>();
        services.AddTransient<WebSocketHandler>();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseRouting();

        // Enable WebSocket support
        var webSocketOptions = new WebSocketOptions
        {
            KeepAliveInterval = TimeSpan.FromSeconds(120),
            ReceiveBufferSize = 4 * 1024
        };
        app.UseWebSockets(webSocketOptions);

        // Map WebSocket endpoints
        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.Map("/ws", async context =>
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                    var handler = context.RequestServices.GetRequiredService<WebSocketHandler>();
                    await handler.HandleAsync(context, webSocket);
                }
                else
                {
                    context.Response.StatusCode = 400;
                }
            });
        });
    }
}

public class WebSocketHandler
{
    private readonly WebSocketConnectionManager _connectionManager;
    private readonly ILogger<WebSocketHandler> _logger;

    public WebSocketHandler(
        WebSocketConnectionManager connectionManager,
        ILogger<WebSocketHandler> logger)
    {
        _connectionManager = connectionManager;
        _logger = logger;
    }

    public async Task HandleAsync(HttpContext context, WebSocket webSocket)
    {
        var connectionId = _connectionManager.AddConnection(webSocket);
        _logger.LogInformation($"WebSocket connection established: {connectionId}");

        try
        {
            await ReceiveAsync(connectionId, webSocket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error in WebSocket connection {connectionId}");
        }
        finally
        {
            _connectionManager.RemoveConnection(connectionId);
            _logger.LogInformation($"WebSocket connection closed: {connectionId}");
        }
    }

    private async Task ReceiveAsync(string connectionId, WebSocket webSocket)
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);

        while (webSocket.State == WebSocketState.Open)
        {
            var result = await webSocket.ReceiveAsync(buffer, CancellationToken.None);

            switch (result.MessageType)
            {
                case WebSocketMessageType.Text:
                    var message = Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
                    await HandleTextMessage(connectionId, message);
                    break;

                case WebSocketMessageType.Binary:
                    await HandleBinaryMessage(connectionId, buffer.Array.Take(result.Count).ToArray());
                    break;

                case WebSocketMessageType.Close:
                    await webSocket.CloseAsync(
                        result.CloseStatus.Value,
                        result.CloseStatusDescription,
                        CancellationToken.None
                    );
                    break;
            }
        }
    }

    private async Task HandleTextMessage(string connectionId, string message)
    {
        _logger.LogInformation($"Received from {connectionId}: {message}");

        try
        {
            var json = JsonDocument.Parse(message);
            var type = json.RootElement.GetProperty("type").GetString();

            switch (type)
            {
                case "broadcast":
                    await BroadcastMessage(connectionId, message);
                    break;
                case "private":
                    await SendPrivateMessage(connectionId, json.RootElement);
                    break;
                default:
                    await Echo(connectionId, message);
                    break;
            }
        }
        catch (JsonException)
        {
            await Echo(connectionId, message);
        }
    }

    private async Task HandleBinaryMessage(string connectionId, byte[] data)
    {
        _logger.LogInformation($"Received binary from {connectionId}: {data.Length} bytes");
        // Process binary data
    }

    private async Task Echo(string connectionId, string message)
    {
        await _connectionManager.SendAsync(connectionId, $"Echo: {message}");
    }

    private async Task BroadcastMessage(string senderId, string message)
    {
        await _connectionManager.BroadcastAsync(message, senderId);
    }

    private async Task SendPrivateMessage(string senderId, JsonElement json)
    {
        var targetId = json.GetProperty("target").GetString();
        var content = json.GetProperty("content").GetString();

        await _connectionManager.SendAsync(targetId, content);
    }
}

public class WebSocketConnectionManager
{
    private readonly ConcurrentDictionary<string, WebSocket> _connections = new();

    public string AddConnection(WebSocket webSocket)
    {
        var connectionId = Guid.NewGuid().ToString();
        _connections.TryAdd(connectionId, webSocket);
        return connectionId;
    }

    public void RemoveConnection(string connectionId)
    {
        _connections.TryRemove(connectionId, out _);
    }

    public WebSocket GetConnection(string connectionId)
    {
        _connections.TryGetValue(connectionId, out var connection);
        return connection;
    }

    public IEnumerable<string> GetAllConnectionIds()
    {
        return _connections.Keys;
    }

    public async Task SendAsync(string connectionId, string message)
    {
        if (_connections.TryGetValue(connectionId, out var webSocket))
        {
            if (webSocket.State == WebSocketState.Open)
            {
                var bytes = Encoding.UTF8.GetBytes(message);
                await webSocket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None
                );
            }
        }
    }

    public async Task BroadcastAsync(string message, string excludeConnectionId = null)
    {
        var tasks = new List<Task>();

        foreach (var pair in _connections)
        {
            if (pair.Key != excludeConnectionId && pair.Value.State == WebSocketState.Open)
            {
                tasks.Add(SendAsync(pair.Key, message));
            }
        }

        await Task.WhenAll(tasks);
    }
}
```

## SignalR Implementation

### SignalR Hub

Implement real-time communication with SignalR:

```csharp
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Collections.Concurrent;

public class ChatHub : Hub
{
    private static readonly ConcurrentDictionary<string, UserConnection> _connections = new();
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ILogger<ChatHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var connectionId = Context.ConnectionId;
        var userId = Context.UserIdentifier ?? "anonymous";

        _connections.TryAdd(connectionId, new UserConnection
        {
            ConnectionId = connectionId,
            UserId = userId,
            ConnectedAt = DateTime.UtcNow
        });

        _logger.LogInformation($"User {userId} connected with ID {connectionId}");

        // Notify others
        await Clients.Others.SendAsync("UserConnected", userId);

        // Send welcome message
        await Clients.Caller.SendAsync("Welcome", new
        {
            message = "Welcome to the chat!",
            connectionId,
            onlineUsers = GetOnlineUsers()
        });

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        var connectionId = Context.ConnectionId;

        if (_connections.TryRemove(connectionId, out var connection))
        {
            _logger.LogInformation($"User {connection.UserId} disconnected");
            await Clients.Others.SendAsync("UserDisconnected", connection.UserId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string message)
    {
        var userId = Context.UserIdentifier ?? "anonymous";
        var timestamp = DateTime.UtcNow;

        var chatMessage = new ChatMessage
        {
            UserId = userId,
            Message = message,
            Timestamp = timestamp
        };

        await Clients.All.SendAsync("ReceiveMessage", chatMessage);
    }

    public async Task SendPrivateMessage(string targetUserId, string message)
    {
        var senderId = Context.UserIdentifier ?? "anonymous";
        var timestamp = DateTime.UtcNow;

        var privateMessage = new PrivateMessage
        {
            SenderId = senderId,
            ReceiverId = targetUserId,
            Message = message,
            Timestamp = timestamp
        };

        // Send to target user
        await Clients.User(targetUserId).SendAsync("ReceivePrivateMessage", privateMessage);

        // Send confirmation to sender
        await Clients.Caller.SendAsync("PrivateMessageSent", privateMessage);
    }

    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Group(groupName).SendAsync("UserJoinedGroup", new
        {
            groupName,
            userId,
            message = $"{userId} joined the group"
        });
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Group(groupName).SendAsync("UserLeftGroup", new
        {
            groupName,
            userId,
            message = $"{userId} left the group"
        });
    }

    public async Task SendToGroup(string groupName, string message)
    {
        var userId = Context.UserIdentifier ?? "anonymous";

        await Clients.Group(groupName).SendAsync("ReceiveGroupMessage", new
        {
            groupName,
            userId,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    [Authorize]
    public async Task SendAuthenticatedMessage(string message)
    {
        var userId = Context.UserIdentifier;
        var userName = Context.User?.Identity?.Name;

        await Clients.All.SendAsync("ReceiveAuthenticatedMessage", new
        {
            userId,
            userName,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task<object> GetConnectionInfo()
    {
        return new
        {
            connectionId = Context.ConnectionId,
            userId = Context.UserIdentifier,
            isAuthenticated = Context.User?.Identity?.IsAuthenticated ?? false,
            claims = Context.User?.Claims?.Select(c => new { c.Type, c.Value })
        };
    }

    public async Task Typing(bool isTyping)
    {
        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Others.SendAsync("UserTyping", new { userId, isTyping });
    }

    public async Task<IEnumerable<string>> GetOnlineUsers()
    {
        return _connections.Values.Select(c => c.UserId).Distinct();
    }

    private class UserConnection
    {
        public string ConnectionId { get; set; }
        public string UserId { get; set; }
        public DateTime ConnectedAt { get; set; }
    }

    private class ChatMessage
    {
        public string UserId { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; }
    }

    private class PrivateMessage : ChatMessage
    {
        public string SenderId { get; set; }
        public string ReceiverId { get; set; }
    }
}
```

### SignalR Client

Connect to SignalR hub from C# client:

```csharp
using Microsoft.AspNetCore.SignalR.Client;
using System;
using System.Threading.Tasks;

public class SignalRClient : IAsyncDisposable
{
    private HubConnection _connection;
    private readonly string _hubUrl;
    private readonly ILogger<SignalRClient> _logger;

    public event EventHandler<string> MessageReceived;
    public event EventHandler<string> Connected;
    public event EventHandler<string> Disconnected;

    public HubConnectionState State => _connection?.State ?? HubConnectionState.Disconnected;

    public SignalRClient(string hubUrl, ILogger<SignalRClient> logger)
    {
        _hubUrl = hubUrl;
        _logger = logger;
    }

    public async Task ConnectAsync()
    {
        _connection = new HubConnectionBuilder()
            .WithUrl(_hubUrl, options =>
            {
                options.AccessTokenProvider = () => Task.FromResult(GetAccessToken());
            })
            .WithAutomaticReconnect(new[] {
                TimeSpan.Zero,
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(30)
            })
            .ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Information);
            })
            .Build();

        // Register event handlers
        RegisterHandlers();

        // Handle reconnection
        _connection.Reconnecting += (error) =>
        {
            _logger.LogWarning($"Connection lost. Reconnecting... Error: {error?.Message}");
            return Task.CompletedTask;
        };

        _connection.Reconnected += (connectionId) =>
        {
            _logger.LogInformation($"Reconnected with ID: {connectionId}");
            Connected?.Invoke(this, connectionId);
            return Task.CompletedTask;
        };

        _connection.Closed += async (error) =>
        {
            _logger.LogError($"Connection closed. Error: {error?.Message}");
            Disconnected?.Invoke(this, error?.Message ?? "Connection closed");

            // Manual reconnection if automatic reconnection failed
            await Task.Delay(new Random().Next(0, 5) * 1000);
            await ConnectAsync();
        };

        try
        {
            await _connection.StartAsync();
            _logger.LogInformation("Connected to SignalR hub");
            Connected?.Invoke(this, _connection.ConnectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to SignalR hub");
            throw;
        }
    }

    private void RegisterHandlers()
    {
        _connection.On<ChatMessage>("ReceiveMessage", (message) =>
        {
            _logger.LogInformation($"Message received: {message.Message}");
            MessageReceived?.Invoke(this, message.Message);
        });

        _connection.On<PrivateMessage>("ReceivePrivateMessage", (message) =>
        {
            _logger.LogInformation($"Private message from {message.SenderId}: {message.Message}");
            HandlePrivateMessage(message);
        });

        _connection.On<string>("UserConnected", (userId) =>
        {
            _logger.LogInformation($"User connected: {userId}");
        });

        _connection.On<string>("UserDisconnected", (userId) =>
        {
            _logger.LogInformation($"User disconnected: {userId}");
        });

        _connection.On<object>("Welcome", (data) =>
        {
            _logger.LogInformation($"Welcome message received: {data}");
        });

        _connection.On<dynamic>("UserTyping", (data) =>
        {
            HandleUserTyping(data.userId, data.isTyping);
        });
    }

    public async Task SendMessageAsync(string message)
    {
        if (_connection.State != HubConnectionState.Connected)
        {
            throw new InvalidOperationException("Not connected to hub");
        }

        await _connection.InvokeAsync("SendMessage", message);
    }

    public async Task SendPrivateMessageAsync(string targetUserId, string message)
    {
        await _connection.InvokeAsync("SendPrivateMessage", targetUserId, message);
    }

    public async Task JoinGroupAsync(string groupName)
    {
        await _connection.InvokeAsync("JoinGroup", groupName);
    }

    public async Task LeaveGroupAsync(string groupName)
    {
        await _connection.InvokeAsync("LeaveGroup", groupName);
    }

    public async Task SendToGroupAsync(string groupName, string message)
    {
        await _connection.InvokeAsync("SendToGroup", groupName, message);
    }

    public async Task<T> InvokeAsync<T>(string methodName, params object[] args)
    {
        return await _connection.InvokeAsync<T>(methodName, args);
    }

    public async Task SendAsync(string methodName, params object[] args)
    {
        await _connection.SendAsync(methodName, args);
    }

    public IDisposable On<T>(string methodName, Action<T> handler)
    {
        return _connection.On(methodName, handler);
    }

    private void HandlePrivateMessage(PrivateMessage message)
    {
        // Handle private message
    }

    private void HandleUserTyping(string userId, bool isTyping)
    {
        // Handle typing indicator
    }

    private string GetAccessToken()
    {
        // Retrieve access token
        return "your-access-token";
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
        {
            await _connection.DisposeAsync();
        }
    }

    private class ChatMessage
    {
        public string UserId { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; }
    }

    private class PrivateMessage : ChatMessage
    {
        public string SenderId { get; set; }
        public string ReceiverId { get; set; }
    }
}
```

## Unity WebSocket Implementation

### WebSocket Client for Unity

Using WebSocketSharp for Unity games:

```csharp
using UnityEngine;
using WebSocketSharp;
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Newtonsoft.Json;

public class UnityWebSocketClient : MonoBehaviour
{
    private WebSocket _webSocket;
    private readonly ConcurrentQueue<Action> _mainThreadActions = new();
    private bool _isConnected = false;

    [SerializeField] private string serverUrl = "wss://your-server.com/ws";
    [SerializeField] private int reconnectDelay = 5;

    public event Action OnConnected;
    public event Action<string> OnMessageReceived;
    public event Action<string> OnDisconnected;
    public event Action<string> OnError;

    private void Start()
    {
        Connect();
    }

    private void Connect()
    {
        try
        {
            _webSocket = new WebSocket(serverUrl);

            // Configure WebSocket
            _webSocket.Compression = CompressionMethod.Deflate;
            _webSocket.WaitTime = TimeSpan.FromSeconds(10);

            // Set up event handlers
            _webSocket.OnOpen += OnWebSocketOpen;
            _webSocket.OnMessage += OnWebSocketMessage;
            _webSocket.OnError += OnWebSocketError;
            _webSocket.OnClose += OnWebSocketClose;

            // Add headers
            _webSocket.SetCookie(new Cookie("sessionId", GetSessionId()));
            _webSocket.CustomHeaders = new Dictionary<string, string>
            {
                { "Authorization", $"Bearer {GetAuthToken()}" },
                { "X-Client-Version", Application.version }
            };

            _webSocket.ConnectAsync();
            Debug.Log($"Connecting to {serverUrl}...");
        }
        catch (Exception ex)
        {
            Debug.LogError($"Failed to create WebSocket: {ex.Message}");
            ScheduleReconnect();
        }
    }

    private void OnWebSocketOpen(object sender, EventArgs e)
    {
        Debug.Log("WebSocket connected!");
        _isConnected = true;

        EnqueueMainThreadAction(() =>
        {
            OnConnected?.Invoke();

            // Send initial message
            SendMessage(new
            {
                type = "register",
                playerId = GetPlayerId(),
                platform = Application.platform.ToString()
            });
        });
    }

    private void OnWebSocketMessage(object sender, MessageEventArgs e)
    {
        if (e.IsText)
        {
            Debug.Log($"Received text: {e.Data}");
            EnqueueMainThreadAction(() => HandleMessage(e.Data));
        }
        else if (e.IsBinary)
        {
            Debug.Log($"Received binary: {e.RawData.Length} bytes");
            EnqueueMainThreadAction(() => HandleBinaryMessage(e.RawData));
        }
    }

    private void OnWebSocketError(object sender, ErrorEventArgs e)
    {
        Debug.LogError($"WebSocket error: {e.Message}");
        EnqueueMainThreadAction(() => OnError?.Invoke(e.Message));
    }

    private void OnWebSocketClose(object sender, CloseEventArgs e)
    {
        Debug.Log($"WebSocket closed: {e.Code} - {e.Reason}");
        _isConnected = false;

        EnqueueMainThreadAction(() =>
        {
            OnDisconnected?.Invoke(e.Reason);

            if (e.Code != 1000) // Not normal closure
            {
                ScheduleReconnect();
            }
        });
    }

    private void HandleMessage(string message)
    {
        try
        {
            var json = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);
            var type = json["type"].ToString();

            switch (type)
            {
                case "game_state":
                    UpdateGameState(json);
                    break;
                case "player_action":
                    HandlePlayerAction(json);
                    break;
                case "chat":
                    HandleChatMessage(json);
                    break;
                default:
                    OnMessageReceived?.Invoke(message);
                    break;
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"Failed to handle message: {ex.Message}");
        }
    }

    private void HandleBinaryMessage(byte[] data)
    {
        // Handle binary data (e.g., game state snapshots, audio data)
    }

    private void UpdateGameState(Dictionary<string, object> data)
    {
        // Update game state based on server data
    }

    private void HandlePlayerAction(Dictionary<string, object> data)
    {
        // Handle other player's actions
    }

    private void HandleChatMessage(Dictionary<string, object> data)
    {
        var sender = data["sender"].ToString();
        var message = data["message"].ToString();
        Debug.Log($"Chat from {sender}: {message}");
    }

    public void SendMessage(object message)
    {
        if (_isConnected && _webSocket != null)
        {
            var json = JsonConvert.SerializeObject(message);
            _webSocket.SendAsync(json, (success) =>
            {
                if (!success)
                {
                    Debug.LogError("Failed to send message");
                }
            });
        }
        else
        {
            Debug.LogWarning("Cannot send message: not connected");
        }
    }

    public void SendBinary(byte[] data)
    {
        if (_isConnected && _webSocket != null)
        {
            _webSocket.SendAsync(data, (success) =>
            {
                if (!success)
                {
                    Debug.LogError("Failed to send binary data");
                }
            });
        }
    }

    private void ScheduleReconnect()
    {
        Debug.Log($"Scheduling reconnect in {reconnectDelay} seconds...");
        Invoke(nameof(Connect), reconnectDelay);
    }

    private void EnqueueMainThreadAction(Action action)
    {
        _mainThreadActions.Enqueue(action);
    }

    private void Update()
    {
        // Execute actions on main thread
        while (_mainThreadActions.TryDequeue(out var action))
        {
            action?.Invoke();
        }
    }

    private void OnDestroy()
    {
        Disconnect();
    }

    private void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus)
        {
            Disconnect();
        }
        else
        {
            Connect();
        }
    }

    private void OnApplicationFocus(bool hasFocus)
    {
        if (!hasFocus && Application.platform == RuntimePlatform.WebGLPlayer)
        {
            // Handle WebGL focus loss
        }
    }

    public void Disconnect()
    {
        if (_webSocket != null)
        {
            _webSocket.Close(CloseStatusCode.Normal, "Client disconnecting");
            _webSocket = null;
        }
        _isConnected = false;
    }

    private string GetSessionId()
    {
        return PlayerPrefs.GetString("SessionId", Guid.NewGuid().ToString());
    }

    private string GetAuthToken()
    {
        return PlayerPrefs.GetString("AuthToken", "");
    }

    private string GetPlayerId()
    {
        return PlayerPrefs.GetString("PlayerId", SystemInfo.deviceUniqueIdentifier);
    }
}
```

## Comprehensive Testing Strategies

### xUnit Integration Tests

Implement comprehensive WebSocket testing with xUnit and ASP.NET Core Test
Server:

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Xunit;
using Xunit.Abstractions;

namespace WebSocketGuide.Tests.Integration;

public class WebSocketIntegrationTests : IAsyncLifetime
{
    private readonly TestServer _server;
    private readonly HttpClient _httpClient;
    private readonly ITestOutputHelper _output;

    public WebSocketIntegrationTests(ITestOutputHelper output)
    {
        _output = output;

        var builder = new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddLogging(builder => builder.AddXUnit(_output));
                services.AddSingleton<WebSocketConnectionManager>();
                services.AddTransient<WebSocketHandler>();
            })
            .Configure(app =>
            {
                app.UseWebSockets();
                app.UseRouting();
                app.UseEndpoints(endpoints =>
                {
                    endpoints.Map("/ws", async context =>
                    {
                        if (context.WebSockets.IsWebSocketRequest)
                        {
                            using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                            var handler = context.RequestServices.GetRequiredService<WebSocketHandler>();
                            await handler.HandleAsync(context, webSocket);
                        }
                        else
                        {
                            context.Response.StatusCode = 400;
                        }
                    });
                });
            });

        _server = new TestServer(builder);
        _httpClient = _server.CreateClient();
    }

    [Fact]
    public async Task WebSocket_CanEstablishConnection()
    {
        // Arrange
        var webSocketClient = _server.CreateWebSocketClient();
        var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");

        // Act
        var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketState.Open, webSocket.State);

        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test completed", CancellationToken.None);
    }

    [Fact]
    public async Task WebSocket_CanSendAndReceiveTextMessage()
    {
        // Arrange
        var webSocketClient = _server.CreateWebSocketClient();
        var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");
        var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

        var testMessage = new
        {
            type = "test",
            content = "Hello, WebSocket!"
        };
        var messageJson = JsonSerializer.Serialize(testMessage);

        // Act
        await SendTextMessageAsync(webSocket, messageJson);
        var receivedMessage = await ReceiveTextMessageAsync(webSocket);

        // Assert
        Assert.Contains("Hello, WebSocket!", receivedMessage);

        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test completed", CancellationToken.None);
    }

    [Fact]
    public async Task WebSocket_HandlesBinaryMessages()
    {
        // Arrange
        var webSocketClient = _server.CreateWebSocketClient();
        var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");
        var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

        var binaryData = Encoding.UTF8.GetBytes("Binary test data");

        // Act
        await SendBinaryMessageAsync(webSocket, binaryData);
        var receivedData = await ReceiveBinaryMessageAsync(webSocket);

        // Assert
        Assert.Equal(binaryData, receivedData);

        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test completed", CancellationToken.None);
    }

    [Fact]
    public async Task WebSocket_HandlesMultipleConcurrentConnections()
    {
        // Arrange
        const int connectionCount = 5;
        var tasks = new List<Task>();
        var webSocketClient = _server.CreateWebSocketClient();

        // Act
        for (int i = 0; i < connectionCount; i++)
        {
            var connectionId = i;
            tasks.Add(Task.Run(async () =>
            {
                var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");
                var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

                await SendTextMessageAsync(webSocket, $"Message from connection {connectionId}");
                var response = await ReceiveTextMessageAsync(webSocket);

                Assert.Contains($"{connectionId}", response);

                await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test completed", CancellationToken.None);
            }));
        }

        await Task.WhenAll(tasks);

        // Assert - all tasks completed successfully
        Assert.All(tasks, task => Assert.True(task.IsCompletedSuccessfully));
    }

    [Theory]
    [InlineData(10)]
    [InlineData(100)]
    [InlineData(1000)]
    public async Task WebSocket_HandlesMessageBatches(int messageCount)
    {
        // Arrange
        var webSocketClient = _server.CreateWebSocketClient();
        var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");
        var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

        var messages = Enumerable.Range(0, messageCount)
            .Select(i => $"Message {i}")
            .ToList();

        // Act
        var sendTasks = messages.Select(msg => SendTextMessageAsync(webSocket, msg));
        await Task.WhenAll(sendTasks);

        var receivedMessages = new List<string>();
        for (int i = 0; i < messageCount; i++)
        {
            var received = await ReceiveTextMessageAsync(webSocket);
            receivedMessages.Add(received);
        }

        // Assert
        Assert.Equal(messageCount, receivedMessages.Count);

        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test completed", CancellationToken.None);
    }

    [Fact]
    public async Task WebSocket_HandlesConnectionClose()
    {
        // Arrange
        var webSocketClient = _server.CreateWebSocketClient();
        var uri = new Uri(_server.BaseAddress.Replace("http", "ws") + "ws");
        var webSocket = await webSocketClient.ConnectAsync(uri, CancellationToken.None);

        // Act
        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Intentional close", CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketState.Closed, webSocket.State);
    }

    private static async Task SendTextMessageAsync(WebSocket webSocket, string message)
    {
        var buffer = Encoding.UTF8.GetBytes(message);
        await webSocket.SendAsync(
            new ArraySegment<byte>(buffer),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None
        );
    }

    private static async Task SendBinaryMessageAsync(WebSocket webSocket, byte[] data)
    {
        await webSocket.SendAsync(
            new ArraySegment<byte>(data),
            WebSocketMessageType.Binary,
            true,
            CancellationToken.None
        );
    }

    private static async Task<string> ReceiveTextMessageAsync(WebSocket webSocket)
    {
        var buffer = new byte[4096];
        var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        return Encoding.UTF8.GetString(buffer, 0, result.Count);
    }

    private static async Task<byte[]> ReceiveBinaryMessageAsync(WebSocket webSocket)
    {
        var buffer = new byte[4096];
        var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        return buffer.Take(result.Count).ToArray();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        _httpClient?.Dispose();
        _server?.Dispose();
    }
}
```

### Performance and Load Testing

Create comprehensive performance tests:

```csharp
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Diagnostics;
using Xunit;
using Xunit.Abstractions;

namespace WebSocketGuide.Tests.Performance;

public class WebSocketPerformanceTests
{
    private readonly ITestOutputHelper _output;
    private readonly ILogger<WebSocketPerformanceTests> _logger;

    public WebSocketPerformanceTests(ITestOutputHelper output)
    {
        _output = output;
        _logger = new XUnitLogger<WebSocketPerformanceTests>(output);
    }

    [Fact]
    public async Task WebSocket_PerformanceTest_MultipleConnections()
    {
        // Arrange
        const int connectionCount = 100;
        const int messagesPerConnection = 10;
        const int timeoutMs = 30000;

        var connectionTasks = new List<Task<ConnectionResult>>();
        var stopwatch = Stopwatch.StartNew();

        // Act
        for (int i = 0; i < connectionCount; i++)
        {
            var connectionId = i;
            connectionTasks.Add(CreateConnectionAndSendMessages(connectionId, messagesPerConnection));
        }

        var results = await Task.WhenAll(connectionTasks);
        stopwatch.Stop();

        // Assert and Report
        var successfulConnections = results.Count(r => r.Success);
        var totalMessages = results.Sum(r => r.MessagesSent);
        var averageLatency = results.Where(r => r.Success).Average(r => r.AverageLatencyMs);

        _output.WriteLine($"Performance Test Results:");
        _output.WriteLine($"  Connections: {successfulConnections}/{connectionCount}");
        _output.WriteLine($"  Total Messages: {totalMessages}");
        _output.WriteLine($"  Total Time: {stopwatch.ElapsedMilliseconds}ms");
        _output.WriteLine($"  Messages/Second: {totalMessages / (stopwatch.ElapsedMilliseconds / 1000.0):F2}");
        _output.WriteLine($"  Average Latency: {averageLatency:F2}ms");

        Assert.True(successfulConnections >= connectionCount * 0.95, "At least 95% of connections should succeed");
        Assert.True(averageLatency < 100, "Average latency should be less than 100ms");
    }

    [Fact]
    public async Task WebSocket_ThroughputTest_SingleConnection()
    {
        // Arrange
        const int messageCount = 1000;
        var client = new ReconnectingWebSocketClient("ws://localhost:5000/ws");
        var messages = Enumerable.Range(0, messageCount)
            .Select(i => $"Performance test message {i} - {DateTime.UtcNow:O}")
            .ToList();

        var receivedMessages = new ConcurrentQueue<string>();
        var receivedCount = 0;

        client.MessageReceived += (sender, message) =>
        {
            receivedMessages.Enqueue(message);
            Interlocked.Increment(ref receivedCount);
        };

        // Act
        await client.ConnectAsync();
        var stopwatch = Stopwatch.StartNew();

        var sendTasks = messages.Select(async msg =>
        {
            await client.SendAsync(msg);
        });

        await Task.WhenAll(sendTasks);

        // Wait for all messages to be received
        var timeout = TimeSpan.FromSeconds(30);
        var start = DateTime.UtcNow;
        while (receivedCount < messageCount && DateTime.UtcNow - start < timeout)
        {
            await Task.Delay(10);
        }

        stopwatch.Stop();

        // Assert and Report
        _output.WriteLine($"Throughput Test Results:");
        _output.WriteLine($"  Messages Sent: {messageCount}");
        _output.WriteLine($"  Messages Received: {receivedCount}");
        _output.WriteLine($"  Time Elapsed: {stopwatch.ElapsedMilliseconds}ms");
        _output.WriteLine($"  Throughput: {messageCount / (stopwatch.ElapsedMilliseconds / 1000.0):F2} messages/second");

        Assert.Equal(messageCount, receivedCount);
        await client.DisconnectAsync();
    }

    [Fact]
    public async Task WebSocket_MemoryUsageTest()
    {
        // Arrange
        const int connectionCount = 50;
        var initialMemory = GC.GetTotalMemory(true);
        var clients = new List<ReconnectingWebSocketClient>();

        try
        {
            // Act - Create connections
            for (int i = 0; i < connectionCount; i++)
            {
                var client = new ReconnectingWebSocketClient("ws://localhost:5000/ws");
                clients.Add(client);
                await client.ConnectAsync();
            }

            var afterConnectionMemory = GC.GetTotalMemory(false);
            var memoryPerConnection = (afterConnectionMemory - initialMemory) / connectionCount;

            // Send messages
            var tasks = clients.Select(async (client, index) =>
            {
                for (int i = 0; i < 10; i++)
                {
                    await client.SendAsync($"Memory test message {i} from client {index}");
                    await Task.Delay(10);
                }
            });

            await Task.WhenAll(tasks);

            var afterMessagesMemory = GC.GetTotalMemory(false);

            // Assert and Report
            _output.WriteLine($"Memory Usage Test Results:");
            _output.WriteLine($"  Initial Memory: {initialMemory / 1024:N0} KB");
            _output.WriteLine($"  After Connections: {afterConnectionMemory / 1024:N0} KB");
            _output.WriteLine($"  After Messages: {afterMessagesMemory / 1024:N0} KB");
            _output.WriteLine($"  Memory per Connection: {memoryPerConnection / 1024:N0} KB");

            Assert.True(memoryPerConnection < 50 * 1024, "Memory per connection should be less than 50KB");
        }
        finally
        {
            // Cleanup
            foreach (var client in clients)
            {
                await client.DisconnectAsync();
                client.Dispose();
            }

            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
        }
    }

    private async Task<ConnectionResult> CreateConnectionAndSendMessages(int connectionId, int messageCount)
    {
        var result = new ConnectionResult { ConnectionId = connectionId };
        var latencies = new List<double>();

        try
        {
            var client = new ReconnectingWebSocketClient("ws://localhost:5000/ws");
            await client.ConnectAsync();

            for (int i = 0; i < messageCount; i++)
            {
                var stopwatch = Stopwatch.StartNew();
                await client.SendAsync($"Message {i} from connection {connectionId}");

                // Simple echo response timing (in real scenario, you'd wait for response)
                await Task.Delay(1); // Simulate network latency
                stopwatch.Stop();

                latencies.Add(stopwatch.Elapsed.TotalMilliseconds);
                result.MessagesSent++;
            }

            await client.DisconnectAsync();
            client.Dispose();

            result.Success = true;
            result.AverageLatencyMs = latencies.Average();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection {ConnectionId} failed", connectionId);
            result.Success = false;
            result.Error = ex.Message;
        }

        return result;
    }

    private class ConnectionResult
    {
        public int ConnectionId { get; set; }
        public bool Success { get; set; }
        public int MessagesSent { get; set; }
        public double AverageLatencyMs { get; set; }
        public string? Error { get; set; }
    }
}

public class XUnitLogger<T> : ILogger<T>
{
    private readonly ITestOutputHelper _output;

    public XUnitLogger(ITestOutputHelper output)
    {
        _output = output;
    }

    public IDisposable BeginScope<TState>(TState state) => null!;
    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        _output.WriteLine($"[{logLevel}] {formatter(state, exception)}");
    }
}
```

## Production Deployment and Monitoring

### Docker Configuration

Create a production-ready Docker setup:

```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files
COPY ["WebSocketGuide.Server/WebSocketGuide.Server.csproj", "WebSocketGuide.Server/"]
COPY ["WebSocketGuide.Core/WebSocketGuide.Core.csproj", "WebSocketGuide.Core/"]

# Restore dependencies
RUN dotnet restore "WebSocketGuide.Server/WebSocketGuide.Server.csproj"

# Copy source code
COPY . .

# Build application
WORKDIR "/src/WebSocketGuide.Server"
RUN dotnet build "WebSocketGuide.Server.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "WebSocketGuide.Server.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy published app
COPY --from=publish /app/publish .

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Configure ASP.NET Core
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["dotnet", "WebSocketGuide.Server.dll"]
```

### Kubernetes Deployment

Deploy with proper scaling and monitoring:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
  labels:
    app: websocket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket-server
  template:
    metadata:
      labels:
        app: websocket-server
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '8080'
        prometheus.io/path: '/metrics'
    spec:
      containers:
        - name: websocket-server
          image: your-registry/websocket-server:latest
          ports:
            - containerPort: 8080
              name: http
              protocol: TCP
          env:
            - name: ASPNETCORE_ENVIRONMENT
              value: 'Production'
            - name: WebSocket__MaxConnections
              value: '10000'
            - name: WebSocket__Redis__ConnectionString
              valueFrom:
                secretKeyRef:
                  name: websocket-secrets
                  key: redis-connection-string
            - name: Logging__LogLevel__Default
              value: 'Information'
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '1Gi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: websocket-config
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - websocket-server
                topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  labels:
    app: websocket-server
spec:
  type: ClusterIP
  selector:
    app: websocket-server
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  sessionAffinity: ClientIP # Important for WebSocket connections
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: websocket_active_connections
        target:
          type: AverageValue
          averageValue: '1000'

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: websocket-config
data:
  appsettings.Production.json: |
    {
      "Logging": {
        "LogLevel": {
          "Default": "Information",
          "Microsoft": "Warning",
          "Microsoft.Hosting.Lifetime": "Information"
        }
      },
      "WebSocket": {
        "MaxConnections": 10000,
        "ReceiveBufferSize": 4096,
        "KeepAliveIntervalSeconds": 30,
        "EnableCompression": true,
        "RateLimit": {
          "Enabled": true,
          "RequestsPerMinute": 120,
          "BurstSize": 20
        }
      },
      "Monitoring": {
        "EnableMetrics": true,
        "EnableHealthChecks": true,
        "MetricsEndpoint": "/metrics",
        "HealthEndpoint": "/health"
      }
    }
```

### Azure Service Fabric Configuration

For enterprise deployments on Azure Service Fabric:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ApplicationManifest ApplicationTypeName="WebSocketGuideType"
                     ApplicationTypeVersion="1.0.0"
                     xmlns="http://schemas.microsoft.com/2011/01/fabric"
                     xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Parameters>
    <Parameter Name="WebSocketServer_InstanceCount" DefaultValue="-1" />
    <Parameter Name="WebSocketServer_MaxConnections" DefaultValue="10000" />
    <Parameter Name="Redis_ConnectionString" DefaultValue="" />
  </Parameters>

  <ServiceManifestImport>
    <ServiceManifestRef ServiceManifestName="WebSocketServerPkg" ServiceManifestVersion="1.0.0" />
    <ConfigOverrides>
      <ConfigOverride Name="Config">
        <Settings>
          <Section Name="WebSocket">
            <Parameter Name="MaxConnections" Value="[WebSocketServer_MaxConnections]" />
          </Section>
          <Section Name="Redis">
            <Parameter Name="ConnectionString" Value="[Redis_ConnectionString]" />
          </Section>
        </Settings>
      </ConfigOverride>
    </ConfigOverrides>
    <Policies>
      <EndpointBindingPolicy EndpointRef="ServiceEndpoint" CertificateRef="WebSocketServerCert"/>
    </Policies>
  </ServiceManifestImport>

  <DefaultServices>
    <Service Name="WebSocketServer" ServicePackageActivationMode="ExclusiveProcess">
      <StatelessService ServiceTypeName="WebSocketServerType" InstanceCount="[WebSocketServer_InstanceCount]">
        <SingletonPartition />
      </StatelessService>
    </Service>
  </DefaultServices>

  <Certificates>
    <EndpointCertificate Name="WebSocketServerCert" X509FindType="FindByThumbprint" X509FindValue="[WebSocketServerCertThumbprint]" />
  </Certificates>
</ApplicationManifest>
```

## Best Practices

### Connection Management

- Implement automatic reconnection with exponential backoff
- Handle network state changes appropriately
- Use connection pooling for multiple connections
- Implement proper connection lifecycle management

### Security

- Always use WSS (WebSocket Secure) in production
- Implement proper authentication and authorization
- Validate all incoming messages
- Use rate limiting and throttling
- Implement CORS properly

### Performance

- Use binary messages for large data transfers
- Implement message compression
- Batch small messages when possible
- Use async/await properly to avoid blocking
- Configure appropriate buffer sizes

### Error Handling

- Implement comprehensive error handling
- Log errors with appropriate detail levels
- Provide graceful degradation
- Handle partial message failures
- Implement circuit breaker pattern

### Monitoring

- Track connection metrics (open/close/error rates)
- Monitor message throughput and latency
- Log slow message processing
- Implement health checks
- Use distributed tracing for debugging

## Troubleshooting Common Issues

### Connection Problems

**Issue**: WebSocket connections are being refused or timing out **Solution**:
Check firewall settings, proxy configurations, and ensure your server is
properly configured to accept WebSocket upgrades. Verify the Origin header is in
your allowed origins list.

**Issue**: Connections drop frequently in production **Solution**: Implement
proper heartbeat/ping mechanisms, check load balancer configuration for sticky
sessions, and ensure your connection timeout settings are appropriate.

**Issue**: Memory leaks with long-running connections **Solution**: Properly
implement IDisposable patterns, use weak event subscriptions where appropriate,
and monitor memory usage with diagnostic tools like PerfView or Application
Insights.

### Performance Issues

**Issue**: High CPU usage with many concurrent connections **Solution**: Profile
your message handling code, consider using channels for message processing, and
ensure you're not blocking async operations.

**Issue**: Message delivery delays under load **Solution**: Implement message
queuing, consider batching small messages, and optimize your JSON serialization
with source generators.

**Issue**: SignalR group operations are slow **Solution**: Use Redis backplane
for scale-out scenarios, optimize group membership operations, and consider
message filtering strategies.

### Authentication and Authorization Issues

**Issue**: JWT tokens expiring during long-lived connections **Solution**:
Implement token refresh mechanisms, use shorter-lived access tokens with refresh
tokens, or implement connection re-authentication flows.

**Issue**: CORS errors in browser clients **Solution**: Configure CORS properly
in your ASP.NET Core application, ensure your allowed origins include the
correct protocols and ports.

## Conclusion

C# and .NET provide a comprehensive, mature, and powerful platform for WebSocket
development. From the low-level `ClientWebSocket` API that gives you complete
control over the connection lifecycle, to high-level frameworks like SignalR
that abstract away the complexity of real-time communication, the .NET ecosystem
has solutions for every use case.

Key takeaways from this guide:

- **Choose the Right Approach**: Use `ClientWebSocket` for maximum control,
  ASP.NET Core WebSocket middleware for custom server implementations, and
  SignalR for rapid development of real-time applications.

- **Implement Robust Error Handling**: WebSocket connections are inherently
  unreliable due to network conditions. Implement comprehensive reconnection
  strategies, circuit breakers, and graceful degradation.

- **Design for Scale**: Consider connection pooling, message batching, Redis
  backplanes for SignalR, and horizontal scaling strategies from the beginning.

- **Prioritize Security**: Always use WSS in production, implement proper
  authentication and authorization, validate all inputs, and follow security
  best practices.

- **Monitor and Observe**: Implement comprehensive monitoring, health checks,
  and distributed tracing to understand your WebSocket application's behavior in
  production.

- **Test Thoroughly**: Use the testing patterns demonstrated in this guide to
  ensure your WebSocket implementation works correctly under load and handles
  edge cases gracefully.

The .NET ecosystem's strong typing, excellent tooling, cross-platform
capabilities, and enterprise-grade features make it an excellent choice for
building robust, scalable, and maintainable WebSocket applications. Whether
you're building a simple chat application, a real-time collaborative tool, or a
high-frequency trading platform, .NET has the tools and frameworks you need to
succeed.

With the patterns, practices, and code examples provided in this guide, you have
everything needed to implement production-ready WebSocket applications that can
handle thousands of concurrent connections while maintaining excellent
performance, security, and reliability.

### Monitoring

- Track connection metrics
- Monitor message throughput
- Log performance metrics
- Implement health checks
- Use distributed tracing for debugging

## The .NET Advantage for Enterprise WebSocket Solutions

The .NET ecosystem's approach to WebSocket development reflects Microsoft's
broader strategy of providing comprehensive, enterprise-ready solutions. This
isn't just about providing WebSocket APIs - it's about integrating WebSocket
capabilities throughout the entire platform. From Azure SignalR Service for
managed WebSocket infrastructure to Visual Studio's sophisticated debugging
capabilities for WebSocket connections, the entire toolchain is optimized for
productive development.

The evolution from .NET Framework to .NET Core and now .NET 6+ represents a
fundamental shift in how Microsoft approaches web development. The platform is
now truly cross-platform, high-performance, and cloud-native. For WebSocket
applications, this means being able to develop on any operating system, deploy
to any cloud provider, and achieve performance that rivals or exceeds
traditional compiled languages. The performance improvements in recent .NET
versions have been particularly impressive for I/O-bound operations like
WebSocket communication.

Integration with the broader Microsoft ecosystem provides unique advantages for
enterprise WebSocket applications. Azure Active Directory integration simplifies
authentication, Application Insights provides comprehensive monitoring, and
Azure DevOps enables sophisticated CI/CD pipelines. For organizations already
invested in the Microsoft ecosystem, these integrations reduce development time
and operational complexity significantly. The ability to use the same identity
provider, monitoring solution, and deployment pipeline for both traditional web
applications and WebSocket services simplifies the overall architecture.

## Frequently Asked Questions

### How do I use WebSockets in C# .NET?

Use `ClientWebSocket` for clients and ASP.NET Core WebSocket middleware for
servers. ASP.NET Core has built-in WebSocket support via `UseWebSockets()`
middleware. For higher-level abstractions, use SignalR which adds automatic
reconnection and hub-based messaging on top of WebSockets.

### What is the difference between SignalR and WebSockets?

WebSockets are a raw protocol for bidirectional communication. SignalR is a
Microsoft library built on top of WebSockets that adds features like automatic
reconnection, fallback transports, hub-based routing, and strongly typed
messages. SignalR uses WebSockets when available and falls back to other
transports.

### Can I use WebSockets in Unity with C#?

Yes. Use the `ClientWebSocket` class from `System.Net.WebSockets` or third-party
libraries like NativeWebSocket. Unity supports WebSocket connections for
multiplayer games, real-time data sync, and server communication across all
platforms.

## Related Content

- [Java WebSocket Guide](/guides/languages/java/) — Spring Boot and Jakarta EE
  WebSocket implementation
- [JavaScript WebSocket Guide](/guides/languages/javascript/) — browser API and
  Node.js patterns
- [Building a WebSocket Application](/guides/building-a-websocket-app/) —
  hands-on tutorial with cursor sharing
- [WebSocket Security Guide](/guides/security/) — authentication, TLS, and
  protection patterns
- [WebSockets at Scale](/guides/websockets-at-scale/) — architecture for
  millions of concurrent connections
