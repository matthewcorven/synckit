# SyncKit TypeScript Reference Server

Production-ready WebSocket server for real-time synchronization with SyncKit.

## Features

✅ **WebSocket Server** - Real-time bidirectional communication  
✅ **JWT Authentication** - Secure token-based auth  
✅ **PostgreSQL Storage** - Persistent document storage  
✅ **Redis Pub/Sub** - Multi-server coordination  
✅ **RBAC** - Document-level permissions  
✅ **Docker Ready** - Containerized deployment  

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Development

```bash
# Start development server (hot reload)
bun run dev
```

Server will start on http://localhost:8080

### Testing

```bash
# Run tests
bun test

# Watch mode
