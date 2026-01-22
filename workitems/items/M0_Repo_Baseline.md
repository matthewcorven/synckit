# M0: Repo + baseline build

**Owner:** Agent B (platform) + Agent A (UI)  
**Status:** Ready  
**Dependencies:** none

## Goal
Create the minimum scaffolding so both agents can build and test locally.

## Scope (In)
- `src/web` Angular 22 app skeleton
- `src/api` .NET 10 API skeleton
- `src/tests/e2e` Playwright scaffold and first smoke test
- Basic scripts to run all three

## Acceptance criteria
- `src/web` builds and serves locally.
- `src/api` runs locally and exposes `GET /api/health`.
- Playwright smoke loads the web app and asserts a visible shell element.

## Tests
- Playwright: `smoke.spec.ts`.

## Telemetry
- Stub correlation: API sets `x-support-id` header on every response.
