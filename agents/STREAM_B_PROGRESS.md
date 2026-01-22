# Stream B Progress Tracker

**Workstream:** Platform (Agent B)  
**Branch:** `feature/stream-b`  
**Last Updated:** 2026-01-22 21:05  
**Current Focus:** B12 Registration Metadata

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
| B02 | Problem Details | ✅ Completed | B01 | |
| B03 | OpenTelemetry | ✅ Completed | B01 | |
| B04 | Correlation Headers | ✅ Completed | B02, B03 | |
| B05 | DbContext Scaffold | ✅ Completed | B01 | |
| B06 | Entries Entity | ✅ Completed | B05 | |
| B07 | DB Constraints | ✅ Completed | B06 | |
| B08 | JWT Middleware | ✅ Completed| B01 | |
| B09 | User Provisioning | ✅ Completed | B08, B05 | |
| B10 | Trials Seed | ✅ Completed | B03, B04 |  |
| B11 | Trials Endpoints | ✅ Completed | B10, B08 | Unblocks A04 |
| B12 | Registration Metadata | 🔄 In Progress | B11 | Implementing endpoint, service, migration, and tests |
| B13 | Form Metadata | ⬜ Not Started | B11 | |
| B14 | Create Draft | ⬜ Not Started | B06, B08 | |
| B15 | Get Entry | ⬜ Not Started | B14 | |
| B16 | Update Entry | ⬜ Not Started | B15 | |
| B17 | Update Selections | ⬜ Not Started | B15 | |
| B18 | Terms Endpoint | ⬜ Not Started | B01 | Unblocks A08 |
| B19 | Submit Endpoint | ⬜ Not Started | B07, B16, B17 | |
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
| B02 | A14 (Playwright Auth) | ⬜ Not Started | **Critical** |
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
[2026-01-22 20:30] — B10 — Added trial seed file, seeding service, tests, and artifacts — ✅
[2026-01-22 21:05] — B11 — Implemented trials endpoints + tests + artifacts — ✅
[2026-01-22 21:12] — B12 — Started registration metadata implementation — 🔄 In Progress
[2026-01-22 21:12] — B12 — Implemented endpoint, service, migration, and tests — ✅
[2026-01-22 21:21] — B12 — Added `formtemplates.seed.json` and seeding in `TrialSeedingService` — ✅
[2026-01-22 21:24] — B12 — Added telemetry span tag `trial.id` and test asserting it — ✅
[2026-01-22 21:21] — B12 — Added tests for seeding idempotency and parsing — ✅
```

<!-- Example:
[2026-01-22 10:30] — B01 — Started API scaffold — In progress
[2026-01-22 11:45] — B01 — Completed, health returns 200 — ✅
-->
