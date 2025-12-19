# Phase 5: Awareness

**Phase Duration:** 1 week (Week 9)  
**Phase Goal:** Awareness protocol for presence, cursors, and ephemeral state

> **Note:** Awareness is a separate, ephemeral sync mechanism. Unlike document state, awareness data is NOT persisted - it's only broadcast to other connected clients.

---

## Overview

This phase implements the awareness protocol for tracking user presence, cursors, selections, and other ephemeral state.

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| W5-01 | Create awareness state model | P0 | 3 | [W5-01.md](W5-01.md) |
| W5-02 | Create awareness store | P0 | 4 | [W5-02.md](W5-02.md) |
| W5-03 | Implement awareness update handler | P0 | 4 | [W5-03.md](W5-03.md) |
| W5-04 | Implement awareness subscribe handler | P0 | 3 | [W5-04.md](W5-04.md) |
| W5-05 | Add awareness cleanup on disconnect | P0 | 2 | [W5-05.md](W5-05.md) |
| W5-06 | Add awareness expiration timer | P1 | 2 | [W5-06.md](W5-06.md) |
| W5-07 | Awareness unit tests | P0 | 4 | [W5-07.md](W5-07.md) |
| **Total** | | | **22** | |

## Dependencies

```
(none) ─► W5-01 ─► W5-02 ─┬─► W5-03
                          ├─► W5-04
                          ├─► W5-05
                          └─► W5-06

A3-06 ─► W5-03
P2-08 ─► W5-05

W5-01...W5-06 ─► W5-07
```

## Exit Criteria

- [ ] Awareness updates broadcast to other clients
- [ ] Awareness subscribe returns current state
- [ ] Disconnect cleans up and notifies others
- [ ] Expiration removes stale entries

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
