# M1: Auth, schema, trials

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Establish identity, RBAC, and the database schema with seeded trials.

## Scope
- JWT validation + role policies (Handler/Secretary)
- TestAuth mode for Playwright (per PRD)
- EF Core entities + migrations
- Seed trials
- `GET /api/trials`

Additional DB enforcement (must be in place before submit):
- Implement [WI-DB1](WI_DB_Constraints_and_Retry_Model.md) (constraints/counters/retry fields)

## Acceptance criteria
- Trial list renders in UI for authenticated handler.
- Secretary-only endpoints return 403 to handler.
- DB contains seeded trials with `OrganizerSlug` + `EventSlug` (and deterministic `TrackingSlug`).
