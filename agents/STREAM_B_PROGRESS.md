# Stream B Progress Tracker

**Workstream:** Platform (Agent B)  
**Branch:** `feature/stream-b`  
**Last Updated:** 2026-01-22 19:50  
**Current Focus:** B09 User Provisioning

---

## Status Legend
| Status | Meaning |
|--------|---------|
| ⬜ Not Started | Work item not begun |
| 🔄 In Progress | Actively working |
| 🚧 Blocked | Waiting on dependency or issue |
| ✅ Completed | Done, validations passed |

---

## Configuration Items

| ID | Name | Status | Notes |
|----|------|--------|-------|
| CFG01 | Worktree + Port Config | ✅ Completed | |
| CFG02 | Azure CLI Setup | ⬜ Not Started | |

---

## Stream B Work Items

| ID | Name | Status | Blocked By | Notes |
|----|------|--------|------------|-------|
| B01 | API Scaffold | ✅ Completed | CFG01 | |
| B02 | TestAuth Endpoint | ✅ Completed | B01 | TestAuth endpoint + JWT validation + tests |
| B03 | Trials Entity | ✅ Completed | B01 | EF Core entity + migration + tests |
| B04 | TrialCounters Entity | ✅ Completed | B03 | EF Core entity + migration + allocator + tests |
| B05 | Entries Entity | ✅ Completed | B04 | WI_B05 complete |
| B06 | Notifications Entity | ✅ Completed | B05 | EF Core entity + migration + tests |
| B07 | Users Entity | ✅ Completed | B01 | EF Core config + tests + artifacts |
| B08 | JWT Auth Policies | ✅ Completed | B07 | Auth policies + claim mapping + tests |
| B09 | User Provisioning | ✅ Completed | B07, B08 | |
| B10 | Trials Seed | ⬜ Not Started | B03, B04 | |
| B11 | Trials Endpoints | ⬜ Not Started | B10, B08 | Unblocks A04 |
| B12 | Registration Metadata | ⬜ Not Started | B11 | |
| B13 | Form Metadata | ⬜ Not Started | B11 | |
| B14 | Create Draft | ⬜ Not Started | B05, B08, B09 | |
| B15 | Get Entry | ⬜ Not Started | B14 | |
| B16 | Update Entry | ⬜ Not Started | B15 | |
| B17 | Update Selections | ⬜ Not Started | B15 | |
| B18 | Terms Endpoint | ⬜ Not Started | B08 | Unblocks A08 |
| B19 | Submit Endpoint | ⬜ Not Started | B16, B17, B18 | |
| B20 | Background Channels | ⬜ Not Started | B19 | |
| B21 | PDF Stamping | ⬜ Not Started | B20 | |
| B22 | Blob Storage | ⬜ Not Started | B21 | |
| B23 | Email Sender | ⬜ Not Started | B20, B06 | |
| B24 | Processing Status | ⬜ Not Started | B22, B23 | |
| B25 | Secretary Endpoints | ⬜ Not Started | B15, B22 | Unblocks A11 |
| B26 | Bicep Scaffold | ⬜ Not Started | B01 | |
| B27 | Entra External ID | ⬜ Not Started | B26 | |

---

## Milestone Progress

| Milestone | Status | Stream B Items | Notes |
|-----------|--------|----------------|-------|
| M0 | ⬜ Not Started | B01 | Health endpoint |
| M1 | ⬜ Not Started | B05-B10 | Auth + DB |
| M2 | ⬜ Not Started | B11-B17 | Entry CRUD |
| M3 | ⬜ Not Started | B18-B19 | Submit |
| M4 | ⬜ Not Started | B20-B24 | PDF + Email |
| M5 | ⬜ Not Started | B25-B27 | Secretary + Infra |

---

## Blockers Log

_Record any blockers encountered during work._

| Date | Item | Blocker | Resolution | Resolved |
|------|------|---------|------------|----------|
| | | | | |

---

## Items That Unblock Stream A

| Stream B Item | Unblocks | Status | Priority |
|---------------|----------|--------|----------|
| B11 | A04 (Trial Selection) | ⬜ Not Started | High |
| B18 | A08 (Terms Modal) | ⬜ Not Started | Medium |
| B25 | A11 (Secretary Layout) | ⬜ Not Started | Low |

---

## Session Log

_Append entries as work progresses._

```
[2026-01-22 12:00] — B01 — Started API scaffold work — In progress
[2026-01-22 13:36] — B01 — Ran API + tests (health, x-support-id) — ✅
[2026-01-22 13:52] — B02 — Implemented TestAuth endpoint + tests — ✅
[2026-01-22 14:01] — B03 — Added Trials entity + EF Core migration + tests — ✅
[2026-01-22 14:18] — B04 — Added TrialCounters entity + migration + allocator + tests — ✅
[2026-01-22 16:10] — B05 — Started Entries entity work — In progress
[2026-01-22 16:25] — B05 — Regenerated Entries migration via EF tools — In progress
[2026-01-22 16:40] — B05 — Completed Entries entity + artifacts + tests — ✅
[2026-01-22 17:20] — B06 — Added Notifications entity + migration + tests + artifacts — ✅
[2026-01-22 18:05] — B07 — Added Users entity tests + artifacts — ✅
[2026-01-22 19:05] — B08 — Configured JWT policies + role mapping + tests + artifacts — ✅
[2026-01-22 19:50] — B09 — Implemented user provisioning middleware/service + tests + artifacts — ✅
```

<!-- Example:
[2026-01-22 10:30] — B01 — Started API scaffold — In progress
[2026-01-22 11:45] — B01 — Completed, health returns 200 — ✅
-->
