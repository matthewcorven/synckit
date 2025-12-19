# Phase 4: Sync Engine

**Phase Duration:** 2 weeks (Weeks 7-8)  
**Phase Goal:** Document sync with CRDT operations, vector clocks, and LWW merge

> **Critical:** This phase implements the core synchronization logic. The server mediates sync but does NOT own CRDT operations - it broadcasts deltas to subscribed clients who apply them locally.

---

## Overview

This phase implements the core synchronization engine including vector clocks, document management, and delta handling.

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| S4-01 | Implement vector clock | P0 | 4 | [S4-01.md](S4-01.md) |
| S4-02 | Create document class | P0 | 4 | [S4-02.md](S4-02.md) |
| S4-03 | Create document store | P0 | 4 | [S4-03.md](S4-03.md) |
| S4-04 | Implement subscribe handler | P0 | 4 | [S4-04.md](S4-04.md) |
| S4-05 | Implement unsubscribe handler | P0 | 2 | [S4-05.md](S4-05.md) |
| S4-06 | Implement delta handler | P0 | 6 | [S4-06.md](S4-06.md) |
| S4-07 | Implement sync request handler | P0 | 4 | [S4-07.md](S4-07.md) |
| S4-08 | Wire up message handlers | P0 | 3 | [S4-08.md](S4-08.md) |
| S4-09 | Sync engine unit tests | P0 | 6 | [S4-09.md](S4-09.md) |
| **Total** | | | **37** | |

## Dependencies

```
(none) ─► S4-01 ─► S4-02 ─► S4-03 ─┬─► S4-04 ─► S4-05
                                   ├─► S4-06
                                   └─► S4-07

A3-06 ─┬─► S4-04
       ├─► S4-06
       └─► S4-07

S4-04...S4-07, A3-03 ─► S4-08

S4-01...S4-08 ─► S4-09
```

## Exit Criteria

- [ ] Document subscription works
- [ ] Delta sync and broadcast works
- [ ] Sync request/response works
- [ ] Vector clocks track causality correctly

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
