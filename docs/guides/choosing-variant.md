# Choosing the Right SyncKit Variant

SyncKit ships with four optimized variants to balance bundle size with functionality. This guide helps you choose the right one for your use case.

---

## 🎯 Quick Decision Tree

```
Start here
│
├─ Do you need network synchronization with protocol support?
│  │
│  ├─ NO → Use Core-Lite variant
│  │       ✅ 43.8 KB gzipped (smallest)
│  │       ✅ Local-only sync
│  │       ✅ Perfect for offline-first apps without backend
│  │
│  └─ YES → Do you need collaborative text editing (Google Docs style)?
│     │
│     ├─ NO → Use Core variant
│     │        ✅ 49.0 KB gzipped
│     │        ✅ Core + Network Protocol
│     │        ✅ Perfect for most apps (80% of use cases)
│     │
│     └─ YES → Do you also need counters, sets, or other CRDTs?
│        │
│        ├─ NO → Use Text variant
│        │        ✅ 48.9 KB gzipped
│        │        ✅ Core + Text CRDT
│        │        ✅ Collaborative editors, notes
│        │
│        └─ YES → Use Full variant
│                 ✅ 48.9 KB gzipped
│                 ✅ All CRDTs included
│                 ✅ Whiteboards, design tools, advanced apps
```

---

## 📦 Variant Comparison

### Core-Lite Variant - 43.8 KB gzipped (Smallest)

**Import:**
```typescript
import { SyncKit } from '@synckit/sdk/core-lite'
```

**Includes:**
- ✅ Document sync (Last-Write-Wins)
- ✅ Vector clocks (causality tracking)
- ✅ Conflict resolution (automatic)
- ✅ Offline-first (works without network)
- ✅ IndexedDB persistence
- ❌ Network protocol (prost/protobuf)
- ❌ DateTime serialization (chrono)
- ❌ Delta computation (WasmDelta)
- ❌ Text CRDT
- ❌ Counters
- ❌ Sets

**Perfect for:**
- Local-only applications
- Offline-first apps without backend sync
- Browser extensions
- Electron apps with file-based storage
- Progressive Web Apps (PWAs) with local data
- Apps where bundle size is critical

**Real-world examples:**
- Todo apps with local storage
- Note-taking apps (without real-time collaboration)
- Settings/preferences management
- Form data persistence
- Shopping carts (local-only)

**Code example:**
```typescript
import { SyncKit } from '@synckit/sdk/core-lite'

const sync = new SyncKit({ storage: 'indexeddb' })

// Create a document
const todo = sync.document<Todo>('todo-123')
await todo.update({
  text: 'Buy milk',
  completed: false,
  priority: 'high'
})

// Works offline, persists to IndexedDB
// No network sync - perfect for local-first
```

**When to use:**
- ✅ You don't need server synchronization
- ✅ Local-only data storage is sufficient
- ✅ Want the absolute smallest bundle
- ✅ Building offline-first without backend

**When NOT to use:**
- ❌ You need server sync → Use Core variant
- ❌ You need collaborative text editing → Use Text variant
- ❌ You need advanced CRDTs → Use Full variant

**Bundle size savings:** 5.2 KB smaller than Core (10.6% reduction)

---

### Core Variant - 49.0 KB gzipped (Default, Recommended)

**Import:**
```typescript
import { SyncKit } from '@synckit/sdk/core'
// or default:
import { SyncKit } from '@synckit/sdk'
```

**Includes:**
- ✅ Everything in Core-Lite
- ✅ Network protocol (protobuf serialization)
- ✅ DateTime handling (chrono)
- ✅ Delta computation (WasmDelta)
- ✅ Server synchronization
- ❌ Text CRDT
- ❌ Counters
- ❌ Sets

**Perfect for:**
- Todo applications
- CRM systems
- Project management tools
- Dashboards and admin panels
- E-commerce applications
- Social media apps (posts, profiles)
- Settings sync across devices
- Form data with server sync
- **Any app that syncs structured data (JSON objects) with a server**

**Real-world examples:**
- [Project Management App](../../examples/project-management/) - Kanban board
- Trello-like task management
- Notion-like databases (without text editing)
- Asana-like project tracking
- Airtable-like data management

**Code example:**
```typescript
import { SyncKit } from '@synckit/sdk/core'

const sync = new SyncKit({
  serverUrl: 'https://api.example.com/sync',
  storage: 'indexeddb'
})

// Create a document
const task = sync.document<Task>('task-123')
await task.update({
  title: 'Build feature',
  status: 'in-progress',
  assignee: 'alice@example.com',
  dueDate: new Date('2025-12-01')
})

// Syncs automatically to server
// Works offline, queues operations
// Resolves conflicts automatically
```

**When to use:**
- ✅ You're building a CRUD app with server sync
- ✅ Data is structured (objects, arrays, primitives)
- ✅ You want network synchronization
- ✅ You don't need collaborative text editing
- ✅ **This is the recommended default for 80% of applications**

**When NOT to use:**
- ❌ You don't need server sync → Use Core-Lite (save 5 KB)
- ❌ You need Google Docs-style text editing → Use Text variant
- ❌ You need distributed counters/sets → Use Full variant

---

### Text Variant - 48.9 KB gzipped

**Import:**
```typescript
import { SyncKit } from '@synckit/sdk/text'
```

**Includes:**
- ✅ Everything in Core
- ✅ Text CRDT (YATA algorithm)
- ✅ Character-level conflict resolution
- ✅ Real-time collaborative editing
- ❌ Counters
- ❌ Sets
- ❌ Fractional Index

**Perfect for:**
- Collaborative text editors
- Note-taking applications
- Documentation tools
- Content management systems
- Markdown editors
- Code editors (collaborative coding)
- Comment sections (rich text)
- Chat applications with message editing

**Real-world examples:**
- [Collaborative Editor](../../examples/collaborative-editor/) - CodeMirror integration
- Google Docs-like apps
- Notion-like rich text
- Obsidian-like markdown editors
- Slack-like message editing
- GitHub-like code review comments

**Code example:**
```typescript
import { SyncKit } from '@synckit/sdk/text'

const sync = new SyncKit({ serverUrl: 'https://api.example.com/sync' })

// Create a text document
const doc = sync.text('document-123')

// Insert text at position 0
await doc.insert(0, 'Hello World')

// Delete characters
await doc.delete(6, 5) // Removes "World"

// Insert at position 6
await doc.insert(6, 'SyncKit')
// Result: "Hello SyncKit"

// Subscribe to changes from other users
doc.subscribe(content => {
  editor.setValue(content)
})

// Multiple users can edit simultaneously
// All edits converge to the same result
// No conflicts, no lost edits
```

**When to use:**
- ✅ You need collaborative text editing
- ✅ Multiple users typing in the same document
- ✅ Rich text or markdown editors
- ✅ Comment threads with editing
- ✅ Real-time document collaboration

**When NOT to use:**
- ❌ You only sync structured data → Use Core variant (same size, simpler API)
- ❌ Text is simple single-line inputs → Use Core variant (overkill for simple text)
- ❌ You don't have collaborative editing → Use Core variant

**Interesting insight:** Text variant is actually 0.1 KB **smaller** than Core variant due to how gzip compression works. The CRDT code is highly compressible.

---

### Full Variant - 48.9 KB gzipped

**Import:**
```typescript
import { SyncKit } from '@synckit/sdk/full'
```

**Includes:**
- ✅ Everything in Core
- ✅ Text CRDT
- ✅ PN-Counter (distributed counter)
- ✅ OR-Set (observed-remove set)
- ✅ Fractional Index (list positioning)

**Perfect for:**
- Whiteboards (shapes, positions)
- Design tools (layers, elements)
- Collaborative canvases
- Social features (likes, votes, followers)
- Tag management
- Collaborative lists with add/remove
- Complex multi-user applications
- Apps needing all CRDT types

**Real-world examples:**
- Miro-like whiteboards
- Figma-like design tools
- Instagram-like posts (with counters for likes)
- Tag systems with collaborative editing
- Collaborative task lists with reordering

**Code example:**
```typescript
import { SyncKit } from '@synckit/sdk/full'

const sync = new SyncKit({ serverUrl: 'https://api.example.com/sync' })

// Distributed counter (never conflicts)
const likes = sync.counter('post-123-likes')
await likes.increment()  // Client 1: +1
await likes.increment()  // Client 2: +1
// Result: 2 (both increments preserved, no conflicts)

// Observed-remove set
const tags = sync.set<string>('post-123-tags')
await tags.add('javascript')
await tags.add('typescript')
await tags.remove('javascript')
// Result: Set { 'typescript' }

// All users see the same state
// No conflicts, convergence guaranteed
```

**When to use:**
- ✅ You need distributed counters (likes, votes, view counts)
- ✅ You need collaborative sets (tags, members, permissions)
- ✅ You're building a whiteboard or design tool
- ✅ You need all CRDT types
- ✅ Complex collaboration patterns

**When NOT to use:**
- ❌ You don't need these advanced features → Use Core or Text variant
- ❌ Bundle size is critical → Use Core-Lite or Core variant

**Note:** Full variant is the same size as Text variant (48.9 KB) because CRDT code is minimal and highly compressible.

---

## 🔄 Switching Between Variants

Switching between variants is seamless - just change the import:

```typescript
// Before (core-lite)
import { SyncKit } from '@synckit/sdk/core-lite'

// After (need server sync)
import { SyncKit } from '@synckit/sdk/core'

// After (need text editing)
import { SyncKit } from '@synckit/sdk/text'

// All core APIs remain exactly the same!
// No breaking changes, just additional features available
```

**Important:** Don't mix imports from different variants in the same app:

```typescript
// ❌ BAD: Imports from multiple variants (duplicates WASM)
import { SyncKit } from '@synckit/sdk/core'
import { TextCRDT } from '@synckit/sdk/text'  // Imports separate WASM!

// ✅ GOOD: Import everything from one variant
import { SyncKit, TextCRDT } from '@synckit/sdk/text'
```

**Migration is non-breaking:**
- Data format is the same across all variants
- A document created with Core-Lite can be opened with Core, Text, or Full
- You can upgrade anytime without data migration

---

## 📊 Bundle Size Impact

Understanding the size trade-offs:

| Variant | WASM (gzipped) | SDK (gzipped) | Total | What You Get |
|---------|----------------|---------------|-------|--------------|
| core-lite | 43.8 KB | ~4 KB | **~48 KB** | Local-only sync |
| core | 49.0 KB | ~4 KB | **~53 KB** | + Server sync (default) |
| text | 48.9 KB | ~4 KB | **~53 KB** | + Text CRDT |
| full | 48.9 KB | ~4 KB | **~53 KB** | + All CRDTs |

**Key insights:**
1. SDK overhead is minimal (~4 KB). WASM dominates bundle size.
2. Core-Lite to Core: +5.2 KB for network protocol support
3. Core to Text/Full: Actually 0.1 KB **smaller** (gzip compression magic)
4. CRDTs add virtually no size due to code compression

**Comparison to alternatives:**

| Library | Size | Notes |
|---------|------|-------|
| **SyncKit Core-Lite** | **43.8 KB** | Smallest, local-only |
| **SyncKit Core** | **49.0 KB** | Recommended default |
| **SyncKit Text** | **48.9 KB** | Text CRDT included |
| **SyncKit Full** | **48.9 KB** | All features |
| Yjs | 65 KB | Text CRDT only |
| Firebase SDK | 150 KB | Plus server dependency |
| Automerge | 350 KB | Full CRDT suite |

**Even the Full variant is:**
- 1.3x smaller than Yjs (despite having more features)
- 3.1x smaller than Firebase
- 7.2x smaller than Automerge

---

## 🎓 Common Scenarios

### Scenario 1: Todo Application

**Recommended:** Core variant

**Why:**
- Structured data (tasks, status, due dates)
- Server sync for cross-device access
- No collaborative text editing needed
- Offline-first with automatic sync

**Bundle:** ~53 KB (SyncKit) + ~130 KB (React) = ~183 KB total

**Alternative:** Use Core-Lite (save 5 KB) if you don't need server sync

---

### Scenario 2: Note-Taking App (Markdown)

**Recommended:** Text variant

**Why:**
- Need collaborative text editing
- Real-time sync across devices
- Multiple users can edit simultaneously
- Markdown editor with rich text

**Bundle:** ~53 KB (SyncKit) + ~130 KB (React) = ~183 KB total

**Alternative:** Use Core variant if you don't need real-time collaboration

---

### Scenario 3: Project Management (Kanban)

**Recommended:** Core variant

**Why:**
- Cards are structured data (title, description, status)
- Not text documents (no need for Text CRDT)
- Server sync for team collaboration
- Drag-and-drop uses simple position updates

**Bundle:** ~53 KB (SyncKit) + ~130 KB (React) + ~28 KB (dnd-kit) = ~211 KB total

**Example:** [Project Management App](../../examples/project-management/)

---

### Scenario 4: Collaborative Code Editor

**Recommended:** Text variant

**Why:**
- Real-time collaborative coding
- Character-level conflict resolution
- Multiple cursors
- Code is just text (use Text CRDT)

**Bundle:** ~53 KB (SyncKit) + ~130 KB (React) + ~124 KB (CodeMirror) = ~307 KB total

**Example:** [Collaborative Editor](../../examples/collaborative-editor/)

---

### Scenario 5: Whiteboard App

**Recommended:** Full variant

**Why:**
- Need sets for shapes (add/remove)
- Need counters for z-index
- Need fractional index for layer ordering
- Complex collaborative features

**Bundle:** ~53 KB (SyncKit) + ~130 KB (React) + canvas library = variable

---

### Scenario 6: Social Media App

**Recommended:** Core for posts + Full for interactions (lazy load)

**Strategy:**
- Use Core variant for main app (posts, profiles, comments)
- Lazy-load Full variant for social features (likes, reactions, followers)
- Best of both worlds: small initial bundle, full features when needed

**Bundle:**
- Initial: ~53 KB (Core) + app code
- With social features: +0 KB (Full is same size as Core)

---

### Scenario 7: Offline-First Browser Extension

**Recommended:** Core-Lite variant

**Why:**
- Bundle size is critical for extensions
- Local-only storage (chrome.storage)
- No server sync needed
- Fastest performance

**Bundle:** ~48 KB (smallest possible)

---

## 💡 Best Practices

### 1. Start with Core

Use the Core variant unless you have a specific need. It's the recommended default for 80% of applications.

```typescript
import { SyncKit } from '@synckit/sdk/core'
// or just:
import { SyncKit } from '@synckit/sdk' // defaults to core
```

You can always upgrade to Text or Full later if needed.

### 2. Lazy Load Features

If you only need advanced features occasionally, lazy-load them:

```typescript
// Initial load: Core variant
import { SyncKit } from '@synckit/sdk/core'

// Later, when user opens text editor:
const textModule = await import('@synckit/sdk/text')
const textDoc = textModule.SyncKit.text('doc-1')
```

**Warning:** This loads a separate WASM binary. Only do this if the feature is rarely used.

### 3. Profile Your App

Use browser dev tools to measure actual bundle impact:

```bash
# Chrome DevTools → Network tab → Filter: WASM
# Look for synckit_core_bg.wasm size (should match variant size)
```

### 4. Don't Over-Engineer

**Rule of thumb:**
- If you're unsure → Use Core variant
- Most apps don't need Text CRDT
- Very few apps need Full variant
- Core-Lite is only for local-only apps

**Example of over-engineering:**
```typescript
// ❌ BAD: Using Text CRDT for a simple input
import { SyncKit } from '@synckit/sdk/text'
const title = sync.text('task-title')

// ✅ GOOD: Use structured data for simple fields
import { SyncKit } from '@synckit/sdk/core'
const task = sync.document({ title: 'Buy milk' })
```

### 5. Consider Your Use Case

| If your app is... | Use variant |
|-------------------|-------------|
| Like Trello | Core |
| Like Notion (without text editing) | Core |
| Like Notion (with text editing) | Text |
| Like Google Docs | Text |
| Like Figma/Miro | Full |
| Like Todoist | Core |
| Like Obsidian | Text |
| Like Airtable | Core |

---

## ❓ FAQ

### Q: Why are Text and Full the same size as Core?

**A:** CRDT algorithms are small (~1 KB of code each) and compress well with gzip. The bundle is dominated by:
- Protocol buffers (3 KB)
- Serialization (10 KB)
- WASM runtime (10 KB)
- wasm-bindgen glue (13 KB)

Adding CRDTs adds minimal code, and gzip compresses repetitive patterns very efficiently.

### Q: Why is Core-Lite 5 KB smaller?

**A:** Core-Lite excludes:
- Protocol Buffers (prost): ~3 KB
- DateTime library (chrono): ~2 KB

These dependencies are only needed for network synchronization.

### Q: Will my bundle really be ~50 KB?

**A:** Yes, if you use any of our variants:
- Core-Lite: ~48 KB total (WASM + SDK)
- Core: ~53 KB total (WASM + SDK)
- Text: ~53 KB total (WASM + SDK)
- Full: ~53 KB total (WASM + SDK)

This is just SyncKit. Your total bundle includes:
- SyncKit: ~48-53 KB
- React (if used): ~130 KB
- Other libraries: varies
- Your code: varies

### Q: Can I switch variants later?

**A:** Yes! Switching is seamless:
1. Change your import statement
2. Rebuild your app
3. No data migration needed
4. All existing data works with the new variant

### Q: Do variants affect data format?

**A:** No. All variants use the same storage format. Data created with one variant can be opened with another variant.

### Q: Can I use multiple variants in one app?

**A:** Not recommended. Each variant includes its own WASM binary, so using multiple variants duplicates code. Choose one variant that covers all your needs.

**Exception:** Lazy loading is acceptable for rarely-used features.

### Q: What if I pick the wrong variant?

**A:** No problem! You can switch anytime by changing the import. No data migration needed.

### Q: Should I use Core-Lite or Core?

**Decision tree:**
- No server sync needed → Core-Lite (save 5 KB)
- Need server sync → Core (worth 5 KB)
- Need real-time collaboration → Text or Full

### Q: Why not always use Full since it's the same size?

**A:**
1. **API simplicity:** Core variant has a simpler, focused API
2. **Mental model:** Using Core makes it clear you're using structured data sync
3. **Future-proofing:** If Full variant grows in the future, you won't be affected
4. **Documentation:** Examples and guides focus on Core variant

That said, using Full doesn't hurt if you want all features available.

---

## 🚀 Next Steps

Ready to build? Here's what to do next:

1. **Choose your variant** using the decision tree above
2. **Install SyncKit:** `npm install @synckit/sdk`
3. **Import your variant:**
   ```typescript
   import { SyncKit } from '@synckit/sdk/core' // or core-lite, text, full
   ```
4. **Build your app:** Follow our [Getting Started Guide](./getting-started.md)

**Recommended reading:**
- [Getting Started Guide](./getting-started.md) - Build your first app
- [API Reference](../api/SDK_API.md) - Complete API documentation
- [Performance Guide](./performance.md) - Optimization tips
- [Examples](../../examples/) - Real-world applications

---

## 📚 Further Reading

- [Core Variant Example - Project Management](../../examples/project-management/)
- [Text Variant Example - Collaborative Editor](../../examples/collaborative-editor/)
- [Performance Optimization Guide](./performance.md)
- [Offline-First Architecture](./offline-first.md)
- [Conflict Resolution](./conflict-resolution.md)

---

**Still have questions?**
- [GitHub Issues](https://github.com/Dancode-188/synckit/issues)
- [Discord Community](#)
- Email: danbitengo@gmail.com

---

**TL;DR:**
- **Core-Lite (43.8 KB):** Local-only, no server sync
- **Core (49.0 KB):** Recommended default, server sync
- **Text (48.9 KB):** Core + collaborative text editing
- **Full (48.9 KB):** Core + all CRDTs (counters, sets, etc.)

Most apps should use **Core**. Start there, upgrade if needed.
