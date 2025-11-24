# Getting Started with SyncKit

**Build offline-first apps in 5 minutes.**

SyncKit is a production-ready sync engine that makes building local-first applications trivial. No vendor lock-in, true offline support, and automatic conflict resolution—all in a ~58KB gzipped bundle.

> **What you'll build:** A todo app that works offline, persists data locally, and is ready for real-time sync (coming soon)—in just 5 minutes.
>
> **v0.1.0 Note:** This version focuses on local-first storage and persistence. Network sync and cross-tab synchronization are planned for future releases.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 16+** or **Bun** installed
- Basic knowledge of JavaScript/TypeScript
- **5 minutes** of your time

That's it! No backend setup, no database configuration, no complicated tooling.

---

## Installation

Install SyncKit with your favorite package manager:

```bash
# npm
npm install @synckit/sdk

# yarn
yarn add @synckit/sdk

# pnpm
pnpm add @synckit/sdk

# bun
bun add @synckit/sdk
```

**For React projects**, the React hooks are included in the SDK package (no separate install needed).

> **Note:** Vue and Svelte adapters are coming soon! For now, you can use the core SDK with any framework.

---

## Quick Start: Your First Synced Document

### Step 1: Initialize SyncKit (30 seconds)

Create a SyncKit instance. It works offline-only by default—no server required!

```typescript
import { SyncKit } from '@synckit/sdk'

// Initialize SyncKit (works offline-only)
const sync = new SyncKit({
  storage: 'indexeddb',
  name: 'my-app'
})

// Must call init() before using
await sync.init()

console.log('SyncKit initialized!')
```

**What just happened?**
- SyncKit initialized with IndexedDB storage
- No server connection needed—it works 100% offline
- Data persists across browser sessions

---

### Step 2: Create Your First Document (1 minute)

Let's create a todo item and sync it:

```typescript
interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

// Get a document reference
const todo = sync.document<Todo>('todo-1')

// Initialize the document
await todo.init()

// Set the initial data
await todo.update({
  id: 'todo-1',
  text: 'Learn SyncKit',
  completed: false,
  createdAt: Date.now()
})

console.log('Todo created!')

// Read it back
const data = todo.get()
console.log('Todo:', data)
// Output: { id: 'todo-1', text: 'Learn SyncKit', completed: false, createdAt: 1732147200000 }
```

**What just happened?**
- Created a typed document with ID `'todo-1'`
- Data saved to IndexedDB automatically
- Fully type-safe with TypeScript
- Zero latency—instant write!

---

### Step 3: Subscribe to Real-Time Updates (1 minute)

Documents are **reactive**—subscribe to get notified of changes:

```typescript
// Subscribe to changes
const unsubscribe = todo.subscribe((data) => {
  console.log('Todo updated:', data)
})

// Update the todo
await todo.update({ completed: true })
// Output: "Todo updated: { id: 'todo-1', text: 'Learn SyncKit', completed: true, ... }"

// Update multiple fields at once
await todo.update({
  text: 'Master SyncKit',
  completed: false
})
// Output: "Todo updated: { id: 'todo-1', text: 'Master SyncKit', completed: false, ... }"

// Clean up when done
unsubscribe()
```

**What just happened?**
- Subscribed to real-time updates
- Partial updates automatically merge with existing data
- Subscriber fires immediately with current state + on every change
- Works across browser tabs automatically!

---

### Step 4: Test Offline Persistence (1 minute)

Refresh your browser or close and reopen—your data persists!

```typescript
// This works even after browser refresh
const todo = sync.document<Todo>('todo-1')
await todo.init()

const data = todo.get()
console.log('Todo still here:', data)
// Output: { id: 'todo-1', text: 'Master SyncKit', completed: false, ... }
```

**Test it yourself:**
1. Run the code above in your browser console
2. Refresh the page (Ctrl/Cmd + R)
3. Run `todo.get()` again—data is still there!

---

### Step 5: Multi-Tab Sync ⚠️ (Coming in Future Version)

**Note:** Cross-tab synchronization is not yet implemented in v0.1.0. This feature is planned for a future release.

**Planned behavior (future version):**

Open your app in **two browser tabs**. Changes in one tab will appear in the other!

**In Tab 1:**
```typescript
const todo = sync.document<Todo>('todo-1')
await todo.init()
todo.subscribe((data) => {
  console.log('Tab 1 received:', data.text)
})
```

**In Tab 2:**
```typescript
const todo = sync.document<Todo>('todo-1')
await todo.init()
await todo.update({ text: 'Hello from Tab 2!' })
```

**What will happen (when implemented):**
- Real-time cross-tab synchronization
- No server required—completely client-side
- Instant updates between tabs

**Current v0.1.0 behavior:** Each tab maintains its own state. Refreshing a tab will load the latest data from IndexedDB, but live updates between tabs are not yet supported.

---

## 🎉 Congratulations!

**You just built offline-first, persistent storage in 5 minutes!**

Here's what your app can do in v0.1.0:
- ✅ **Works completely offline** - No server needed
- ✅ **Instant updates** - <1ms local operations
- ✅ **Persists data** - Survives browser restarts
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Conflict-free** - Automatic conflict resolution (LWW)
- ⚠️ **Cross-tab sync** - Coming in future version

---

## React Quick Start

Using React? Here's the same example with hooks:

```tsx
import React, { useEffect, useState } from 'react'
import { SyncKit } from '@synckit/sdk'
import { SyncProvider, useSyncDocument } from '@synckit/sdk/react'

interface Todo {
  id: string
  text: string
  completed: boolean
}

function TodoApp() {
  // useSyncDocument returns [data, { set, update, delete }, doc]
  const [todo, { update }] = useSyncDocument<Todo>('todo-1')

  if (!todo || !todo.text) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => update({ completed: e.target.checked })}
      />
      <input
        type="text"
        value={todo.text}
        onChange={(e) => update({ text: e.target.value })}
      />
    </div>
  )
}

export default function App() {
  const [synckit, setSynckit] = useState<SyncKit | null>(null)

  useEffect(() => {
    const initSync = async () => {
      const sync = new SyncKit({
        storage: 'indexeddb',
        name: 'my-app'
      })
      await sync.init()
      setSynckit(sync)
    }
    initSync()
  }, [])

  if (!synckit) {
    return <div>Initializing...</div>
  }

  return (
    <SyncProvider synckit={synckit}>
      <TodoApp />
    </SyncProvider>
  )
}
```

**That's it!** The `useSyncDocument` hook handles subscriptions, updates, and cleanup automatically.

---

## Next Steps

Now that you've mastered the basics, here's what to explore next:

### 🔌 Connect to a Backend Server ⚠️ (Coming in Future Version)

**Note:** Network sync features are not yet implemented in v0.1.0. This is planned for a future release.

**Planned behavior (future version):**

```typescript
const sync = new SyncKit({
  serverUrl: 'ws://localhost:8080',  // ⚠️ NOT YET FUNCTIONAL in v0.1.0
  storage: 'indexeddb',
  name: 'my-app'
})
await sync.init()
// Future: Will automatically sync with server
```

**Current v0.1.0:** The `serverUrl` option is accepted but not used. SyncKit works offline-only.

See: [Server Setup Guide](./server-setup.md) (for future implementation reference)

### 📱 Add to Your Existing App

Integrate SyncKit into your React, Vue, or Svelte app:

- [React Integration Guide](./react-integration.md)
- [Vue Integration Guide](./vue-integration.md) *(coming soon)*
- [Svelte Integration Guide](./svelte-integration.md) *(coming soon)*

### 🎓 Learn Core Concepts

Deep-dive into how SyncKit works:

- [Offline-First Patterns](./offline-first.md) - True offline-first architecture
- [Conflict Resolution](./conflict-resolution.md) - How conflicts are handled automatically
- [Performance Optimization](./performance.md) - Get the most out of SyncKit
- [Testing Guide](./testing.md) - Test your offline-first app

### 🚀 Explore Examples

See SyncKit in action with complete example apps:

- [Todo App](../../examples/todo-app/) - Simple CRUD with filters
- [Collaborative Editor](../../examples/collaborative-editor/) - Real-time text editing
- [Project Management App](../../examples/real-world/) - Complex multi-document app

### 📚 API Reference

Explore the complete API:

- [SDK API Reference](../api/SDK_API.md) - Complete API documentation
- [React Hooks API](../api/react-hooks.md) - React-specific hooks
- [Architecture Overview](../architecture/ARCHITECTURE.md) - How SyncKit works under the hood

---

## Common Issues

### "Module not found: @synckit/sdk"

**Solution:** Make sure you've installed the package:
```bash
npm install @synckit/sdk
```

React hooks are included in the main SDK package.

---

### "QuotaExceededError: IndexedDB quota exceeded"

**Solution:** Clear old data or increase quota:
```typescript
// Option 1: Delete specific documents
await sync.deleteDocument('todo-1')  // Delete entire document by ID

// Option 2: Delete a field from a document
const todo = sync.document<Todo>('todo-1')
await todo.init()
await todo.delete('dueDate')  // Deletes the 'dueDate' field

// Option 3: Clear all data
await sync.clearAll()

// Option 4: Request persistent storage (Chrome/Edge)
if (navigator.storage && navigator.storage.persist) {
  await navigator.storage.persist()
}
```

**Note:** `doc.delete(field)` deletes a **field**, not the whole document. Use `sync.deleteDocument(id)` to delete entire documents.

See: [Storage Management Guide](./storage-management.md)

---

### Changes not syncing across tabs ⚠️

**Note:** Cross-tab synchronization is not yet implemented in v0.1.0.

**Current behavior:** Each browser tab maintains its own state. When you refresh a tab, it will load the latest data from IndexedDB, but live updates between tabs are not yet supported.

**Workaround:** Manually refresh the page in other tabs to see updates, or wait for cross-tab sync in a future version.

**Future implementation:** When cross-tab sync is added, ensure you're using the same document ID in both tabs:

```typescript
// ✅ Correct - Same ID in both tabs
const todo = sync.document<Todo>('todo-1')

// ❌ Wrong - Different IDs won't sync
const todo = sync.document<Todo>('todo-' + Math.random())
```

---

### TypeScript errors: "Type 'X' is not assignable to type 'Y'"

**Solution:** Make sure your document interface matches the data structure:

```typescript
// Define your interface
interface Todo {
  id: string
  text: string
  completed: boolean
  // Optional fields must be marked with ?
  dueDate?: Date
}

// Use it with your document
const todo = sync.document<Todo>('todo-1')
```

---

## Get Help

Need assistance?

- 📖 **[Documentation](../README.md)** - Comprehensive guides and API reference
- 💬 **[Discord Community](#)** - Get help from the community *(coming soon)*
- 🐛 **[GitHub Issues](https://github.com/Dancode-188/synckit/issues)** - Report bugs or request features
- 📧 **[Email Support](mailto:danbitengo@gmail.com)** - Direct support for enterprise users

---

## What Makes SyncKit Different?

| Feature | SyncKit | Firebase | Supabase | Yjs | Automerge |
|---------|:-------:|:--------:|:--------:|:---:|:---------:|
| **True Offline-First** | ✅ Native | ⚠️ Cache only | ❌ None | ✅ Full | ✅ Full |
| **Works Without Server** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Bundle Size** | **~58KB** (~45KB lite) | ~150KB | ~45KB | ~19KB | ~60-78KB |
| **Automatic Conflicts** | ✅ LWW | ✅ LWW | ⚠️ Manual | ✅ CRDT | ✅ CRDT |
| **Self-Hosted** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multi-Language Server** | ✅ Yes | ❌ No | ⚠️ Postgres | ❌ No | ❌ No |

**SyncKit = True offline-first + No vendor lock-in + Production ready**

---

## Summary

In this guide, you learned how to:

- ✅ Install and initialize SyncKit
- ✅ Create and update synced documents
- ✅ Subscribe to real-time changes
- ✅ Test offline persistence
- ✅ Use React hooks for easier integration
- ⚠️ Understand v0.1.0 limitations (cross-tab sync coming soon)

**Time taken:** 5 minutes ⏱️
**Lines of code:** ~20 lines 📝
**Result:** Production-ready offline-first storage 🚀

Ready to build something amazing? Check out the [examples](../../examples/) or dive into [offline-first patterns](./offline-first.md)!

---

**Welcome to the offline-first revolution! 🎉**
