# M3: Submit + Validation

**Type:** Milestone Gate  
**Dependencies:** 
- Stream A: A08, A09, A10
- Stream B: B18, B19  
**Purpose:** Entry submission works with full validation and terms acceptance.

## Entry Criteria

### Stream A
- [ ] A08 complete (Terms modal)
- [ ] A09 complete (Validation summary)
- [ ] A10 complete (Submit + confirmation)

### Stream B
- [ ] B18 complete (Terms endpoint)
- [ ] B19 complete (Submit endpoint)

## Gate Checks

### Terms Flow
- [ ] `GET /api/terms/current` returns terms HTML
- [ ] Terms modal displays terms content
- [ ] User can scroll through terms
- [ ] Accept checkbox enables submit button
- [ ] Terms version tracked

### Validation
- [ ] Required field validation works
  - Dog call name
  - Dog breed
  - Handler email
  - At least one grid selection
- [ ] Disabled cell validation works (server rejects)
- [ ] Email match validation (if configured)
- [ ] Validation errors display in summary
- [ ] Field-level errors highlight fields

### Submit
- [ ] Submit button disabled until valid + terms accepted
- [ ] `POST /api/entries/{id}/submit` validates and processes
- [ ] Registration number generated
- [ ] Entry status transitions to Submitted
- [ ] Confirmation page displays
- [ ] Support ID displayed

### Error Handling
- [ ] 400 validation errors display correctly
- [ ] 409 already submitted handled
- [ ] Network errors display friendly message

## Verification Commands
```bash
TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Handler" | jq -r '.accessToken')

# Get terms
curl http://localhost:5200/api/terms/current \
  -H "Authorization: Bearer $TOKEN" | jq

# Submit (assuming draft created and populated)
curl -X POST http://localhost:5200/api/entries/<entry-id>/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"acceptTerms": true, "termsVersion": "v1"}'

# Verify submitted
curl http://localhost:5200/api/entries/<entry-id> \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .dog.registrationOrTrackingNumber'
```

## Exit Criteria
- [ ] Complete submit flow works end-to-end
- [ ] All validations enforced
- [ ] Terms acceptance recorded
- [ ] Registration number generated correctly
- [ ] Confirmation displays

## Merge Guidance
- Merge both streams after M3
- This is a major integration point
- All handler flows complete at this milestone

## Playwright Verification
```typescript
test('submit with validation', async ({ page }) => {
  await loginAs(page, 'Handler');
  
  // Create draft with trial
  await selectTrial(page, 'Spring Stockdog Trial');
  
  // Try to submit without required fields
  await page.getByRole('button', { name: 'Submit Entry' }).click();
  
  // Verify validation errors
  await expect(page.getByText('Call Name is required')).toBeVisible();
  await expect(page.getByText('At least one class selection required')).toBeVisible();
  
  // Fill required fields
  await page.getByLabel('Call Name').fill('Ranger');
  await page.getByLabel('Breed').fill('Australian Shepherd');
  await page.getByLabel('Email').fill('handler@test.com');
  await page.getByTestId('grid-upper-sheep-std').click();
  
  // Submit
  await page.getByRole('button', { name: 'Submit Entry' }).click();
  
  // Accept terms
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByText('I accept the terms').click();
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Verify confirmation
  await expect(page.getByText('Entry Submitted')).toBeVisible();
  await expect(page.getByText(/Registration #: .+-\d{4}/)).toBeVisible();
});

test('validation prevents disabled cell submit', async ({ page }) => {
  // Fill form with valid data
  // Try to POST selection to disabled cell via API
  // Verify 400 response
});
```
