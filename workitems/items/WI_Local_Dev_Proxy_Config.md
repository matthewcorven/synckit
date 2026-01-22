# WI-DEV1: Local dev proxy + env config

**Owner:** Agent A (web) + Agent B (api)  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Standardize local dev routing so the SPA can call `/api/*` without CORS, while production uses `API_BASE_URL`.

## Scope
### In
- Angular dev proxy config to route `/api` to local API.
- Document required env vars and defaults.
- Ensure deployed SPA uses `API_BASE_URL` (CORS restricted to SWA origin + approved dev origins).

### Out
- Front Door / reverse proxy for same-origin in prod (MVP+).

## Acceptance criteria
- Local: UI can call `GET /api/health` successfully.
- Deployed: UI calls App Service API origin successfully with CORS restricted.

## Tests
### Playwright
- Smoke test hits `GET /api/health` from UI context.

### DB validation
- N/A.

## Telemetry
- N/A.

## Risks / Questions
- Confirm local ports for web and API projects once scaffolded.
