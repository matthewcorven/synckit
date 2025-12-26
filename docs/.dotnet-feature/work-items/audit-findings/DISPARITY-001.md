# DISPARITY-001: MessageType Enum Serialization - PascalCase vs snake_case

**Category:** Protocol  
**Priority:** P0 (Blocking)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/MessageType.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public enum MessageType
{
    Connect,
    Disconnect,
    Ping,
    Pong,
    Auth,
    AuthSuccess,      // ← Serializes as "AuthSuccess"
    AuthError,        // ← Serializes as "AuthError"
    Subscribe,
    Unsubscribe,
    SyncRequest,      // ← Serializes as "SyncRequest"
    SyncResponse,     // ← Serializes as "SyncResponse"
    Delta,
    Ack,
    AwarenessUpdate,  // ← Serializes as "AwarenessUpdate"
    AwarenessSubscribe,
    AwarenessState,
    Error
}
```

**Issue:** The enum uses PascalCase names, which when serialized with `JsonStringEnumConverter` produce PascalCase JSON values like `"AuthSuccess"`, `"SyncRequest"`, etc.

---

## Expected Behavior (TypeScript Reference)

```typescript
export enum MessageType {
  // Connection lifecycle
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',

  // Authentication
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',      // ← snake_case
  AUTH_ERROR = 'auth_error',          // ← snake_case

  // Sync operations
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SYNC_REQUEST = 'sync_request',      // ← snake_case
  SYNC_RESPONSE = 'sync_response',    // ← snake_case
  DELTA = 'delta',
  ACK = 'ack',

  // Awareness (presence)
  AWARENESS_UPDATE = 'awareness_update',      // ← snake_case
  AWARENESS_SUBSCRIBE = 'awareness_subscribe',
  AWARENESS_STATE = 'awareness_state',

  // Errors
  ERROR = 'error',
}
```

**Correct behavior:** TypeScript uses snake_case for all message type values (e.g., `"auth_success"`, `"sync_request"`, `"awareness_update"`).

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| AuthSuccess | `"auth_success"` | `"AuthSuccess"` | Use snake_case serialization |
| AuthError | `"auth_error"` | `"AuthError"` | Use snake_case serialization |
| SyncRequest | `"sync_request"` | `"SyncRequest"` | Use snake_case serialization |
| SyncResponse | `"sync_response"` | `"SyncResponse"` | Use snake_case serialization |
| AwarenessUpdate | `"awareness_update"` | `"AwarenessUpdate"` | Use snake_case serialization |
| AwarenessSubscribe | `"awareness_subscribe"` | `"AwarenessSubscribe"` | Use snake_case serialization |
| AwarenessState | `"awareness_state"` | `"AwarenessState"` | Use snake_case serialization |

---

## Suggested Fix

Use a custom JSON converter to serialize enum values to snake_case. The .NET codebase already has `SnakeCaseNamingPolicy.cs` - apply it to the MessageType enum serialization.

**Option 1: Use JsonConverter attribute on enum**
```csharp
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MessageType
{
    [EnumMember(Value = "auth_success")]
    AuthSuccess,
    
    [EnumMember(Value = "auth_error")]
    AuthError,
    
    // ... etc
}
```

**Option 2: Create custom converter**
```csharp
public class SnakeCaseEnumConverter : JsonConverter<MessageType>
{
    public override MessageType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return value switch
        {
            "auth_success" => MessageType.AuthSuccess,
            "auth_error" => MessageType.AuthError,
            "sync_request" => MessageType.SyncRequest,
            "sync_response" => MessageType.SyncResponse,
            "awareness_update" => MessageType.AwarenessUpdate,
            "awareness_subscribe" => MessageType.AwarenessSubscribe,
            "awareness_state" => MessageType.AwarenessState,
            // ... etc
            _ => throw new JsonException($"Unknown message type: {value}")
        };
    }

    public override void Write(Utf8JsonWriter writer, MessageType value, JsonSerializerOptions options)
    {
        var stringValue = value switch
        {
            MessageType.AuthSuccess => "auth_success",
            MessageType.AuthError => "auth_error",
            MessageType.SyncRequest => "sync_request",
            MessageType.SyncResponse => "sync_response",
            MessageType.AwarenessUpdate => "awareness_update",
            MessageType.AwarenessSubscribe => "awareness_subscribe",
            MessageType.AwarenessState => "awareness_state",
            // ... etc
            _ => value.ToString().ToLower()
        };
        writer.WriteStringValue(stringValue);
    }
}
```

---

## Acceptance Criteria

- [x] MessageType enum serializes to snake_case JSON values
- [x] All message types match TypeScript reference exactly:
  - `"auth_success"`, `"auth_error"`, `"sync_request"`, `"sync_response"`
  - `"awareness_update"`, `"awareness_subscribe"`, `"awareness_state"`
- [x] JSON serialization produces identical output to TypeScript server
- [x] Code compiles without errors
- [x] Existing unit tests pass (670/670 tests passing)
- [ ] Integration tests pass with SDK clients (requires full server implementation)

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-002 (MessageTypeCode binary codes)

---

## Implementation Summary

**Status:** ✅ Completed

### Changes Made

1. **Created `MessageTypeConverter.cs`** - Custom `JsonConverter<MessageType>` that:
   - Serializes enum values to snake_case strings (e.g., `AuthSuccess` → `"auth_success"`)
   - Deserializes snake_case strings back to enum values
   - Provides clear error messages for unknown values
   - Uses explicit mappings for all 17 message types

2. **Updated `MessageType.cs`** - Added `[JsonConverter(typeof(MessageTypeConverter))]` attribute to the enum

3. **Updated `BaseMessage.cs`** - Removed redundant `[JsonConverter(typeof(JsonStringEnumConverter))]` from the Type property

4. **Created `MessageTypeConverterTests.cs`** - Comprehensive test suite with:
   - 17 serialization tests (one for each message type)
   - 17 deserialization tests
   - Error handling tests (unknown values, null values)
   - PascalCase prevention tests
   - Round-trip tests for all enum values
   - **Total: 38 tests, all passing**

### Verification

✅ All 670 existing tests pass  
✅ All 38 new MessageTypeConverter tests pass  
✅ Verification program confirms correct snake_case serialization  
✅ Protocol compatibility with TypeScript server achieved

### Files Modified

- `server/csharp/src/SyncKit.Server/WebSockets/Protocol/MessageType.cs`
- `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/BaseMessage.cs`

### Files Created

- `server/csharp/src/SyncKit.Server/WebSockets/Protocol/MessageTypeConverter.cs`
- `server/csharp/src/SyncKit.Server.Tests/WebSockets/Protocol/MessageTypeConverterTests.cs`
- `server/csharp/src/VerifyDisparity001/` (verification program)
