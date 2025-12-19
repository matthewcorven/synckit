# Phase 2: Protocol

**Phase Duration:** 2 weeks (Weeks 3-4)  
**Phase Goal:** WebSocket endpoint with dual protocol support (JSON + Binary)

> **Critical:** This phase implements the maintainer's key requirement - automatic protocol detection between JSON (test suite) and Binary (SDK clients).

---

## Overview

This phase implements the WebSocket infrastructure, connection management, and dual protocol support (JSON for test suite compatibility, Binary for SDK clients).

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| P2-01 | Create WebSocket middleware | P0 | 6 | [P2-01.md](P2-01.md) |
| P2-02 | Implement Connection class | P0 | 4 | [P2-02.md](P2-02.md) |
| P2-03 | Define message types | P0 | 3 | [P2-03.md](P2-03.md) |
| P2-04 | Implement JSON protocol handler | P0 | 4 | [P2-04.md](P2-04.md) |
| P2-05 | Implement binary protocol handler | P0 | 6 | [P2-05.md](P2-05.md) |
| P2-06 | Implement protocol auto-detection | P0 | 3 | [P2-06.md](P2-06.md) |
| P2-07 | Implement heartbeat (ping/pong) | P0 | 3 | [P2-07.md](P2-07.md) |
| P2-08 | Add ConnectionManager | P0 | 4 | [P2-08.md](P2-08.md) |
| P2-09 | Protocol unit tests | P0 | 6 | [P2-09.md](P2-09.md) |
| **Total** | | | **39** | |

## Dependencies

```
F1-04 ─► P2-01 ─► P2-02 ─┬─► P2-07
                         └─► P2-08

P2-03 ─┬─► P2-04 ─┬─► P2-06 ─► P2-09
       └─► P2-05 ─┘
```

## Unified Disconnect Flow

See [P2-08.md](P2-08.md) for the unified connection disconnect flow documentation.

## Exit Criteria

- [ ] WebSocket connection at `/ws` works
- [ ] JSON protocol (test suite) works
- [ ] Binary protocol (SDK) works
- [ ] Protocol auto-detected on first message
- [ ] Heartbeat (ping/pong) functional

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
