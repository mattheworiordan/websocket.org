import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Read lastUpdated from content frontmatter for sitemap lastmod
function getLastmod(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '');
    const basePath = path.join('src/content/docs', pathname);
    for (const ext of ['.md', '.mdx', '/index.md', '/index.mdx']) {
      const filePath = basePath + ext;
      if (fs.existsSync(filePath)) {
        const { data } = matter(fs.readFileSync(filePath, 'utf-8'));
        if (data.lastUpdated) return new Date(data.lastUpdated).toISOString();
        if (data.date) return new Date(data.date).toISOString();
        break;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

// https://astro.build/config
export default defineConfig({
  site: 'https://websocket.org',
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = getLastmod(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
    starlight({
      title: 'WebSocket.org',
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/favicon.svg',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            href: '/apple-touch-icon.png',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            content: '#0d9488',
          },
        },
      ],
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/mattheworiordan/websocket.org',
        },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            {
              label: 'Core Concepts',
              items: [
                { label: 'The Road to WebSockets', link: '/guides/road-to-websockets/' },
                { label: 'WebSocket Protocol', link: '/guides/websocket-protocol/' },
                { label: 'The Future of WebSockets', link: '/guides/future-of-websockets/' },
                { label: 'WebSockets and AI', link: '/guides/websockets-and-ai/' },
              ],
            },
            {
              label: 'Implementation',
              collapsed: true,
              items: [
                { label: 'Building a WebSocket App', link: '/guides/building-a-websocket-app/' },
                { label: 'WebSocket Reconnection', link: '/guides/reconnection/' },
                { label: 'Heartbeat & Keep-Alive', link: '/guides/heartbeat/' },
                { label: 'Error Handling', link: '/guides/error-handling/' },
                { label: 'Connection Limits', link: '/guides/connection-limits/' },
                { label: 'WebSockets at Scale', link: '/guides/websockets-at-scale/' },
                { label: 'Best Practices', link: '/guides/best-practices/' },
              ],
            },
            {
              label: 'Security',
              collapsed: true,
              items: [
                { label: 'Authentication', link: '/guides/authentication/' },
                { label: 'Security Hardening', link: '/guides/security/' },
              ],
            },
            {
              label: 'Testing',
              collapsed: true,
              items: [{ label: 'Autobahn TestSuite', link: '/guides/testing/autobahn/' }],
            },
            {
              label: 'Troubleshooting',
              collapsed: true,
              items: [
                {
                  label: '403 Forbidden Errors',
                  link: '/guides/troubleshooting/403/',
                },
                {
                  label: 'Connection Refused',
                  link: '/guides/troubleshooting/connection-refused/',
                },
                { label: 'CORS & Cross-Origin', link: '/guides/troubleshooting/cors/' },
                {
                  label: 'Debugging in Chrome DevTools',
                  link: '/guides/troubleshooting/debugging-chrome/',
                },
                {
                  label: 'Timeout & Dropped Connections',
                  link: '/guides/troubleshooting/timeout/',
                },
              ],
            },
            {
              label: 'Infrastructure',
              collapsed: true,
              items: [
                { label: 'Nginx Configuration', link: '/guides/infrastructure/nginx/' },
                { label: 'AWS ALB Configuration', link: '/guides/infrastructure/aws/alb/' },
                { label: 'Cloudflare Configuration', link: '/guides/infrastructure/cloudflare/' },
                { label: 'Kubernetes Ingress', link: '/guides/infrastructure/kubernetes/' },
              ],
            },
            {
              label: 'Frameworks',
              collapsed: true,
              items: [
                { label: 'React', link: '/guides/frameworks/react/' },
                { label: 'Next.js', link: '/guides/frameworks/nextjs/' },
                { label: 'Express.js', link: '/guides/frameworks/express/' },
                { label: 'Django', link: '/guides/frameworks/django/' },
                { label: 'FastAPI', link: '/guides/frameworks/fastapi/' },
                { label: 'Spring Boot', link: '/guides/frameworks/spring-boot/' },
              ],
            },
            {
              label: 'Use Cases',
              collapsed: true,
              items: [
                { label: 'Building a Chat App', link: '/guides/use-cases/chat/' },
                { label: 'Real-time Notifications', link: '/guides/use-cases/notifications/' },
                { label: 'AI/LLM Token Streaming', link: '/guides/use-cases/ai-streaming/' },
              ],
            },
            {
              label: 'Languages',
              collapsed: true,
              items: [
                { label: 'JavaScript & Node.js', link: '/guides/languages/javascript/' },
                { label: 'Python', link: '/guides/languages/python/' },
                { label: 'Go', link: '/guides/languages/go/' },
                { label: 'Rust', link: '/guides/languages/rust/' },
                { label: 'Java', link: '/guides/languages/java/' },
                { label: 'C# & .NET', link: '/guides/languages/csharp/' },
                { label: 'PHP', link: '/guides/languages/php/' },
              ],
            },
          ],
        },
        {
          label: 'Protocol Comparisons',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/comparisons/' },
            { label: 'WebSockets vs HTTP', link: '/comparisons/http/' },
            { label: 'WebSockets vs SSE', link: '/comparisons/sse/' },
            { label: 'WebSockets vs Long Polling', link: '/comparisons/long-polling/' },
            { label: 'WebSockets vs WebTransport', link: '/comparisons/webtransport/' },
            { label: 'WebSockets vs MQTT', link: '/comparisons/mqtt/' },
            { label: 'WebSockets vs WebRTC', link: '/comparisons/webrtc/' },
            { label: 'WebSockets vs gRPC', link: '/comparisons/grpc/' },
            { label: 'WebSocket vs REST API', link: '/comparisons/rest/' },
            { label: 'Socket.IO vs WebSocket', link: '/comparisons/socket-io/' },
            { label: 'SignalR vs WebSocket', link: '/comparisons/signalr/' },
            { label: 'Managed Services Compared', link: '/comparisons/managed-services/' },
            { label: 'Decision Matrix', link: '/comparisons/decision-guide/' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            {
              label: 'API Reference',
              items: [
                { label: 'WebSocket API', link: '/reference/websocket-api/' },
                { label: 'Close Codes', link: '/reference/close-codes/' },
              ],
            },
            {
              label: 'Protocol & Transport',
              items: [
                { label: 'WebSocket Handshake', link: '/reference/handshake/' },
                { label: 'WebSocket Headers', link: '/reference/headers/' },
                { label: 'WebSocket Ports', link: '/reference/ports/' },
                { label: 'wss vs ws', link: '/reference/wss-vs-ws/' },
                { label: 'WebSocket vs TCP', link: '/reference/websocket-vs-tcp/' },
                { label: 'Browser Support', link: '/reference/browser-support/' },
              ],
            },
            {
              label: 'Standards',
              items: [{ label: 'Standards Tracker', link: '/standards/' }],
            },
          ],
        },
        {
          label: 'Tools',
          collapsed: true,
          items: [
            { label: 'Echo Server', link: '/tools/websocket-echo-server/' },
            { label: 'WebSocket vs SSE vs HTTP', link: '/tools/choose-a-protocol/' },
          ],
        },
        {
          label: 'Resources',
          collapsed: true,
          items: [
            { label: 'WebSocket Resources', link: '/resources/websocket-resources/' },
            { label: 'Community', link: '/resources/community/' },
            { label: '📖 Once Upon a Socket', link: '/once-upon-a-socket' },
          ],
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/mattheworiordan/websocket.org/edit/main/',
      },
      components: {
        Head: './src/components/head.astro',
        // Sidebar: './src/components/Sidebar.astro',
        ContentPanel: './src/components/ContentWrapper.astro',
        PageFrame: './src/components/PageFrameWrapper.astro',
        PageTitle: './src/components/PageTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
    }),
  ],
});
