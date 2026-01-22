# WI-SEED1: Trials seed file + seeding behavior

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Add a committed trials seed JSON file and ensure trials are seeded into Azure SQL during migration/startup.

## Scope
### In
- Create an API asset file like `trials.seed.json` committed to repo.
- Seed at least a minimal trial set including:
  - `OrganizerSlug`, `EventSlug` (to form deterministic `TrackingSlug`)
  - `SecretaryEmail`
  - `IsActive`
- Seeding is idempotent (safe to rerun).

### Out
- Admin CRUD UI for trials (MVP+).

## Acceptance criteria
- Fresh DB migration results in at least 1 active trial.
- `GET /api/trials` returns seeded trials.

## Tests
### Playwright
- Trial list renders at least one seeded item.

### DB validation
- Trials table contains expected slugs and secretary email.

## Telemetry
- Log a single startup message indicating seeding ran (no PII).

## Risks / Questions
- Confirm minimum number of trials to seed for MVP demo.
