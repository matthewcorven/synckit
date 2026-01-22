# Entra External ID setup (MVP)

This doc is a placeholder for the concrete Microsoft Entra External ID configuration values needed by the SPA (MSAL) and API (JWT validation).

## What we need to fill in
- **Tenant / authority**: `<AUTHORITY_URL>`
- **Client ID (SPA)**: `<SPA_CLIENT_ID>`
- **Audience / API App ID URI**: `<API_AUDIENCE>`
- **Issuer**: `<JWT_ISSUER>`
- **Scopes**: `<API_SCOPES>`
- **Redirect URIs**:
  - Local dev SPA: `http://localhost:<port>/`
  - Deployed SWA: `https://<swa>.azurestaticapps.net/`

## App registrations (recommended)
- SPA app registration for Angular
- API app registration (or exposed API scopes) for .NET Web API

## Runtime configuration (expected)
Backend (App Service / local env vars):
- `AUTH_AUTHORITY`
- `AUTH_AUDIENCE`
- `AUTH_ISSUER`

Frontend (SWA settings / local env):
- `MSAL_AUTHORITY`
- `MSAL_CLIENT_ID`
- `MSAL_SCOPES`

## Notes
- MVP uses **SPA + MSAL**; SWA is static hosting only.
- The API validates bearer JWTs and enforces roles server-side.
