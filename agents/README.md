# Autonomous agent coordination

This repo is intended to be built by **three AI agents**: two autonomous coding agents working in parallel, plus a coordinator agent advising the human.

---

## Agent Files

| Agent | Entry Point | Progress Tracker |
|-------|-------------|------------------|
| Agent A (UI) | [STREAM_A_ENTRY.md](STREAM_A_ENTRY.md) | [STREAM_A_PROGRESS.md](STREAM_A_PROGRESS.md) |
| Agent B (Platform) | [STREAM_B_ENTRY.md](STREAM_B_ENTRY.md) | [STREAM_B_PROGRESS.md](STREAM_B_PROGRESS.md) |
| Coordinator | [STREAM_COORD_ENTRY.md](STREAM_COORD_ENTRY.md) | Reads both progress files |

---

## Roles

### Agent A — UI-first iteration
**Goal:** Maximize early iteration on on-screen registration form UX.
- Angular shell + routing
- Trial selection UI
- Registration form layout matching the left-half of the official PDF
- Grid interaction UX + validation feedback
- Playwright E2E that drives the UI

**Progress file:** `STREAM_A_PROGRESS.md` — Agent A updates this throughout work.

### Agent B — Platform foundations
**Goal:** Unblock integration and deployment.
- .NET API scaffold + conventions
- AuthN/AuthZ + TestAuth mode
- EF Core schema + migrations + seed trials
- Background processing (Channels) scaffolding
- Infra (Bicep) scaffold + deploy scripts

**Progress file:** `STREAM_B_PROGRESS.md` — Agent B updates this throughout work.

### Coordinator — Workstream advisor
**Goal:** Advise the human on status, merge readiness, and agent orchestration.
- Status reporting across both workstreams
- Merge readiness analysis against milestone gates
- Cross-stream dependency tracking
- Start/stop/pause recommendations
- Critical path and blocker detection

**Does not write code** — reads progress files and advises.

---

## Progress Tracking

Agents A and B must update their progress files throughout work:

### Status Values
| Status | Icon | Meaning |
|--------|------|---------|
| Not Started | ⬜ | Work item not begun |
| In Progress | 🔄 | Actively working |
| Blocked | 🚧 | Waiting on dependency or issue |
| Completed | ✅ | Done, all validations passed |

### Update Protocol
1. **When starting an item:** Change status to 🔄, update "Current Focus"
2. **When blocked:** Change status to 🚧, add entry to Blockers Log
3. **When completing:** Change status to ✅, add Session Log entry
4. **Always:** Update "Last Updated" timestamp

---

## Collaboration rules
- Prefer narrow PRs and frequent merges.
- Treat API contract in docs/prd/PRD_MVP_API_Contract.md as authoritative unless explicitly updated.
- If an agent needs a contract change, open a work item first and update the PRD (don't silently drift).
- **Update progress files** as work proceeds — the Coordinator and human rely on this.

---

## Shared definitions
- MVP = left-half form + terms + DB insert + PDF gen + email + secretary portal.
- MVP+ = anything not required to submit an ASCA entry and deliver a PDF + notifications.
