# WI-TERMS1: Terms HTML asset + current terms endpoint

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Ship MVP terms as an in-repo HTML asset (placeholder content) and expose it via `GET /api/terms/current`.

## Scope
### In
- Add a placeholder `terms/v1.html` asset in the API project.
- Implement `GET /api/terms/current` returning `{ version, html }`.
- Store `TermsVersion`, `TermsAcceptedAtUtc`, `TermsAcceptedByUserId` on submit.

### Out
- External CMS hosting for terms (MVP+).

## Implementation notes
- Version string is `v1` (configurable later via `TERMS_VERSION`).
- Response HTML should be safe for display; UI treats it as trusted content from our API.

## Acceptance criteria
- Endpoint returns version `v1` and the placeholder HTML.
- Submit persists acceptance fields when `acceptTerms=true` and version matches.

## Tests
### Playwright
- Submit is gated until checkbox is checked.

### DB validation
- After submit: `TermsVersion=v1`, `TermsAcceptedAtUtc` non-null, `TermsAcceptedByUserId` non-null.

## Telemetry
- Span: `Terms.GetCurrent` (optional) and `Entry.Submit` includes tags for `terms.version`.

## Risks / Questions
- Confirm if any specific legal text is required before MVP release.
