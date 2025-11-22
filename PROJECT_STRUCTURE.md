# SyncKit Project Structure

This document explains the organization and purpose of each directory in the SyncKit monorepo.

---

## 📂 Top-Level Structure

```
synckit/
├── core/           # Rust core engine (performance-critical code)
├── sdk/            # TypeScript SDK (developer-facing API)
├── server/         # Multi-language server implementations
├── protocol/       # Protocol definitions and formal specs
├── examples/       # Example applications and demos
├── docs/           # Documentation (guides, API, architecture)
├── tests/          # Cross-cutting tests (integration, chaos, load)
├── scripts/        # Build and utility scripts
├── analysis/       # Performance analysis and benchmarks
├── pkg-default/    # Build artifact: Default variant package
└── pkg-lite/       # Build artifact: Lite variant package
```

---

## 🦀 `core/` - Rust Core Engine

The heart of SyncKit. Written in Rust for performance, compiled to WASM for web and native for desktop/mobile.

```
core/
├── src/
│   ├── lib.rs                  # Main library entry point
│   ├── sync/                   # Synchronization algorithms
│   │   ├── mod.rs              # Sync module exports
│   │   ├── vector_clock.rs     # Vector clock implementation
│   │   ├── lww.rs              # Last-Write-Wins merge algorithm
│   │   ├── delta.rs            # Delta computation
│   │   └── conflict.rs         # Conflict resolution strategies
│   ├── crdt/                   # CRDT data structures
│   │   ├── mod.rs              # CRDT module exports
│   │   ├── or_set.rs           # Observed-Remove Set
│   │   ├── pn_counter.rs       # Positive-Negative Counter
│   │   ├── fractional_index.rs # Fractional indexing for lists
│   │   └── text/               # Text CRDT (YATA-based)
│   │       ├── mod.rs          # Text CRDT exports
│   │       ├── block.rs        # Block structure
│   │       ├── operations.rs   # Text operations
│   │       └── peritext.rs     # Rich text formatting (Peritext)
│   ├── protocol/               # Wire protocol implementation
│   │   ├── mod.rs              # Protocol module exports
│   │   ├── encoder.rs          # Binary encoding (Protobuf)
│   │   ├── decoder.rs          # Binary decoding
│   │   ├── websocket.rs        # WebSocket protocol handler
│   │   └── compression.rs      # Compression (gzip/Brotli)
│   ├── storage/                # Storage abstraction
│   │   ├── mod.rs              # Storage module exports
│   │   ├── traits.rs           # Storage trait definitions
│   │   └── memory.rs           # In-memory storage (testing)
│   ├── wasm/                   # WASM bindings
│   │   ├── mod.rs              # WASM module entry
│   │   └── bindings.rs         # JavaScript bindings (wasm-bindgen)
│   └── document.rs             # Document structure and operations
├── tests/                      # Rust unit and integration tests
│   ├── property_tests.rs       # Property-based tests (PropTest)
│   ├── wasm_test.html          # WASM browser tests
│   └── wasm_test.mjs           # WASM module tests
├── benches/                    # Performance benchmarks (Criterion)
│   ├── lww_bench.rs            # LWW performance benchmarks
│   ├── vector_clock_bench.rs   # Vector clock benchmarks
│   └── delta_bench.rs          # Delta computation benchmarks
├── scripts/                    # Build scripts
│   ├── build-wasm.sh           # Build WASM (Linux/Mac)
│   └── build-wasm.ps1          # Build WASM (Windows)
└── Cargo.toml                  # Rust package configuration
```

**Key Responsibilities:**
- ✅ Sync algorithms (LWW, vector clocks, delta computation)
- ✅ CRDT implementations (OR-Set, PN-Counter, Text)
- ✅ Binary protocol (Protobuf encoding/decoding)
- ✅ Performance-critical operations (<1ms local, <100ms sync)
- ✅ WASM compilation for web browsers

---

## 📦 `sdk/` - TypeScript SDK

Developer-facing API. Wraps the Rust core and provides framework integrations.

```
sdk/
├── src/
│   ├── index.ts                # Main SDK entry point (default variant)
│   ├── index-lite.ts           # Lite variant entry point
│   ├── synckit.ts              # Core SyncKit class
│   ├── synckit-lite.ts         # Lite variant SyncKit class
│   ├── document.ts             # Document API (LWW sync)
│   ├── wasm-loader.ts          # WASM module loading (default)
│   ├── wasm-loader-lite.ts     # WASM module loading (lite)
│   ├── types.ts                # TypeScript type definitions
│   ├── adapters/               # Framework-specific adapters
│   │   └── react.tsx           # React hooks (useDocument, etc.)
│   ├── hooks/                  # Shared hook logic
│   │   └── (internal hooks)    # Hook utilities
│   ├── storage/                # Storage adapters
│   │   ├── index.ts            # Storage exports
│   │   ├── indexeddb.ts        # IndexedDB implementation
│   │   └── memory.ts           # In-memory storage (testing)
│   └── utils/                  # Utility functions
│       └── (internal utils)    # Utility functions
├── tests/                      # TypeScript tests (Vitest)
│   └── (SDK tests)             # SDK integration tests
└── package.json                # NPM package configuration
```

**Key Responsibilities:**
- ✅ Simple, intuitive API (`sync.document()`)
- ✅ React integration (hooks: `useDocument`)
- ✅ Two optimized variants (default ~53KB, lite ~48KB gzipped)
- ✅ Storage adapters (IndexedDB, Memory)
- ✅ WASM module loading and management
- 🚧 Vue/Svelte adapters (v0.3.0+)
- 🚧 Text/Counter/Set CRDTs (future releases)

---

## 🖥️ `server/` - Multi-Language Servers

Reference server implementations in multiple languages. All implement the same Protobuf protocol.

```
server/
├── typescript/                 # TypeScript reference (v0.1.0 primary)
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── websocket.ts        # WebSocket connection handler
│   │   ├── routes/             # HTTP endpoints
│   │   │   ├── sync.ts         # Sync endpoints
│   │   │   ├── auth.ts         # Authentication endpoints
│   │   │   └── health.ts       # Health check
│   │   ├── middleware/         # Express/Hono middleware
│   │   │   ├── auth.ts         # JWT authentication
│   │   │   ├── cors.ts         # CORS configuration
│   │   │   └── error.ts        # Error handling
│   │   ├── services/           # Business logic
│   │   │   ├── sync-coordinator.ts  # Sync orchestration
│   │   │   ├── storage.ts      # Database abstraction
│   │   │   └── auth.ts         # Auth service
│   │   └── config.ts           # Configuration management
│   ├── Dockerfile              # Docker container
│   ├── fly.toml                # Fly.io deployment config
│   └── package.json            # Dependencies
├── python/                     # Python reference (v0.2.0+)
│   ├── src/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── websocket.py        # WebSocket handler
│   │   ├── sync.py             # Sync coordinator
│   │   └── storage.py          # Database layer
│   └── requirements.txt        # Python dependencies
├── go/                         # Go reference (v0.2.0+)
│   ├── src/
│   │   ├── main.go             # Server entry
│   │   ├── websocket.go        # WebSocket handler
│   │   └── sync.go             # Sync coordinator
│   └── go.mod                  # Go module
└── rust/                       # Rust reference (v0.3.0+)
    ├── src/
    │   ├── main.rs             # Server entry
    │   ├── websocket.rs        # WebSocket handler
    │   └── sync.rs             # Sync coordinator
    └── Cargo.toml              # Rust dependencies
```

**Key Responsibilities:**
- ✅ WebSocket connection management
- ✅ Delta distribution to connected clients
- ✅ Authentication and authorization (JWT + RBAC)
- ✅ Database persistence (PostgreSQL, MongoDB)
- ✅ Redis pub/sub for multi-server coordination

---

## 📡 `protocol/` - Protocol Definitions

Protocol specifications and formal verification.

```
protocol/
├── specs/                      # Protobuf specifications
│   ├── sync.proto              # Core sync protocol
│   ├── messages.proto          # Message formats
│   ├── auth.proto              # Authentication messages
│   └── types.proto             # Shared types (VectorClock, etc.)
└── tla/                        # TLA+ formal specifications
    ├── lww_merge.tla           # LWW merge algorithm
    ├── vector_clock.tla        # Vector clock properties
    ├── convergence.tla         # Convergence proof
    └── README.md               # How to run TLA+ model checking
```

**Key Responsibilities:**
- ✅ Language-agnostic protocol definition
- ✅ Formal verification of algorithms
- ✅ Binary message format specification
- ✅ Contract between client and server

---

## 📚 `examples/` - Example Applications

Real-world examples demonstrating different tiers of SyncKit.

```
examples/
├── todo-app/                   # Complete CRUD example
│   ├── src/
│   │   ├── App.tsx             # React app
│   │   └── components/         # UI components
│   ├── README.md               # Setup and usage
│   └── package.json
├── collaborative-editor/       # Real-time text editing (skeleton)
│   ├── src/
│   │   ├── App.tsx             # React app
│   │   └── components/         # Editor components
│   ├── README.md
│   └── package.json
├── project-management/         # Production-grade example (skeleton)
│   ├── src/
│   │   ├── App.tsx             # Main application
│   │   ├── features/           # Feature modules
│   │   └── components/         # UI components (shadcn/ui)
│   ├── README.md
│   └── package.json
└── real-world/                 # Future: Full-featured app
    └── (planned for future release)
```

**Key Responsibilities:**
- ✅ Demonstrate best practices
- ✅ Onboarding new developers (copy-paste ready)
- ✅ Showcase different use cases
- ✅ Serve as integration tests

---

## 📖 `docs/` - Documentation

Comprehensive documentation for developers and users.

```
docs/
├── README.md                   # Documentation index
├── api/                        # API reference documentation
│   └── SDK_API.md              # Complete SDK API reference
├── architecture/               # System design documentation
│   └── ARCHITECTURE.md         # System architecture and design
└── guides/                     # User guides (8 comprehensive guides)
    ├── getting-started.md      # 5-minute quick start
    ├── choosing-variant.md     # Default vs Lite variant guide
    ├── offline-first.md        # Offline-first patterns
    ├── conflict-resolution.md  # Handling conflicts
    ├── performance.md          # Performance optimization
    ├── testing.md              # Testing guide
    ├── migration-from-firebase.md     # Firebase migration
    ├── migration-from-supabase.md     # Supabase migration
    └── migration-from-yjs.md          # Yjs/Automerge migration
```

**Key Responsibilities:**
- ✅ Complete API documentation
- ✅ Architecture explanations
- ✅ User guides and tutorials
- ✅ Migration guides from competitors

---

## 🧪 `tests/` - Cross-Cutting Tests

Tests that span multiple components (client + server).

```
tests/
├── integration/                # End-to-end integration tests (244 tests)
│   ├── protocol.test.ts        # Protocol sync tests
│   ├── storage.test.ts         # Storage adapter tests
│   ├── offline.test.ts         # Offline scenarios
│   └── (more test files)       # Additional integration tests
├── chaos/                      # Chaos engineering tests (80 tests)
│   ├── network-failures.test.ts     # Network failure scenarios
│   ├── convergence.test.ts          # Convergence verification
│   ├── partitions.test.ts           # Network partition handling
│   └── (more chaos tests)           # Additional chaos tests
├── load/                       # Load and performance tests (61 tests)
│   ├── concurrency.test.ts     # Concurrent operations
│   ├── sustained-load.test.ts  # Sustained load testing
│   ├── burst-traffic.test.ts   # Burst traffic handling
│   └── (more load tests)       # Additional performance tests
└── package.json                # Test suite configuration (Bun)
```

**Key Responsibilities:**
- ✅ Verify end-to-end functionality
- ✅ Test under adverse network conditions
- ✅ Ensure performance targets met
- ✅ Catch integration issues early

---

## 🛠️ `scripts/` - Build and Utility Scripts

Automation scripts for building WASM variants.

```
scripts/
├── build-wasm.sh               # Build WASM (both variants)
└── build-all-variants.sh       # Build default + lite variants
```

**Additional Build Scripts:**
- `core/scripts/build-wasm.sh` - Core WASM build (Linux/Mac)
- `core/scripts/build-wasm.ps1` - Core WASM build (Windows)
- `npm run build` - Build SDK
- `npm test` - Run all tests (SDK + core + server)

**Key Responsibilities:**
- ✅ Automate WASM builds
- ✅ Build both default and lite variants
- ✅ Consistent cross-platform builds

---

## 🔗 Dependency Flow

```
┌─────────────────┐
│   Examples      │ (use SDK + Server)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      SDK        │ (wraps Rust Core)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Rust Core     │ (implements Protocol)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Protocol      │ (defines contract)
└─────────────────┘
         ▲
         │
┌────────┴────────┐
│    Server(s)    │ (implements Protocol)
└─────────────────┘
```

**Key Insight:** Protocol is the source of truth. Both client and server implement it independently.

---

## 📦 Build Artifacts

After building, you'll have:

```
synckit/
├── core/pkg/                   # WASM build output (default variant)
│   ├── synckit_core_bg.wasm    # WASM binary (~49KB gzipped)
│   ├── synckit_core_bg.wasm.gz # Gzipped WASM
│   ├── synckit_core.js         # JS bindings
│   └── synckit_core.d.ts       # TypeScript types
├── pkg-default/                # SDK with default WASM (~53KB total)
│   └── (WASM variant: full features)
├── pkg-lite/                   # SDK with lite WASM (~48KB total)
│   └── (WASM variant: local-only)
├── sdk/dist/                   # SDK build output
│   ├── index.js                # Main entry (default)
│   ├── index.mjs               # ES module (default)
│   ├── index.d.ts              # TypeScript types (default)
│   ├── index-lite.js           # Main entry (lite)
│   ├── index-lite.mjs          # ES module (lite)
│   ├── index-lite.d.ts         # TypeScript types (lite)
│   └── adapters/               # Framework adapters
│       └── react.js/mjs/d.ts   # React hooks
└── server/typescript/dist/     # Server build output
```

---

## 🚀 Getting Started

To start developing:

```bash
# 1. Install dependencies
npm install

# 2. Install server dependencies (not a workspace)
cd server/typescript && bun install && cd ../..

# 3. Build WASM (optional - pre-built WASM included)
# Only needed if modifying Rust code
cd core && bash scripts/build-wasm.sh && cd ..
# Windows: cd core && .\scripts\build-wasm.ps1 && cd ..

# 4. Build SDK
npm run build

# 5. Run all tests
npm test

# 6. Start development server
cd server/typescript && bun run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions.

---

## 📝 Notes

**Monorepo Management:**
- We use a monorepo for easier cross-component development
- Rust workspace for core + WASM
- NPM workspaces for TypeScript packages
- Independent versioning per package

**Why This Structure?**
- ✅ Clear separation of concerns
- ✅ Easy to navigate and understand
- ✅ Supports multi-language development
- ✅ Independent testing per component
- ✅ Scalable as project grows

---

**Questions about the structure?** See [ROADMAP.md](ROADMAP.md) for implementation timeline or reach out in discussions!