# Batch Execution Prompts for Disparity Fixes

> **Purpose:** Ready-to-use prompts for AI agents to fix all disparities in optimal batches.
> **Strategy:** 4 batches with testing checkpoints between each.

---

## Batch 1: MessageType Enum Serialization (DISPARITY-001)

**Priority:** P0 (Blocking)  
**Estimated Time:** 30-45 minutes  
**Test After:** Yes - critical for all other message handling

### Prompt

```
Fix DISPARITY-001: Implement snake_case JSON serialization for the MessageType enum.

## Context
The .NET server's MessageType enum serializes as PascalCase (e.g., "AuthSuccess") but the TypeScript 
reference server uses snake_case (e.g., "auth_success"). This breaks protocol compatibility.

## Files to Modify
1. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/MessageType.cs`

## Requirements
1. Create a custom JsonConverter<MessageType> that:
   - Serializes enum values to snake_case strings
   - Deserializes snake_case strings back to enum values
   - Handles unknown values gracefully with an error

2. The converter must map:
   - Connect → "connect"
   - Disconnect → "disconnect"
   - Ping → "ping"
   - Pong → "pong"
   - Auth → "auth"
   - AuthSuccess → "auth_success"
   - AuthError → "auth_error"
   - Subscribe → "subscribe"
   - Unsubscribe → "unsubscribe"
   - SyncRequest → "sync_request"
   - SyncResponse → "sync_response"
   - Delta → "delta"
   - Ack → "ack"
   - AwarenessUpdate → "awareness_update"
   - AwarenessSubscribe → "awareness_subscribe"
   - AwarenessState → "awareness_state"
   - Error → "error"

3. Apply the converter to the MessageType enum using [JsonConverter] attribute

4. Update BaseMessage.cs if needed to ensure the Type property serializes correctly

## TypeScript Reference (server/typescript/src/websocket/protocol.ts)
```typescript
export enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  DELTA = 'delta',
  ACK = 'ack',
  AWARENESS_UPDATE = 'awareness_update',
  AWARENESS_SUBSCRIBE = 'awareness_subscribe',
  AWARENESS_STATE = 'awareness_state',
  ERROR = 'error',
}
```

## Acceptance Criteria
- [ ] MessageType.AuthSuccess serializes to "auth_success"
- [ ] MessageType.SyncRequest serializes to "sync_request"
- [ ] MessageType.AwarenessUpdate serializes to "awareness_update"
- [ ] All enum values serialize to snake_case
- [ ] Deserialization works correctly from snake_case
- [ ] Code compiles without errors
- [ ] Existing tests pass

## Verification Test
After implementation, verify with:
```csharp
var options = new JsonSerializerOptions();
var json = JsonSerializer.Serialize(MessageType.AuthSuccess, options);
// Should output: "auth_success"
```
```

### Post-Batch Test Command
```bash
cd server/csharp && dotnet build && dotnet test
```

---

## Batch 2: Protocol Message Type Changes (DISPARITY-002, 005, 006, 007)

**Priority:** P0/P1  
**Estimated Time:** 30-45 minutes  
**Test After:** Yes - affects message serialization

### Prompt

```
Fix DISPARITY-002, 005, 006, 007: Update protocol message classes to use generic JSON types.

## Context
Several protocol message classes use typed dictionaries (Dictionary<string, object>) instead of 
generic JSON types (JsonElement or object). This prevents preserving arbitrary JSON structures 
from clients.

## Files to Modify
1. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/SyncResponseMessage.cs`
2. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AwarenessUpdateMessage.cs`
3. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AwarenessStateMessage.cs`
4. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AuthSuccessMessage.cs`

## Requirements

### SyncResponseMessage.cs (DISPARITY-002)
Change:
```csharp
[JsonPropertyName("state")]
public Dictionary<string, long>? State { get; set; }
```
To:
```csharp
[JsonPropertyName("state")]
public object? State { get; set; }
```

### AwarenessUpdateMessage.cs (DISPARITY-005)
Change:
```csharp
[JsonPropertyName("state")]
public Dictionary<string, object>? State { get; set; }
```
To:
```csharp
[JsonPropertyName("state")]
public JsonElement? State { get; set; }
```
Add `using System.Text.Json;` if not present.

### AwarenessStateMessage.cs (DISPARITY-006)
In the AwarenessClientState class, change:
```csharp
[JsonPropertyName("state")]
public required Dictionary<string, object> State { get; set; }
```
To:
```csharp
[JsonPropertyName("state")]
public required JsonElement State { get; set; }
```
Add `using System.Text.Json;` if not present.

### AuthSuccessMessage.cs (DISPARITY-007)
Change:
```csharp
[JsonPropertyName("permissions")]
public required Dictionary<string, object> Permissions { get; set; }
```
To:
```csharp
[JsonPropertyName("permissions")]
public required object Permissions { get; set; }
```

## TypeScript Reference
```typescript
// SyncResponseMessage
state?: any;

// AwarenessUpdateMessage  
state: Record<string, unknown> | null;

// AwarenessStateMessage.states[].state
state: Record<string, unknown>;

// AuthSuccessMessage
permissions: Record<string, any>;
```

## Acceptance Criteria
- [ ] SyncResponseMessage.State is type object?
- [ ] AwarenessUpdateMessage.State is type JsonElement?
- [ ] AwarenessClientState.State is type JsonElement
- [ ] AuthSuccessMessage.Permissions is type object
- [ ] All files have required using statements
- [ ] Code compiles without errors
- [ ] Existing tests pass
```

### Post-Batch Test Command
```bash
cd server/csharp && dotnet build && dotnet test
```

---

## Batch 3: Sync Models Consistency (DISPARITY-003, 004, 009, 010)

**Priority:** P1/P2  
**Estimated Time:** 30-45 minutes  
**Test After:** Yes - affects sync operations

### Prompt

```
Fix DISPARITY-003, 004, 009, 010: Standardize sync model types for consistency.

## Context
The sync models have minor inconsistencies in how vector clocks and timestamps are handled.
These changes improve consistency but are less critical than P0 fixes.

## Files to Modify
1. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/DeltaMessage.cs`
2. `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/SyncRequestMessage.cs`
3. `server/csharp/src/SyncKit.Server/Sync/VectorClock.cs`
4. `server/csharp/src/SyncKit.Server/Sync/Document.cs`

## Requirements

### DeltaMessage.cs (DISPARITY-003)
Verify VectorClock type is Dictionary<string, long> - this is CORRECT for .NET.
Add documentation clarifying that JavaScript `number` maps to C# `long`:
```csharp
/// <summary>
/// Vector clock representing the state after this delta.
/// Maps client IDs to their logical clock values.
/// Note: JavaScript numbers are 64-bit floats, C# long is 64-bit integer.
/// </summary>
[JsonPropertyName("vectorClock")]
public required Dictionary<string, long> VectorClock { get; set; }
```

### SyncRequestMessage.cs (DISPARITY-004)
Add documentation clarifying the type choice:
```csharp
/// <summary>
/// Optional vector clock representing client's current state.
/// Maps client IDs to their logical clock values.
/// </summary>
[JsonPropertyName("vectorClock")]
public Dictionary<string, long>? VectorClock { get; set; }
```

### VectorClock.cs (DISPARITY-009)
Add a ToJson() alias method for clarity:
```csharp
/// <summary>
/// Convert to JSON-serializable dictionary.
/// Alias for ToDict() for semantic clarity.
/// </summary>
public Dictionary<string, long> ToJson() => ToDict();
```

### Document.cs (DISPARITY-010)
Change CreatedAt and UpdatedAt from DateTime to long (Unix milliseconds):

Change:
```csharp
public DateTime CreatedAt { get; }
public DateTime UpdatedAt { get; private set; }
```

To:
```csharp
/// <summary>
/// When the document was created (Unix milliseconds).
/// </summary>
public long CreatedAt { get; }

/// <summary>
/// When the document was last updated (Unix milliseconds).
/// </summary>
public long UpdatedAt { get; private set; }
```

Update constructors to use:
```csharp
CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
```

Update AddDelta method to use:
```csharp
UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
```

## Acceptance Criteria
- [ ] VectorClock types are documented as intentionally using long
- [ ] VectorClock has ToJson() method
- [ ] Document.CreatedAt is type long (Unix milliseconds)
- [ ] Document.UpdatedAt is type long (Unix milliseconds)
- [ ] All timestamp assignments use DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
- [ ] Code compiles without errors
- [ ] Existing tests pass
```

### Post-Batch Test Command
```bash
cd server/csharp && dotnet build && dotnet test
```

---

## Batch 4: Verification Only (DISPARITY-008, 011)

**Priority:** P1/P2  
**Estimated Time:** 15-20 minutes  
**Test After:** Yes - final verification

### Prompt

```
Verify DISPARITY-008 and DISPARITY-011: Confirm JWT timestamps and StoredDelta are correct.

## Context
These disparities require verification rather than fixes. The implementation may already be correct.

## Files to Review
1. `server/csharp/src/SyncKit.Server/Auth/TokenPayload.cs`
2. `server/csharp/src/SyncKit.Server/Auth/JwtGenerator.cs`
3. `server/csharp/src/SyncKit.Server/Auth/JwtValidator.cs`
4. `server/csharp/src/SyncKit.Server/Sync/Document.cs` (StoredDelta class)

## Requirements

### TokenPayload.cs (DISPARITY-008)
1. Verify Iat and Exp are documented as Unix SECONDS (not milliseconds) per JWT RFC 7519
2. If comments say milliseconds, update to say seconds

### JwtGenerator.cs (DISPARITY-008)
1. Verify token generation uses Unix seconds:
   - Should use DateTimeOffset.UtcNow.ToUnixTimeSeconds() for iat
   - Should use expiration in seconds, not milliseconds
2. If using milliseconds, change to seconds

### JwtValidator.cs (DISPARITY-008)
1. Verify token validation compares against Unix seconds
2. If using milliseconds, change to seconds

### StoredDelta (DISPARITY-011)
1. Verify Timestamp property is type long (Unix milliseconds) - this should already be correct
2. Confirm it's documented as Unix milliseconds

## Acceptance Criteria
- [ ] TokenPayload.Iat and Exp are documented as Unix seconds
- [ ] JwtGenerator uses ToUnixTimeSeconds() for token timestamps
- [ ] JwtValidator compares against Unix seconds
- [ ] StoredDelta.Timestamp is type long (Unix milliseconds)
- [ ] All timestamp units are clearly documented
- [ ] Code compiles without errors
- [ ] Existing tests pass
```

### Post-Batch Test Command
```bash
cd server/csharp && dotnet build && dotnet test
```

---

## Execution Checklist

### Pre-Execution
- [ ] Ensure on correct branch: `feature/11-dotnet-server`
- [ ] Pull latest changes
- [ ] Run initial build: `cd server/csharp && dotnet build`
- [ ] Run initial tests: `dotnet test`

### Batch Execution

| Batch | Disparities | Status | Test Result |
|-------|-------------|--------|-------------|
| 1 | DISPARITY-001 | ⬜ Not Started | ⬜ |
| 2 | DISPARITY-002, 005, 006, 007 | ⬜ Not Started | ⬜ |
| 3 | DISPARITY-003, 004, 009, 010 | ⬜ Not Started | ⬜ |
| 4 | DISPARITY-008, 011 | ⬜ Not Started | ⬜ |

### Post-Execution
- [ ] All batches complete
- [ ] All tests pass
- [ ] Run integration tests: `cd tests && bun test`
- [ ] Commit changes with message: `fix: resolve TypeScript parity disparities`

---

## Quick Copy Commands

### Run All Tests
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp && dotnet build && dotnet test
```

### Run Integration Tests
```bash
cd /Users/core/git/matthewcorven/synckit/tests && bun test
```

### Start Server for Manual Testing
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
JWT_SECRET="test-secret-key-for-development-32-chars" dotnet run
```

---

## Rollback Instructions

If a batch introduces issues:

1. Identify the problematic batch
2. Revert changes: `git checkout -- <files>`
3. Re-run tests to confirm rollback
4. Debug and retry batch

---

**Document Version:** 1.0  
**Created:** December 25, 2025  
**Status:** Ready for Execution
