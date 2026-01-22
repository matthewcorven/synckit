# PRD consistency deltas (living)

**Purpose:** Capture cross-document inconsistencies, ambiguities, or missing decisions that would otherwise cause implementation drift.

## Where decisions live now
- Canonical API/DTO decisions: [docs/prd/PRD_MVP_API_Contract.md](../prd/PRD_MVP_API_Contract.md)
- Product behavior decisions: [docs/prd/PRD_MVP_StockDog_Trial_Registration.md](../prd/PRD_MVP_StockDog_Trial_Registration.md)
- DB-first constraints + retry model: [docs/review/DB_Constraints_and_Retry_Model.md](DB_Constraints_and_Retry_Model.md)
- Execution plan + tracking: work items (excluded from this review)

## How to use this file
- Add a short bullet describing the inconsistency and the files involved.
- Either:
  - update the relevant PRD(s) to resolve it, or
  - create a work item in `workitems/items/` and link it here.
- Once resolved, remove the bullet.

## Deltas blocking final work-item breakdown
_No open blocking deltas at this time._

## Non-blocking inconsistencies / polish
_No open polish deltas at this time._

## Recently resolved (2026-01-21)
- Standardized Registration/Tracking # format to `trackingSlug-0001`.
- Updated disabled-cell examples to reflect full MVP default rules.
- Clarified identity mapping: JWT `sub` → internal `Users.ExternalSubject` → internal `UserId` stored as `Entries.CreatedByUserId`; clarified authenticated email claim fallback order.
- Clarified deployed routing: SWA uses `API_BASE_URL` (no same-origin `/api` proxy to App Service).
- Documented ProblemDetails extensions (`errorCode`) and cleaned up telemetry tag duplication.
- Clarified DB constraints doc scope.
