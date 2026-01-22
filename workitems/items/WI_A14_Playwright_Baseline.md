# WI-A14: Playwright Baseline

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** A01, B02  
**Artifacts folder (recommended):** `../artifacts/WI-A14/`

## Goal
Set up Playwright testing infrastructure with TestAuth helper and baseline smoke tests.

## Scope
### In
- Playwright project setup in `src/tests/e2e/`
- `playwright.config.ts` configuration
- TestAuth helper (`loginAs(role)`)
- Smoke test: app boots and displays
- Test fixtures for common setup
- CI-ready configuration

### Out
- Feature-specific tests (added in each work item)
- TestAuth endpoint (see B02)

## Implementation notes
- Playwright config:
  - Base URL from environment
  - Stream A: `http://localhost:4200`
  - Stream B: `http://localhost:4201`
- TestAuth helper:
  - Calls `POST /api/testauth/token`
  - Sets headers: `X-Test-Auth-Secret`, `X-Test-Role`
  - Stores token for subsequent requests
  - Clears storage between tests
- Test structure:
  - `tests/smoke.spec.ts` — Basic app loading
  - `tests/auth.spec.ts` — TestAuth flow verification
  - `fixtures/` — Reusable test setup
  - `helpers/` — Utility functions

## Acceptance criteria
- [ ] Playwright runs with `npx playwright test`
- [ ] `loginAs('Handler')` returns valid token
- [ ] `loginAs('Secretary')` returns valid token
- [ ] Smoke test passes (app loads)
- [ ] Tests generate trace files
- [ ] Configuration works for both streams

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
- TestAuth helper works
- Trace files generated

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A14/playwright/smoke-trace.zip`
- `../artifacts/WI-A14/playwright/test-results.txt`

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
- Ensure TestAuth endpoint (B02) is ready before full testing
- Parallel test execution considerations

## Project Structure
```
src/tests/e2e/
├── playwright.config.ts
├── package.json
├── tests/
│   ├── smoke.spec.ts
│   ├── auth.spec.ts
│   └── (feature tests added later)
├── fixtures/
│   └── test-fixtures.ts
├── helpers/
│   └── auth-helper.ts
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

### helpers/auth-helper.ts
```typescript
import { APIRequestContext } from '@playwright/test';

export interface TestAuthConfig {
  secret: string;
  apiUrl: string;
}

export async function loginAs(
  request: APIRequestContext,
  role: 'Handler' | 'Secretary',
  config: TestAuthConfig
): Promise<string> {
  const response = await request.post(`${config.apiUrl}/api/testauth/token`, {
    headers: {
      'X-Test-Auth-Secret': config.secret,
      'X-Test-Role': role,
    },
  });

  if (!response.ok()) {
    throw new Error(`TestAuth failed: ${response.status()}`);
  }

  const data = await response.json();
  return data.accessToken;
}
```

### tests/smoke.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test('app loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dog Trials/);
});

test('navigation to trials page', async ({ page }) => {
  await page.goto('/trials');
  await expect(page.locator('h1')).toContainText('Trials');
});
```
