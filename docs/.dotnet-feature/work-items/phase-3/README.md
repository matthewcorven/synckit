# Phase 3: Authentication & Authorization

**Phase Duration:** 1.5 weeks (Weeks 5-6)  
**Phase Goal:** JWT authentication with RBAC permissions

---

## Overview

This phase implements JWT-based authentication, API key validation, permission checking (RBAC), and REST authentication endpoints.

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| A3-01 | Create JWT validator service | P0 | 6 | [A3-01.md](A3-01.md) |
| A3-02 | Create API key validator service | P0 | 3 | [A3-02.md](A3-02.md) |
| A3-03 | Implement auth message handler | P0 | 4 | [A3-03.md](A3-03.md) |
| A3-04 | Implement permission checking | P0 | 3 | [A3-04.md](A3-04.md) |
| A3-06 | Enforce auth on all operations | P0 | 3 | [A3-06.md](A3-06.md) |
| A3-07 | Auth unit tests | P0 | 4 | [A3-07.md](A3-07.md) |
| A3-08 | Implement JWT generation service | P0 | 4 | [A3-08.md](A3-08.md) |
| A3-09 | Implement AuthController (REST) | P0 | 6 | [A3-09.md](A3-09.md) |
| **Total** | | | **33** | |

## Dependencies

```
P2-02 ─► A3-01 ─┬─► A3-03 ─► A3-04 ─► A3-06
                │
F1-02 ─► A3-02 ─┘

A3-01 ─► A3-08 ─┬─► A3-09
A3-02 ─────────┘

A3-01...A3-06 ─► A3-07
```

## Exit Criteria

- [ ] JWT authentication works
- [ ] API key authentication works
- [ ] Permission checking works
- [ ] REST `/auth/*` endpoints functional

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
