# AUDIT: TypeScript Server Parity Check

> **Summary:** Comprehensive audit of .NET server models, protocols, and data structures against the TypeScript reference server to identify and fix disparities.

**Priority:** P0 (Blocking - must complete before integration testing)  
**Estimate:** 4-6 hours  
**Dependencies:** None  
**Triggered By:** Disparities found in W5-01 (AwarenessState/AwarenessEntry models)

---

## Background

During implementation of W5-01 (Awareness State Model), we discovered that the initial C# implementation diverged from the TypeScript server's data model:

| Issue | TypeScript | Initial C# | Impact |
|-------|------------|------------|--------|
| State storage | Generic `Record<string, unknown>` | Typed fields (`UserId`, `Cursor`, etc.) | Protocol incompatibility |
| Timestamps | `number` (Unix ms) | `DateTime` | JSON serialization mismatch |
| Timeout units | `number` (ms) | `TimeSpan` | Configuration mismatch |

These disparities could cause **protocol incompatibility** with SDK clients and **test failures** in the integration test suite.

---

## Audit Scope

### 1. Protocol Messages (HIGH PRIORITY)

Compare all message types between servers. These are the most critical as they define the wire protocol.

| .NET File | TypeScript Reference | Check |
|-----------|---------------------|-------|
| `WebSockets/Protocol/Messages/AuthMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AuthSuccessMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AuthErrorMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/SubscribeMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/UnsubscribeMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/DeltaMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/DeltaPayload.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/SyncRequestMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/SyncResponseMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AckMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/ErrorMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/PingMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/PongMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AwarenessSubscribeMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AwarenessUpdateMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/AwarenessStateMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/Messages/ConnectMessage.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/MessageType.cs` | `websocket/protocol.ts` | ⬜ |
| `WebSockets/Protocol/MessageTypeCode.cs` | `websocket/protocol.ts` (binary codes) | ⬜ |

### 2. Sync Models (HIGH PRIORITY)

Core sync data structures that must match for correct operation.

| .NET File | TypeScript Reference | Check |
|-----------|---------------------|-------|
| `Sync/VectorClock.cs` | `sync/coordinator.ts` (mock) + `core/` (Rust) | ⬜ |
| `Sync/Document.cs` | `sync/coordinator.ts` (DocumentState) | ⬜ |
| `Sync/StoredDelta` (in Document.cs) | `sync/coordinator.ts` | ⬜ |
| `Sync/IDocumentStore.cs` | `storage/interface.ts` | ⬜ |
| `Sync/InMemoryDocumentStore.cs` | `sync/coordinator.ts` (in-memory maps) | ⬜ |

### 3. Awareness Models (COMPLETED - Reference)

| .NET File | TypeScript Reference | Status |
|-----------|---------------------|--------|
| `Awareness/AwarenessState.cs` | `sync/coordinator.ts` (AwarenessClient) | ✅ Fixed |
| `Awareness/AwarenessEntry.cs` | `sync/coordinator.ts` (AwarenessDocumentState) | ✅ Fixed |

### 4. Auth Models (MEDIUM PRIORITY)

| .NET File | TypeScript Reference | Check |
|-----------|---------------------|-------|
| `Auth/TokenPayload.cs` | `auth/jwt.ts` (JwtPayload) | ⬜ |
| `Auth/Rbac.cs` | `auth/rbac.ts` | ⬜ |
| `Auth/JwtGenerator.cs` | `auth/jwt.ts` | ⬜ |
| `Auth/JwtValidator.cs` | `auth/jwt.ts` | ⬜ |

### 5. Connection/WebSocket Models (MEDIUM PRIORITY)

| .NET File | TypeScript Reference | Check |
|-----------|---------------------|-------|
| `WebSockets/Connection.cs` | `websocket/connection.ts` | ⬜ |
| `WebSockets/ConnectionManager.cs` | `websocket/registry.ts` | ⬜ |

### 6. Configuration (LOW PRIORITY)

| .NET File | TypeScript Reference | Check |
|-----------|---------------------|-------|
| `Configuration/*.cs` | `config.ts` | ⬜ |
| `appsettings.json` | Environment variables / config.ts | ⬜ |

---

## Audit Checklist Per File

For each file comparison, verify:

### Data Types
- [ ] **Timestamps**: Should be `long` (Unix ms) not `DateTime`
- [ ] **Timeouts/Durations**: Should be `int` (ms) not `TimeSpan`
- [ ] **Generic state objects**: Should be `JsonElement` not typed classes
- [ ] **Nullable types**: Match TypeScript's `| null` or `| undefined`

### JSON Serialization
- [ ] **Property names**: Use `[JsonPropertyName("camelCase")]` to match TypeScript
- [ ] **Snake case**: SDK uses `client_id`, server uses `clientId` - verify which
- [ ] **Optional fields**: Use `JsonIgnore(Condition = WhenWritingNull)` appropriately
- [ ] **Enums**: Serialize as strings matching TypeScript values

### Protocol Compatibility
- [ ] **Message type strings**: Exact match (e.g., `"auth"`, `"subscribe"`, `"delta"`)
- [ ] **Binary type codes**: Exact match for binary protocol
- [ ] **Payload structure**: Nested objects match TypeScript shape
- [ ] **Required vs optional fields**: Match TypeScript interface

### Behavioral Parity
- [ ] **Default values**: Match TypeScript defaults
- [ ] **Validation logic**: Same constraints
- [ ] **Error messages**: Similar format for debugging

---

## Execution Plan

> **IMPORTANT:** This audit is **READ-ONLY**. The auditing agent should **NOT** make any code changes.
> All disparities must be documented as structured work items for a separate agent to execute.

### Phase 1: Protocol Messages (1.5 hours)
1. Read `server/typescript/src/websocket/protocol.ts` completely
2. Create a reference table of all message types and their shapes
3. Compare each .NET message class against the reference
4. **Document all disparities as work items** (see format below)

### Phase 2: Sync Models (1 hour)
1. Read `server/typescript/src/sync/coordinator.ts` completely
2. Compare VectorClock implementation
3. Compare Document/DocumentState structures
4. Compare StoredDelta structure
5. **Document all disparities as work items**

### Phase 3: Auth Models (0.5 hours)
1. Read `server/typescript/src/auth/jwt.ts` and `rbac.ts`
2. Compare TokenPayload/JwtPayload
3. Compare RBAC permission structures
4. **Document all disparities as work items**

### Phase 4: Connection Models (0.5 hours)
1. Read `server/typescript/src/websocket/connection.ts`
2. Compare Connection class properties
3. **Document all disparities as work items**

### Phase 5: Finalize Output (0.5 hours)
1. Review all documented work items for completeness
2. Assign priority (P0/P1/P2) to each work item
3. Update this document with summary statistics

---

## Disparity Work Item Format

Each disparity found must be documented as a **structured work item** in the file:
`docs/.dotnet-feature/work-items/audit-findings/DISPARITY-{NNN}.md`

### Work Item Template

```markdown
# DISPARITY-{NNN}: {Brief Title}

**Category:** Protocol | Sync | Auth | Connection | Config
**Priority:** P0 (Blocking) | P1 (High) | P2 (Medium) | P3 (Low)
**Estimate:** {hours}

## Files Affected
- .NET: `{path/to/file.cs}`
- TypeScript Reference: `{path/to/file.ts}`

## Current Behavior (.NET)
{Describe what the .NET code currently does, with code snippet}

## Expected Behavior (TypeScript Reference)
{Describe what the TypeScript code does, with code snippet}

## Disparity Details
| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| {field/property} | {TS type/value} | {C# type/value} | {what to change} |

## Suggested Fix
{Specific instructions for the fixing agent}

## Acceptance Criteria
- [ ] {Specific testable criterion}
- [ ] {Specific testable criterion}
- [ ] Code compiles without errors
- [ ] Existing tests pass
```

### Priority Definitions

| Priority | Definition | Examples |
|----------|------------|----------|
| **P0** | Blocking - Will cause protocol incompatibility or test failures | Wrong message type string, wrong JSON property name |
| **P1** | High - Likely to cause issues in edge cases | Wrong timestamp format, missing optional field |
| **P2** | Medium - Cosmetic or minor behavioral difference | Different default value, extra validation |
| **P3** | Low - No functional impact | Code style, documentation |

### Output Directory Structure

```
docs/.dotnet-feature/work-items/
├── audit-findings/
│   ├── README.md              # Summary index of all disparities
│   ├── DISPARITY-001.md
│   ├── DISPARITY-002.md
│   └── ...
└── AUDIT-TYPESCRIPT-PARITY.md  # This file
```

---

## Known Risk Areas

Based on the AwarenessState disparities, watch for these patterns:

1. **DateTime vs Unix timestamps** - TypeScript uses `number` for timestamps
2. **TimeSpan vs milliseconds** - TypeScript uses `number` for durations
3. **Typed classes vs generic objects** - TypeScript often uses `Record<string, unknown>`
4. **Property naming conventions** - camelCase vs PascalCase vs snake_case
5. **Null handling** - TypeScript's `| null` vs C#'s nullable types

---

## Acceptance Criteria

- [ ] All protocol message classes audited
- [ ] All sync model classes audited
- [ ] All auth model classes audited
- [ ] All connection model classes audited
- [ ] All disparities documented as structured work items in `audit-findings/`
- [ ] `audit-findings/README.md` created with summary index
- [ ] Each work item has priority assigned (P0/P1/P2/P3)
- [ ] This document updated with summary statistics

---

## Output Artifacts

1. **`audit-findings/README.md`** - Summary index of all disparities found
2. **`audit-findings/DISPARITY-{NNN}.md`** - Individual work items for each disparity
3. **This document** - Updated with audit completion status and statistics

> **Note:** No code changes are made during this audit. All fixes are executed by a separate agent using the generated work items.

---

**Status:** ⬜ Not Started
