# Stream B — Platform Foundations Agent Entry Point

**Role:** Agent B — Platform Foundations  
**Branch:** `feature/stream-b`  
**Ports:** API `:5200`, Web `:4201`  
**Progress File:** `agents/STREAM_B_PROGRESS.md` ← **Update this throughout your work**

---

## Your Mission
Build the .NET API, database schema, auth, background processing, and Azure infrastructure. Deliver stable API endpoints so Stream A can switch from mocks to live.

## Quick Start
1. Set up your worktree: `git worktree add ../dog-trials-stream-b feature/stream-b`
2. Use port config: API `:5200`, Web `:4201`
3. Start with: **WI_B01_API_Scaffold.md**
4. **Update `STREAM_B_PROGRESS.md` as you work** (see Progress Tracking below)

---

## Your Work Items (Sequential Order)

| ID | Title | Milestone | Depends On |
|----|-------|-----------|------------|
| [WI_B01](../workitems/items/WI_B01_API_Scaffold.md) | API Scaffold | M0 | CFG01 |
| [WI_B02](../workitems/items/WI_B02_TestAuth.md) | TestAuth Endpoint | M0 | B01 |
| [WI_B03](../workitems/items/WI_B03_Trials_Entity.md) | Trials Entity | M1 | B01 |
| [WI_B04](../workitems/items/WI_B04_TrialCounters_Entity.md) | TrialCounters Entity | M1 | B03 |
| [WI_B05](../workitems/items/WI_B05_Entries_Entity.md) | Entries Entity | M1 | B04 |
| [WI_B06](../workitems/items/WI_B06_Notifications_Entity.md) | Notifications Entity | M1 | B05 |
| [WI_B07](../workitems/items/WI_B07_Users_Entity.md) | Users Entity | M1 | B01 |
| [WI_B08](../workitems/items/WI_B08_JWT_Auth_Policies.md) | JWT Auth Policies | M1 | B07 |
| [WI_B09](../workitems/items/WI_B09_User_Provisioning.md) | User Provisioning | M1 | B07, B08 |
| [WI_B10](../workitems/items/WI_B10_Trials_Seed.md) | Trials Seed | M1 | B03, B04 |
| [WI_B11](../workitems/items/WI_B11_Trials_Endpoints.md) | Trials Endpoints | M1 | B10, B08 |
| [WI_B12](../workitems/items/WI_B12_Registration_Metadata.md) | Registration Metadata | M2 | B11 |
| [WI_B13](../workitems/items/WI_B13_Form_Metadata.md) | Form Metadata | M2 | B11 |
| [WI_B14](../workitems/items/WI_B14_Create_Draft.md) | Create Draft | M2 | B05, B08, B09 |
| [WI_B15](../workitems/items/WI_B15_Get_Entry.md) | Get Entry | M2 | B14 |
| [WI_B16](../workitems/items/WI_B16_Update_Entry.md) | Update Entry | M2 | B15 |
| [WI_B17](../workitems/items/WI_B17_Update_Selections.md) | Update Selections | M2 | B15 |
| [WI_B18](../workitems/items/WI_B18_Terms_Endpoint.md) | Terms Endpoint | M3 | B08 |
| [WI_B19](../workitems/items/WI_B19_Submit_Endpoint.md) | Submit Endpoint | M3 | B16, B17, B18 |
| [WI_B20](../workitems/items/WI_B20_Background_Channels.md) | Background Channels | M4 | B19 |
| [WI_B21](../workitems/items/WI_B21_PDF_Stamping.md) | PDF Stamping | M4 | B20 |
| [WI_B22](../workitems/items/WI_B22_Blob_Storage.md) | Blob Storage | M4 | B21 |
| [WI_B23](../workitems/items/WI_B23_Email_Sender.md) | Email Sender | M4 | B20, B06 |
| [WI_B24](../workitems/items/WI_B24_Processing_Status.md) | Processing Status | M4 | B22, B23 |
| [WI_B25](../workitems/items/WI_B25_Secretary_Endpoints.md) | Secretary Endpoints | M5 | B15, B22 |
| [WI_B26](../workitems/items/WI_B26_Bicep_Scaffold.md) | Bicep Scaffold | M5 | B01 |
| [WI_B27](../workitems/items/WI_B27_Entra_External_ID.md) | Entra External ID | M5 | B26 |

---

## Progress Tracking Protocol

**You MUST update `STREAM_B_PROGRESS.md` throughout your work:**

1. **When starting an item:** Change status to `🔄 In Progress`, update "Current Focus"
2. **When blocked:** Change status to `🚧 Blocked`, add entry to Blockers Log
3. **When completing:** Change status to `✅ Completed`, add Session Log entry
4. **Always:** Update "Last Updated" timestamp

### Status Values
| Status | Meaning |
|--------|--------|
| ⬜ Not Started | Work item not begun |
| 🔄 In Progress | Actively working |
| 🚧 Blocked | Waiting on dependency or issue |
| ✅ Completed | Done, validations passed |

### Session Log Format
```
[YYYY-MM-DD HH:MM] — <item> — <action> — <outcome>
```

### Priority: Items That Unblock Stream A
These items should be prioritized as they enable Stream A progress:
- **B11** (Trials Endpoints) → Unblocks A04
- **B18** (Terms Endpoint) → Unblocks A08
- **B25** (Secretary Endpoints) → Unblocks A11

---

## Critical Integration Points

### Stream A Depends On You For
| What | When | Your Work Item |
|------|------|----------------|
| TestAuth endpoint | M0 (Playwright) | B02 |
| `GET /api/trials` | M1 (live switch) | B11 |
| `GET /api/trials/{id}/registration/metadata` | M2 (form) | B12 |
| Entry CRUD endpoints | M2 (draft save) | B14-B17 |
| `GET /api/terms/current` | M3 (terms modal) | B18 |
| `POST .../submit` | M3 (submit) | B19 |
| `GET .../processing-status` | M4 (polling) | B24 |
| Secretary endpoints | M5 (portal) | B25 |

### You Use From Stream A
| What | When | Purpose |
|------|------|---------|
| Mock DTOs | Contract validation | Ensure API matches expected shapes |
| Playwright tests | All milestones | Integration verification |

---

## Milestone Gates (Your Involvement)

| Milestone | Stream A Required | Stream B Required | Merge Criteria |
|-----------|-------------------|-------------------|----------------|
| [M0](../workitems/items/M0_Smoke_Both_Apps.md) | A01, A14 | B01, B02 | Both apps boot, smoke passes |
| [M1](../workitems/items/M1_TestAuth_Trials_Live.md) | A02, A15 | B02, B11 | UI switches mock→live |
| [M2](../workitems/items/M2_Draft_Save_E2E.md) | A03-A08 | B12-B17 | Draft save/reload E2E |
| [M3](../workitems/items/M3_Submit_E2E.md) | A09-A11 | B18-B19 | Submit E2E (no PDF/email) |
| [M4](../workitems/items/M4_PDF_Email_Complete.md) | — | B20-B24 | PDF+email+polling |
| [M5](../workitems/items/M5_Secretary_Portal.md) | A12-A13 | B25-B27 | Secretary portal E2E |

---

## Key PRD References

- **API Contract:** [PRD_MVP_API_Contract.md](../docs/prd/PRD_MVP_API_Contract.md) — DTOs, endpoints, error format
- **Test Strategy:** [PRD_MVP_Test_Strategy.md](../docs/prd/PRD_MVP_Test_Strategy.md) — TestAuth, Playwright
- **DB Constraints:** [DB_Constraints_and_Retry_Model.md](../docs/review/DB_Constraints_and_Retry_Model.md) — Schema, indexes, retry
- **Azure Infra:** [PRD_MVP_Azure_Infra_Deploy.md](../docs/prd/PRD_MVP_Azure_Infra_Deploy.md) — Bicep, deploy
- **Agent Coordination:** [agents/README.md](README.md) — Collaboration rules

---

## Environment Configuration

```bash
# Stream B Ports
API_PORT=5200
WEB_PORT=4201

# launchSettings.json profile: "stream-b"
applicationUrl: "https://localhost:5201;http://localhost:5200"

# Proxy config (if running web locally)
proxy.conf.stream-b.json → localhost:5200
```

---

## Azure Configuration

```json
// infra/params.mvp.json
{
  "subscription": "de345105-2ffc-4619-a6bc-9c41dec93241",
  "region": "eastus",
  "prefix": "dgmvp",
  "resourceGroup": "rg-dgmvp"
}
```

### Resource Naming Convention
| Resource | Name |
|----------|------|
| Resource Group | `rg-dgmvp` |
| App Service Plan | `dgmvp-plan` |
| App Service | `dgmvp-api` |
| Static Web App | `dgmvp-web` |
| SQL Server | `dgmvp-sql` |
| SQL Database | `dgmvp-db` |
| Storage Account | `dgmvpstorage` |
| Key Vault | `dgmvp-kv` |
| App Insights | `dgmvp-insights` |
| Log Analytics | `dgmvp-logs` |
| ACS Email | `dgmvp-acs` |

---

## Database Schema Order

Build entities in this order (respects FK dependencies):

1. **Users** (B07) — No FK dependencies
2. **Trials** (B03) — No FK dependencies
3. **TrialCounters** (B04) — FK → Trials
4. **Entries** (B05) — FK → Trials, Users
5. **Notifications** (B06) — FK → Entries

### Critical Constraints (from DB_Constraints_and_Retry_Model.md)
- `UX_Trials_OrganizerSlug_EventSlug` — Unique trial identity
- `UX_Entries_TrialId_SequenceNumber` — Filtered unique (WHERE NOT NULL)
- `UX_Entries_RegistrationOrTrackingNumber` — Filtered unique (WHERE NOT NULL)
- `UX_Notifications_EntryId_RecipientType` — One notification per type per entry

---

## TestAuth (Critical for M0)

TestAuth is **required** for deterministic Playwright tests. Implement in B02:

```
POST /api/testauth/token
Headers:
  X-Test-Auth-Secret: <secret>
  X-Test-Role: Handler|Secretary
Response:
  { "accessToken": "<jwt>", "expiresInSeconds": 900, "role": "Handler" }
```

Safety controls:
- `ENABLE_TEST_AUTH=false` by default
- When disabled, return 404 (not 403)
- Log all TestAuth usage as security event

---

## Communication Protocol

When Stream A is blocked waiting for your endpoint:
1. Prioritize the blocking work item
2. Document ETA in the work item
3. Consider deploying a stub that returns mock data

When approaching a milestone gate:
1. Ensure all your required work items are Done
2. Verify API returns correct DTOs per contract
3. Run any available Playwright tests
4. Coordinate merge timing with Stream A agent
