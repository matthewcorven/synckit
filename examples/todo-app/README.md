# SyncKit Todo App Example

A simple yet powerful todo list application demonstrating SyncKit's local-first sync capabilities.

## Features

✅ **Local-First Architecture**
- All data stored in IndexedDB
- Instant updates with zero latency
- Works offline by default

✅ **Real-Time Sync**
- Changes sync between browser tabs instantly
- Powered by SyncKit's WASM core
- Automatic conflict resolution with LWW (Last-Write-Wins)

✅ **Full CRUD Operations**
- Create todos
- Mark as complete/incomplete
- Delete individual todos
- Bulk delete completed todos

✅ **Filter Views**
- View all todos
- View only active (incomplete) todos
- View only completed todos

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **SyncKit** - Local-first sync engine (WASM + TypeScript)

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm/yarn/pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at http://localhost:3000

### Building for Production

```bash
npm run build
npm run preview
```

## How It Works

### SyncKit Integration

The app uses SyncKit's React hooks for seamless local-first functionality:

```tsx
import { useSyncDocument } from '@synckit/sdk/react'

// Hook into a synced document
const [document, { update }] = useSyncDocument<TodoListDocument>('todo-list')

// Update is automatic and persisted
await update({
  todos: { ...document.todos, [id]: newTodo },
  lastUpdated: Date.now()
})
```

### Architecture

```
User Interaction
       ↓
   React Component
       ↓
useSyncDocument Hook (SDK)
       ↓
SyncDocument API
       ↓
WASM Core (Rust)
       ↓
IndexedDB Storage
```

### Key Components

- **TodoApp.tsx** - Main component with state management
- **TodoItem.tsx** - Individual todo item component  
- **types.ts** - TypeScript definitions
- **App.tsx** - SyncProvider wrapper
- **main.tsx** - React entry point

## Testing

### Manual Testing

1. Add some todos
2. Mark some as complete
3. Open the app in another tab - changes sync instantly!
4. Close the browser and reopen - data persists

### Multi-Tab Sync

Open the app in multiple browser tabs to see real-time synchronization:

```bash
# Terminal 1
npm run dev

# Open http://localhost:3000 in multiple tabs
# Changes in one tab appear instantly in others
```

## Next Steps

This example demonstrates:
- ✅ Document-level sync with `useSyncDocument`
- ✅ IndexedDB persistence
- ✅ Type-safe operations
- ✅ Automatic conflict resolution

For more advanced features, see:
- **Collaborative Editor** - Text CRDT with character-level sync
- **Real-World Example** - Complex app with multiple document types

## Learn More

- [SyncKit Documentation](../../docs/README.md)
- [API Reference](../../docs/api/SDK_API.md)
- [Architecture](../../docs/architecture/ARCHITECTURE.md)

## License

MIT
