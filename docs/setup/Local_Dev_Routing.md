# Local development routing (MVP)

## Goal
Keep local development simple and deterministic, without relying on production routing behavior.

## Decision
- **Local dev:** Angular uses a dev-server proxy so the SPA can call relative `/api/*` without CORS.
- **Deployed:** SPA calls the API by its own origin using `API_BASE_URL`; CORS is restricted to SWA + approved dev origins.

## Expected implementation
- Angular dev proxy config routes `/api` → `https://localhost:<api-port>/api`.
- Production SPA configuration provides `API_BASE_URL` (App Service URL or custom domain).

## Why
- Minimizes CORS complexity during rapid UI iteration.
- Keeps the API contract stable (`/api/*` paths) across environments.
