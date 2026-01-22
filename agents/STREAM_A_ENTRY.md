# Stream A — UI-First Agent Entry Point

**Role:** Agent A — UI-First Iteration  
**Branch:** `feature/stream-a`  
**Ports:** API `:5100`, Web `:4200`

---

## Your Mission
Build the Angular SPA with pixel-accurate form representation and Playwright E2E tests. Work with mocks initially, then switch to live API as Stream B delivers endpoints.

## Quick Start
1. Set up your worktree: `git worktree add ../dog-trials-stream-a feature/stream-a`
2. Use port config: API `:5100`, Web `:4200`
3. Start with: **WI_A01_Angular_Scaffold.md**

---

## Your Work Items (Sequential Order)

| ID | Title | Milestone | Depends On |
|----|-------|-----------|------------|
| [WI_A01](../workitems/items/WI_A01_Angular_Scaffold.md) | Angular Scaffold | M0 | CFG01 |
| [WI_A02](../workitems/items/WI_A02_Trial_Selection_UI.md) | Trial Selection UI | M1 | A01, MOCK01 |
| [WI_A03](../workitems/items/WI_A03_Form_Layout.md) | Form Layout | M2 | A02 |
| [WI_A04](../workitems/items/WI_A04_Dog_Fields.md) | Dog Fields | M2 | A03 |
| [WI_A05](../workitems/items/WI_A05_Contact_Fields.md) | Contact Fields | M2 | A03 |
| [WI_A06](../workitems/items/WI_A06_Emergency_Fees.md) | Emergency & Fees | M2 | A03 |
| [WI_A07](../workitems/items/WI_A07_Upper_Grid.md) | Upper Grid | M2 | A03 |
| [WI_A08](../workitems/items/WI_A08_Lower_Grid.md) | Lower Grid | M2 | A07 |
| [WI_A09](../workitems/items/WI_A09_Validation_UX.md) | Validation UX | M3 | A04-A08 |
| [WI_A10](../workitems/items/WI_A10_Terms_Modal.md) | Terms Modal | M3 | A09 |
| [WI_A11](../workitems/items/WI_A11_Submit_Flow_UI.md) | Submit Flow UI | M3 | A10 |
| [WI_A12](../workitems/items/WI_A12_Secretary_List.md) | Secretary List | M5 | A11 |
| [WI_A13](../workitems/items/WI_A13_Secretary_Detail.md) | Secretary Detail | M5 | A12 |
| [WI_A14](../workitems/items/WI_A14_Playwright_Baseline.md) | Playwright Baseline | M0 | A01, B02 |
| [WI_A15](../workitems/items/WI_A15_Mocks_Folder.md) | Mocks Folder | M1 | A01 |

---

## Critical Integration Points

### You Need From Stream B
| What | When | Work Item |
|------|------|-----------|
| TestAuth endpoint | Before M0 Playwright | B02 |
| `GET /api/trials` | Before M1 live switch | B11 |
| `GET /api/trials/{id}/registration/metadata` | Before M2 form | B12 |
| Entry CRUD endpoints | Before M2 draft save | B14-B17 |
| `GET /api/terms/current` | Before M3 terms modal | B18 |
| `POST .../submit` | Before M3 submit | B19 |
| `GET .../processing-status` | Before M4 polling | B24 |
| Secretary endpoints | Before M5 portal | B25 |

### You Provide To Stream B
| What | When | Purpose |
|------|------|---------|
| Mocks folder structure | M1 | Contract validation |
| Playwright tests | All milestones | Integration verification |
| UI validation rules | M3 | Server-side parity check |

---

## Milestone Gates (Your Involvement)

| Milestone | Stream A Required | Stream B Required | Merge Criteria |
|-----------|-------------------|-------------------|----------------|
| [M0](../workitems/items/M0_Smoke_Both_Apps.md) | A01, A14 | B01, B02 | Both apps boot, smoke passes |
| [M1](../workitems/items/M1_TestAuth_Trials_Live.md) | A02, A15 | B02, B11 | UI switches mock→live |
| [M2](../workitems/items/M2_Draft_Save_E2E.md) | A03-A08 | B14-B17 | Draft save/reload E2E |
| [M3](../workitems/items/M3_Submit_E2E.md) | A09-A11 | B18-B19 | Submit E2E (no PDF/email) |
| [M4](../workitems/items/M4_PDF_Email_Complete.md) | — | B20-B24 | PDF+email+polling |
| [M5](../workitems/items/M5_Secretary_Portal.md) | A12-A13 | B25 | Secretary portal E2E |

---

## Key PRD References

- **API Contract:** [PRD_MVP_API_Contract.md](../docs/prd/PRD_MVP_API_Contract.md) — DTOs, endpoints, error format
- **Test Strategy:** [PRD_MVP_Test_Strategy.md](../docs/prd/PRD_MVP_Test_Strategy.md) — Playwright requirements
- **Local Dev Routing:** [Local_Dev_Routing.md](../docs/setup/Local_Dev_Routing.md) — Proxy configuration
- **Agent Coordination:** [agents/README.md](README.md) — Collaboration rules

---

## Environment Configuration

```bash
# Stream A Ports
API_PORT=5100
WEB_PORT=4200

# Proxy config
proxy.conf.stream-a.json → localhost:5100

# Environment file
environment.stream-a.ts:
  apiPort: 5100
  useMocks: true  # Switch to false when B11 is ready
```

---

## Working with Mocks

Until Stream B endpoints are ready:
1. Use `src/web/mocks/` fixtures (created in MOCK01)
2. Set `useMocks: true` in environment
3. Services should check flag and return mock data
4. At each milestone, switch relevant mocks → live

Mock → Live Transition:
- **M1:** `trials.mock.json` → `GET /api/trials`
- **M2:** `entry.mock.json` → Entry CRUD endpoints
- **M3:** `terms.mock.json` → `GET /api/terms/current`

---

## Communication Protocol

When you hit a blocker requiring Stream B:
1. Check if the dependency work item is complete
2. If blocked, document in your work item's Risks section
3. Continue with mock-based development
4. Re-integrate when dependency is ready

When approaching a milestone gate:
1. Ensure all your required work items are Done
2. Verify Playwright tests pass with your changes
3. Coordinate merge timing with Stream B agent
