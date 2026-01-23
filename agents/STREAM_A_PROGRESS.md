# Stream A Progress Tracker

**Workstream:** UI-first (Agent A)  
**Branch:** `feature/stream-a`  
**Last Updated:** 2026-01-23 01:00  
**Current Focus:** A06 — Emergency + Fees

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
| CFG01 | Worktree + Port Config | 🔄 In Progress | |

---

## Stream A Work Items

| ID | Name | Status | Blocked By | Notes |
|----|------|--------|------------|-------|
| A01 | Angular Scaffold | ✅ Completed | CFG01 | |
| A02 | Material + Layout | ✅ Completed | A01 | UI + unit tests + Playwright smoke (unauth) |
| A03 | Form Layout | ✅ Completed | A02 | Layout aligned to PDF; grids updated |
| A04 | Dog Fields | ✅ Completed | A03 | |
| A05 | Contact Fields | ✅ Completed | A04 | |
| A06 | Emergency + Fees | ✅ Completed | A05 | Unit + Playwright tests complete |
| A07 | Grid Cells | ⬜ Not Started | A06 | |
| A08 | Terms Modal | ⬜ Not Started | A07, B18* | *Can mock until B18 ready |
| A09 | Validation Summary | ⬜ Not Started | A08 | |
| A10 | Submit + Confirmation | ⬜ Not Started | A09 | |
| A11 | Secretary Layout | ⬜ Not Started | A03, B25* | *Can mock until B25 ready |
| A12 | Entry List View | ⬜ Not Started | A11 | |
| A13 | Entry Detail View | ⬜ Not Started | A12 | |
| A14 | Playwright Baseline | ✅ Completed | A01 | Unauthenticated smoke tests set up |
| A15 | Mocks Folder | ⬜ Not Started | A01 | Optional |

---

## Milestone Progress

| Milestone | Status | Stream A Items | Notes |
|-----------|--------|----------------|-------|
| M0 | ⬜ Not Started | A01 | Smoke test |
| M1 | ⬜ Not Started | A03 | Auth guards |
| M2 | ⬜ Not Started | A04-A07 | Form + draft |
| M3 | ⬜ Not Started | A08-A10 | Submit flow |
| M5 | ⬜ Not Started | A11-A14 | Secretary portal |

---

## Blockers Log

_Record any blockers encountered during work._

| Date | Item | Blocker | Resolution | Resolved |
|------|------|---------|------------|----------|
| | | | | |

---

## Cross-Stream Dependencies

| Stream A Item | Depends On | Status | Can Mock? |
|---------------|------------|--------|-----------|
| A04 | B11 (Trials API) | ⬜ Not Started | Yes |
| A08 | B18 (Terms API) | ⬜ Not Started | Yes |
| A11 | B25 (Secretary API) | ⬜ Not Started | Yes |

---

## Session Log

_Append entries as work progresses._

```
[YYYY-MM-DD HH:MM] — <item> — <action taken> — <outcome>
[2026-01-22 13:40] — A01 — Started Angular scaffold — In progress
[2026-01-22 14:10] — A01 — Angular scaffold completed — ✅
[2026-01-22 15:10] — A02 — Trial selection UI + unit tests — ✅ (E2E pending)
[2026-01-22 15:25] — A02 — Playwright smoke tests (unauth) — ✅
[2026-01-22 15:25] — A14 — Playwright baseline (unauth) — ✅
[2026-01-22 15:40] — A03 — Started form layout scaffolding — 🔄
[2026-01-22 15:55] — A03 — Added layout styling + section placeholders — 🔄
[2026-01-22 16:15] — A03 — Unit tests pass; layout screenshot captured — 🔄
[2026-01-22 16:25] — A03 — Playwright trace captured — 🔄
[2026-01-22 16:35] — A03 — Header/detail spacing + labeled placeholders — 🔄
[2026-01-22 16:45] — A03 — Panel borders + refreshed layout screenshot — 🔄
[2026-01-22 17:45] — A03 — Completed PDF-aligned layout + grids + screenshots — ✅
[2026-01-22 18:10] — A04 — Started dog fields implementation — 🔄
[2026-01-22 18:50] — A04 — Completed dog fields + tests + Playwright trace — ✅
[2026-01-22 19:10] — A05 — Contact fields + validation + unit tests — ✅
[2026-01-22 19:15] — A05 — Ran web unit tests — ✅
[2026-01-22 19:45] — A05 — Ran Playwright E2E (contact fields) — ✅
[2026-01-22 19:50] — A06 — Started emergency + fees section — 🔄
[2026-01-23 01:00] — A06 — Emergency + fees UI + tests — ✅
```

<!-- Example:
[2026-01-22 10:30] — A01 — Started Angular scaffold — In progress
[2026-01-22 11:45] — A01 — Completed, tests pass — ✅
-->
