# PRD consistency deltas (placeholder)

**Purpose:** This file is intentionally kept as a lightweight place to record *new* cross-PRD inconsistencies as they are discovered.

## Where decisions live now
- Canonical API/DTO decisions: [docs/prd/PRD_MVP_API_Contract.md](../prd/PRD_MVP_API_Contract.md)
- Product behavior decisions: [docs/prd/PRD_MVP_StockDog_Trial_Registration.md](../prd/PRD_MVP_StockDog_Trial_Registration.md)
- DB-first constraints + retry model: [docs/review/DB_Constraints_and_Retry_Model.md](DB_Constraints_and_Retry_Model.md)
- Execution plan + tracking: [workitems/README.md](../../workitems/README.md)

## How to use this file
- Add a short bullet describing the inconsistency and the files involved.
- Either:
  - update the relevant PRD(s) to resolve it, or
  - create a work item in `workitems/items/` and link it here.
- Once resolved, remove the bullet.
