import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config';

/**
 * SyncKit TypeScript Reference Server
 * 
 * Production-ready WebSocket server for real-time synchronization
 */

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // TODO: Configure in production
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: process.uptime(),
  });
});

// Server info endpoint
app.get('/', (c) => {
  return c.json({
    name: 'SyncKit Server',
    version: '0.1.0',
    description: 'Production-ready WebSocket sync server',
    endpoints: {
      health: '/health',
      ws: '/ws',
      auth: '/auth',
      sync: '/sync',
    },
  });
});

// Start server
const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
});

console.log(`🚀 SyncKit Server running on ${server.hostname}:${server.port}`);
console.log(`📊 Health check: http://${server.hostname}:${server.port}/health`);
console.log(`🔒 Environment: ${config.nodeEnv}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

export { app, server };
