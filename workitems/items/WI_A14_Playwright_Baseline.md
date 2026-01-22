# WI-A14: Playwright Baseline

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** A01  
**Artifacts folder (recommended):** `../artifacts/WI-A14/`

## Goal
Set up Playwright testing infrastructure with unauthenticated baseline smoke tests.

## Scope
### In
- Playwright project setup in `src/tests/e2e/`
- `playwright.config.ts` configuration
- Smoke test: app boots and displays (unauthenticated)
- CI-ready configuration

### Out
- Feature-specific tests (added in each work item)
- TestAuth endpoint + helpers (added after B02)

## Implementation notes
- Playwright config:
  - Base URL from environment
  - Stream A: `http://localhost:4200`
  - Stream B: `http://localhost:4201`
- Test structure:
  - `tests/smoke.spec.ts` — Basic app loading
  - (auth tests added after B02)

## Acceptance criteria
- [ ] Playwright runs with `npx playwright test`
- [ ] Smoke test passes (app loads)
- [ ] Tests generate trace files
- [ ] Configuration works for Stream A

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- N/A — this is test infrastructure

**Artifacts (add as relative links during work)**
- N/A

### Integration tests (BDD)
**Artifact requirements**
- N/A — this is test infrastructure

**Artifacts (add as relative links during work)**
- N/A

### E2E (BDD, Playwright)
**Artifact requirements**
- Smoke test passes
- Trace files generated

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A14/playwright/smoke-trace.zip](../artifacts/WI-A14/playwright/smoke-trace.zip)
- [../artifacts/WI-A14/playwright/test-results.txt](../artifacts/WI-A14/playwright/test-results.txt)

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Add TestAuth endpoint (B02) before authenticated tests
- Parallel test execution considerations

## Project Structure
```
src/tests/e2e/
├── playwright.config.ts
├── package.json
├── tests/
│   ├── smoke.spec.ts
│   └── (feature tests added later)
└── .env.example
```

## Key Files

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:stream-a',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});
```

### tests/smoke.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test('app loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-title').first()).toHaveText('Dog Trials');
});

test('navigation to trials page', async ({ page }) => {
  await page.goto('/trials');
  await expect(page.locator('mat-card-title', { hasText: 'Trials' }).first()).toBeVisible();
});
```
