# Parallel execution plan (2-agent)

**Date:** 2026-01-21

## Goal
Maximize early iteration on the on-screen registration form while the platform foundations (API/auth/DB/infra) come online in parallel.

## Streams

### Stream A — UI-first (Agent A)
1) Web shell + routing + layout system (Material/Tailwind/etc.)
2) Trial selection UI (wired to `GET /api/trials` when available; mocked until then)
3) Registration form UI (left-half fields) + validation UX
4) Grid selection UI (upper/lower) + disabled-cell UX
5) Terms UX + gating
6) Secretary portal UI (list/detail)

**Early deliverable:** pixel-accurate(ish) form representation and Playwright driving it.

### Stream B — Platform (Agent B)
1) API skeleton + `/api/health` + correlation header
2) TestAuth endpoint (per PRD) to unblock deterministic Playwright
3) EF Core schema + migrations + JSON-seeded trials
4) Auth policies + role enforcement + user provisioning + allowlist
5) Entry draft/create/update + selections endpoints
6) Submit + validation + terms recording
7) Background processing skeleton (Channels)
8) PDF template load + stamping + blob storage + SAS
9) Email sender + idempotency + status endpoint
10) Infra scaffold (Bicep) once local app shape stabilizes

**Early deliverable:** stable API contract endpoints so UI can stop mocking.

## Integration milestones
- **M0:** both apps boot + smoke Playwright.
- **M1:** TestAuth + Trials API; UI trial selection switches from mock to live.
- **M2:** Draft save/reload end-to-end.
- **M3:** Submit end-to-end (without PDF/email completion).
- **M4:** PDF/email completion + status polling.
- **M5:** Secretary portal complete.

## Work item hygiene
- Any PRD/contract change requires a dedicated work item.
- Keep work items small enough to finish in <1 day of agent time.
