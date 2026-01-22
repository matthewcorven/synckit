# Work items

These work items are the canonical execution plan for autonomous coding agents.

## How we work
- Each work item lives in `workitems/items/` and follows the template in `workitems/templates/`.
- Every work item must include: implementation, tests (Playwright and/or DB validation), and telemetry updates.
- Prefer small, mergeable increments.

## Execution plan
- [Parallel plan (2-agent)](PLAN_Parallel.md)
- PRD review notes: [docs/review/PRD_Consistency_Deltas.md](../docs/review/PRD_Consistency_Deltas.md)

## Current plan
- [Milestone M0 — Repo + baseline build](items/M0_Repo_Baseline.md)
- [Milestone M1 — Auth, schema, trials](items/M1_Auth_Schema_Trials.md)
- [WI-DEV1 — Local dev proxy + env config](items/WI_Local_Dev_Proxy_Config.md)
- [WI-SEED1 — Trials seed file + seeding behavior](items/WI_Trial_Seed_File.md)
- [WI-TERMS1 — Terms HTML asset + current terms endpoint](items/WI_Terms_Asset_and_Endpoint.md)
- [WI-GRID1 — Form/grid metadata endpoint](items/WI_Form_Metadata_Endpoint.md)
- [WI-PDF0 — Pick permissive OSS PDF stamping library](items/WI_PDF_Library_Selection.md)
- [WI-DB1 — DB constraints + counters + retry fields](items/WI_DB_Constraints_and_Retry_Model.md)
- [Milestone M2 — Form UI + draft/save](items/M2_Form_Draft_Save.md)
- [Milestone M3 — Submit + validation + terms](items/M3_Submit_Terms_Validation.md)
- [Milestone M4 — PDF + Email processing](items/M4_Pdf_Email_Processing.md)
- [Milestone M5 — Secretary portal](items/M5_Secretary_Portal.md)

## Parallelization (initial)
- Stream A (UI-first): build trial selection + on-screen form + grid interactions.
- Stream B (platform): scaffold API + auth + DB schema + infra skeleton.

See [agents/README.md](../agents/README.md) for coordination rules.
