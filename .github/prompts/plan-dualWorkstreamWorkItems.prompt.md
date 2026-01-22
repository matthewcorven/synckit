# Plan: Create Comprehensive Dual-Workstream Work Items

Two git worktrees (`feature/stream-a`, `feature/stream-b`) with distinct ports. 48 work items total (2 config, 15 Stream A, 24 Stream B, 6 milestones, 1 mocks). Azure CLI deploy to `de345105-2ffc-4619-a6bc-9c41dec93241`, region `eastus`, prefix `dgmvp`. Entra External ID setup as hybrid (scripted + Portal docs).

## Steps

### 1. Create WI_CFG01_Worktree_Port_Config.md

Path: `workitems/items/WI_CFG01_Worktree_Port_Config.md`

Content:
- `scripts/setup-worktrees.sh` — Creates worktrees for `feature/stream-a`, `feature/stream-b`
- Port scheme:
  - Stream A: API `:5100`, Web `:4200`
  - Stream B: API `:5200`, Web `:4201`
- `src/api/Properties/launchSettings.json` profiles per stream
- `src/web/proxy.conf.stream-a.json` and `proxy.conf.stream-b.json`
- Environment files with `apiPort` variable

### 2. Create WI_CFG02_Azure_CLI_Setup.md

Path: `workitems/items/WI_CFG02_Azure_CLI_Setup.md`

Content:
- `scripts/azure-login.sh` with `az login` + device code flow
- `az account set --subscription de345105-2ffc-4619-a6bc-9c41dec93241`
- Verification step: `az account show`
- `docs/setup/Azure_CLI_Auth.md` documentation
- `infra/params.mvp.json` with:
  - subscription: `de345105-2ffc-4619-a6bc-9c41dec93241`
  - region: `eastus`
  - prefix: `dgmvp`
  - resourceGroup: `rg-dgmvp`

### 3. Create Stream A Work Items (15 files)

| File | Title | Scope |
|------|-------|-------|
| `WI_A01_Angular_Scaffold.md` | Angular Scaffold | Angular 22 + Material + routing shell |
| `WI_A02_Trial_Selection_UI.md` | Trial Selection UI | Trial list page + mock fixture |
| `WI_A03_Form_Layout.md` | Form Layout | Left-half pixel-match layout |
| `WI_A04_Dog_Fields.md` | Dog Fields | Dog section reactive form |
| `WI_A05_Contact_Fields.md` | Contact Fields | Contact + address sub-form |
| `WI_A06_Emergency_Fees.md` | Emergency & Fees | Emergency contact + fees |
| `WI_A07_Upper_Grid.md` | Upper Grid | Upper grid component + disabled cells |
| `WI_A08_Lower_Grid.md` | Lower Grid | Lower grid component + disabled cells |
| `WI_A09_Validation_UX.md` | Validation UX | Inline errors + summary |
| `WI_A10_Terms_Modal.md` | Terms Modal | Terms modal + checkbox gate |
| `WI_A11_Submit_Flow_UI.md` | Submit Flow UI | Submit + confirmation + Support ID |
| `WI_A12_Secretary_List.md` | Secretary List | Secretary entry list page |
| `WI_A13_Secretary_Detail.md` | Secretary Detail | Secretary detail + PDF link |
| `WI_A14_Playwright_Baseline.md` | Playwright Baseline | TestAuth helper + smoke tests |
| `WI_A15_Mocks_Folder.md` | Mocks Folder | `src/web/mocks/` structure + types |

### 4. Create Stream B Work Items (24 files)

| File | Title | Scope |
|------|-------|-------|
| `WI_B01_API_Scaffold.md` | API Scaffold | .NET 10 + `/api/health` + correlation |
| `WI_B02_TestAuth.md` | TestAuth Endpoint | `POST /api/testauth/token` gated endpoint |
| `WI_B03_Trials_Entity.md` | Trials Entity | EF Core Trials + migration |
| `WI_B04_TrialCounters_Entity.md` | TrialCounters Entity | Sequence allocation entity |
| `WI_B05_Entries_Entity.md` | Entries Entity | Entries + filtered unique indexes |
| `WI_B06_Notifications_Entity.md` | Notifications Entity | Notifications + retry indexes |
| `WI_B07_Users_Entity.md` | Users Entity | Users + external subject mapping |
| `WI_B08_JWT_Auth_Policies.md` | JWT Auth Policies | Bearer validation + role policies |
| `WI_B09_User_Provisioning.md` | User Provisioning | Auto-upsert + secretary allowlist |
| `WI_B10_Trials_Seed.md` | Trials Seed | `trials.seed.json` + startup seeder |
| `WI_B11_Trials_Endpoints.md` | Trials Endpoints | `GET /api/trials`, `GET /api/trials/{id}` |
| `WI_B12_Registration_Metadata.md` | Registration Metadata | `GET /api/trials/{id}/registration/metadata` |
| `WI_B13_Form_Metadata.md` | Form Metadata | `GET /api/form-templates/.../metadata` |
| `WI_B14_Create_Draft.md` | Create Draft | `POST /api/entries` |
| `WI_B15_Get_Entry.md` | Get Entry | `GET /api/entries/{entryId}` |
| `WI_B16_Update_Entry.md` | Update Entry | `PUT /api/entries/{entryId}` |
| `WI_B17_Update_Selections.md` | Update Selections | `PUT /api/entries/{entryId}/selections` |
| `WI_B18_Terms_Endpoint.md` | Terms Endpoint | `GET /api/terms/current` + HTML asset |
| `WI_B19_Submit_Endpoint.md` | Submit Endpoint | `POST .../submit` + validation + sequence |
| `WI_B20_Background_Channels.md` | Background Channels | Channels + hosted service + restart scan |
| `WI_B21_PDF_Stamping.md` | PDF Stamping | Library + template + stamping service |
| `WI_B22_Blob_Storage.md` | Blob Storage | PDF blob + SAS + PdfStatus tracking |
| `WI_B23_Email_Sender.md` | Email Sender | ACS Email + Notifications tracking |
| `WI_B24_Processing_Status.md` | Processing Status | `GET /api/admin/.../processing-status` |
| `WI_B25_Secretary_Endpoints.md` | Secretary Endpoints | Secretary list/detail/PDF download |
| `WI_B26_Bicep_Scaffold.md` | Bicep Scaffold | `infra/main.bicep` + all resources + random SQL password to KV |
| `WI_B27_Entra_External_ID.md` | Entra External ID | Hybrid: `az rest` scripts + Portal docs for user flows |

### 5. Create Milestone Gates (6 files)

| File | Title | Dependencies | Merge Criteria |
|------|-------|--------------|----------------|
| `M0_Smoke_Both_Apps.md` | Smoke Both Apps | A01, B01 | Both apps boot, smoke Playwright passes |
| `M1_TestAuth_Trials_Live.md` | TestAuth & Trials Live | A02, B02, B11 | TestAuth works, UI switches mock→live |
| `M2_Draft_Save_E2E.md` | Draft Save E2E | A03-A08, B14-B17 | Draft save/reload end-to-end |
| `M3_Submit_E2E.md` | Submit E2E | A09-A11, B18-B19 | Submit without PDF/email |
| `M4_PDF_Email_Complete.md` | PDF & Email Complete | B20-B24 | PDF + email + status polling works |
| `M5_Secretary_Portal.md` | Secretary Portal E2E | A12-A13, B25 | Secretary portal end-to-end |

### 6. Create WI_MOCK01_Fixtures.md

Path: `workitems/items/WI_MOCK01_Fixtures.md`

Content:
- `src/web/mocks/` folder structure
- `trials.mock.json` — Array of `TrialSummaryDto`
- `formMetadata.mock.json` — `FormMetadataDto` with grids/disabled cells
- `entry.mock.json` — `EntryDetailDto` sample
- `terms.mock.json` — `TermsDto` with HTML
- Typed interfaces matching API contract DTOs
- `useMocks` environment flag in `environment.ts`

### 7. Update PLAN_Parallel.md

Path: `workitems/PLAN_Parallel.md`

Add:
- Full work item table with IDs/titles/stream/milestone
- Mermaid dependency DAG
- Azure config block (subscription, region, prefix, RG)
- Port assignments table
- Branch strategy (Option A: merge at milestones)
- Critical-path annotations (`B02→A14`, `B11→A02 live`)

---

## Dependency Summary (Critical Path)

```
WI_CFG01 + WI_CFG02 (parallel, first)
    ↓
WI_A01 ←──────────────────────────→ WI_B01
    ↓                                  ↓
M0 (merge gate)                    WI_B02 (TestAuth)
    ↓                                  ↓
WI_A14 (Playwright) ←─────────────────┘
    ↓
WI_A02 (mock) ──→ M1 ←── WI_B11 (trials live)
    ↓                        ↓
WI_A03-A08 ←────────────→ WI_B14-B17
    ↓                        ↓
M2 (draft E2E)
    ↓
WI_A09-A11 ←────────────→ WI_B18-B19
    ↓                        ↓
M3 (submit E2E)
                             ↓
                         WI_B20-B24
                             ↓
                         M4 (PDF/email)
    ↓                        ↓
WI_A12-A13 ←────────────→ WI_B25
    ↓                        ↓
M5 (secretary E2E)
```

---

## Azure Resources (Bicep output)

| Resource | Name | Notes |
|----------|------|-------|
| Resource Group | `rg-dgmvp` | Created first |
| App Service Plan | `dgmvp-plan` | Linux, B1 |
| App Service | `dgmvp-api` | .NET 10 |
| Static Web App | `dgmvp-web` | Angular |
| SQL Server | `dgmvp-sql` | Random admin password |
| SQL Database | `dgmvp-db` | Basic tier |
| Storage Account | `dgmvpstorage` | Blob container `pdf` |
| Key Vault | `dgmvp-kv` | Stores SQL password, connection strings |
| App Insights | `dgmvp-insights` | OpenTelemetry sink |
| Log Analytics | `dgmvp-logs` | Required by App Insights |
| ACS Email | `dgmvp-acs` | Handler + secretary notifications |
| Entra External ID | `dgmvp-extid` | Microsoft/Google/Apple/email login |

---

## Work Item Template Reference

All work items use template: `workitems/templates/workitem.md`

Required sections per work item:
- **Goal** (1-2 sentences)
- **Scope In/Out** (explicit boundaries)
- **Implementation notes** (API contract, errors, correlation, TestAuth, async, logging)
- **Acceptance criteria** (concrete, testable)
- **Test Plan** with artifact requirements:
  - Unit tests (TDD)
  - Integration tests (BDD)
  - E2E (Playwright)
  - DB verification
  - Telemetry verification
- **Risks / Questions**

---

## PRD References (Sources of Truth)

- API Contract: `docs/prd/PRD_MVP_API_Contract.md`
- Test Strategy: `docs/prd/PRD_MVP_Test_Strategy.md`
- DB Constraints: `docs/review/DB_Constraints_and_Retry_Model.md`
- Azure Infra: `docs/prd/PRD_MVP_Azure_Infra_Deploy.md`
- Local Dev Routing: `docs/setup/Local_Dev_Routing.md`
- Agent Coordination: `agents/README.md`
