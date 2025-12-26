# Quick Reference: All Disparities

**Total Disparities:** 11  
**P0 (Blocking):** 4 | **P1 (High):** 4 | **P2 (Medium):** 3

---

## P0 - Blocking Disparities (Fix First!)

### DISPARITY-001: MessageType Enum Serialization
**File:** `WebSockets/Protocol/MessageType.cs`  
**Issue:** Uses PascalCase instead of snake_case  
**Example:** `"AuthSuccess"` should be `"auth_success"`  
**Fix:** Implement custom JSON converter for snake_case serialization

### DISPARITY-002: SyncResponseMessage.State Type
**File:** `WebSockets/Protocol/Messages/SyncResponseMessage.cs`  
**Issue:** Type is `Dictionary<string, long>?` should be `object?`  
**Impact:** Wrong data structure in sync responses  
**Fix:** Change State property type to `object?`

### DISPARITY-005: AwarenessUpdateMessage.State Type
**File:** `WebSockets/Protocol/Messages/AwarenessUpdateMessage.cs`  
**Issue:** Type is `Dictionary<string, object>?` should be `JsonElement?`  
**Impact:** Cannot preserve arbitrary JSON structures  
**Fix:** Change State property type to `JsonElement?`

### DISPARITY-006: AwarenessStateMessage.States Structure
**File:** `WebSockets/Protocol/Messages/AwarenessStateMessage.cs`  
**Issue:** `AwarenessClientState.State` is `Dictionary<string, object>` should be `JsonElement`  
**Impact:** Awareness state serialization broken  
**Fix:** Change State property type to `JsonElement`

---

## P1 - High Priority Disparities

### DISPARITY-003: DeltaMessage.Delta Type
**File:** `WebSockets/Protocol/Messages/DeltaMessage.cs`  
**Issue:** VectorClock type inconsistency (`long` vs `int`)  
**Fix:** Standardize on `long` or `int` consistently

### DISPARITY-004: SyncRequestMessage.VectorClock Type
**File:** `WebSockets/Protocol/Messages/SyncRequestMessage.cs`  
**Issue:** Type is `Dictionary<string, long>?` - verify consistency  
**Fix:** Ensure consistent with other message types

### DISPARITY-007: AuthSuccessMessage.Permissions Type
**File:** `WebSockets/Protocol/Messages/AuthSuccessMessage.cs`  
**Issue:** Type is `Dictionary<string, object>` should be `object`  
**Impact:** Permissions structure too rigid  
**Fix:** Change Permissions property type to `object`

### DISPARITY-008: TokenPayload Timestamps
**File:** `Auth/TokenPayload.cs`  
**Issue:** Verify JWT uses Unix seconds (not milliseconds)  
**Fix:** Verify JwtGenerator uses `ToUnixTimeSeconds()`

---

## P2 - Medium Priority Disparities

### DISPARITY-009: VectorClock.Entries Serialization
**File:** `Sync/VectorClock.cs`  
**Issue:** Returns `IReadOnlyDictionary<string, long>` - serialization consistency  
**Fix:** Ensure `.ToDict()` method is used for serialization

### DISPARITY-010: Document.UpdatedAt Timestamp
**File:** `Sync/Document.cs`  
**Issue:** Uses `DateTime` should use `long` (Unix milliseconds)  
**Fix:** Change CreatedAt and UpdatedAt to `long`

### DISPARITY-011: StoredDelta.Timestamp
**File:** `Sync/Document.cs`  
**Issue:** Already correct as `long` - document for consistency  
**Fix:** No change needed (already correct)

---

## Fix Priority Order

### Phase 1: Critical (P0) - 2-3 hours
1. DISPARITY-001 - MessageType enum (affects all messages)
2. DISPARITY-002 - SyncResponseMessage.State
3. DISPARITY-005 - AwarenessUpdateMessage.State
4. DISPARITY-006 - AwarenessStateMessage.States

**Then:** Run integration tests

### Phase 2: High Priority (P1) - 1-2 hours
1. DISPARITY-003 - DeltaMessage.Delta
2. DISPARITY-004 - SyncRequestMessage.VectorClock
3. DISPARITY-007 - AuthSuccessMessage.Permissions
4. DISPARITY-008 - TokenPayload timestamps

### Phase 3: Medium Priority (P2) - 1 hour
1. DISPARITY-009 - VectorClock serialization
2. DISPARITY-010 - Document timestamps
3. DISPARITY-011 - StoredDelta timestamps (verify only)

---

## Testing Checklist

After fixing each disparity:

- [ ] Code compiles without errors
- [ ] Unit tests pass
- [ ] JSON serialization matches TypeScript output
- [ ] Integration tests pass with SDK clients

---

## Related Documents

- [README.md](README.md) - Full summary with statistics
- [AUDIT-EXECUTION-SUMMARY.md](AUDIT-EXECUTION-SUMMARY.md) - Detailed audit report
- [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md) - Main audit document
- Individual DISPARITY-*.md files - Detailed fix instructions

---

## Quick Links to Disparities

| ID | Title | Priority | File |
|----|-------|----------|------|
| [001](DISPARITY-001.md) | MessageType Enum Serialization | P0 | MessageType.cs |
| [002](DISPARITY-002.md) | SyncResponseMessage.State Type | P0 | SyncResponseMessage.cs |
| [003](DISPARITY-003.md) | DeltaMessage.Delta Type | P1 | DeltaMessage.cs |
| [004](DISPARITY-004.md) | SyncRequestMessage.VectorClock Type | P1 | SyncRequestMessage.cs |
| [005](DISPARITY-005.md) | AwarenessUpdateMessage.State Type | P0 | AwarenessUpdateMessage.cs |
| [006](DISPARITY-006.md) | AwarenessStateMessage.States Structure | P0 | AwarenessStateMessage.cs |
| [007](DISPARITY-007.md) | AuthSuccessMessage.Permissions Type | P1 | AuthSuccessMessage.cs |
| [008](DISPARITY-008.md) | TokenPayload Timestamps | P1 | TokenPayload.cs |
| [009](DISPARITY-009.md) | VectorClock.Entries Serialization | P2 | VectorClock.cs |
| [010](DISPARITY-010.md) | Document.UpdatedAt Timestamp | P2 | Document.cs |
| [011](DISPARITY-011.md) | StoredDelta.Timestamp | P2 | Document.cs |

---

**Last Updated:** December 25, 2025  
**Audit Status:** ✅ Complete
