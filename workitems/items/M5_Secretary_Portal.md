# M5: Secretary Portal

**Type:** Milestone Gate  
**Dependencies:** 
- Stream A: A11, A12, A13, A14, A15 (optional: MOCK01)
- Stream B: B25, B26, B27  
**Purpose:** Secretary can view entries, download PDFs; infrastructure deployed.

## Entry Criteria

### Stream A
- [ ] A11 complete (Secretary layout)
- [ ] A12 complete (Entry list view)
- [ ] A13 complete (Entry detail view)
- [ ] A14 complete (PDF download)
- [ ] A15 optional (Mock fixtures folder)

### Stream B
- [ ] B25 complete (Secretary endpoints)
- [ ] B26 complete (Bicep scaffold)
- [ ] B27 complete (Entra External ID)

## Gate Checks

### Secretary UI
- [ ] Secretary can access portal (role-based)
- [ ] Entry list displays with pagination
- [ ] Filter by trial works
- [ ] Filter by status works
- [ ] Entry detail displays full information
- [ ] PDF download works

### Secretary API
- [ ] `GET /api/secretary/entries` returns paginated list
- [ ] `GET /api/secretary/entries/{id}` returns detail
- [ ] `GET /api/secretary/entries/{id}/pdf` returns download URL

### Infrastructure
- [ ] Bicep deploys all resources
- [ ] SQL database accessible
- [ ] Storage account with pdf container
- [ ] Key Vault with secrets
- [ ] App Service running
- [ ] Static Web App serving SPA

### Authentication (Production)
- [ ] Entra External ID configured
- [ ] User flows work
- [ ] Social login works (at least one provider)
- [ ] API validates production tokens

## Verification Commands
```bash
# Secretary flow
SEC_TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Secretary" | jq -r '.accessToken')

# List entries
curl "http://localhost:5200/api/secretary/entries?page=1&pageSize=10" \
  -H "Authorization: Bearer $SEC_TOKEN" | jq

# Get entry detail
curl http://localhost:5200/api/secretary/entries/<entry-id> \
  -H "Authorization: Bearer $SEC_TOKEN" | jq

# Get PDF download URL
curl http://localhost:5200/api/secretary/entries/<entry-id>/pdf \
  -H "Authorization: Bearer $SEC_TOKEN" | jq

# Infrastructure deployment
cd infra
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters params.mvp.json \
  --what-if
```

## Exit Criteria
- [ ] Full secretary portal functional
- [ ] All CRUD operations work
- [ ] PDF downloads work
- [ ] Infrastructure deployed
- [ ] Production auth configured
- [ ] E2E tests pass on deployed environment

## Merge Guidance
- **Final merge to main**
- All features complete
- Full E2E test suite passes
- Ready for production deployment

## Playwright Verification
```typescript
test('secretary views entries', async ({ page }) => {
  await loginAs(page, 'Secretary');
  
  // Navigate to secretary portal
  await page.goto('/secretary');
  
  // Verify entry list loads
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount.greaterThan(1);
  
  // Filter by trial
  await page.getByLabel('Trial').selectOption('Spring Stockdog Trial');
  await expect(page.getByRole('row')).toHaveCount.greaterThan(0);
  
  // View entry detail
  await page.getByRole('row').first().click();
  await expect(page.getByText('Entry Detail')).toBeVisible();
  await expect(page.getByText('Registration #')).toBeVisible();
  
  // Download PDF
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click()
  ]);
  
  expect(download.suggestedFilename()).toContain('.pdf');
});

test('handler cannot access secretary portal', async ({ page }) => {
  await loginAs(page, 'Handler');
  
  // Try to navigate to secretary portal
  await page.goto('/secretary');
  
  // Should be redirected or show unauthorized
  await expect(page).not.toHaveURL(/secretary/);
});
```

## Production Deployment Checklist
- [ ] Bicep deployed without errors
- [ ] SQL migrations applied
- [ ] Trials seeded
- [ ] Terms version configured
- [ ] CORS configured for SWA origin
- [ ] Key Vault secrets populated
- [ ] App Service running
- [ ] SWA deployed
- [ ] Entra External ID configured
- [ ] TestAuth disabled in production
- [ ] Application Insights receiving telemetry
- [ ] DNS/custom domain (if applicable)
