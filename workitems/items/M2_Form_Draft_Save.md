# M2: Form UI + Draft Save

**Type:** Milestone Gate  
**Dependencies:** 
- Stream A: A04, A05, A06, A07
- Stream B: B11, B12, B13, B14, B15, B16, B17  
**Purpose:** Registration form renders, user can select trial and save draft entry.

## Entry Criteria

### Stream A
- [ ] A04 complete (Trial selection)
- [ ] A05 complete (Registration form)
- [ ] A06 complete (Dog/Handler fields)
- [ ] A07 complete (Grid cells)

### Stream B
- [ ] B11 complete (Trials endpoints)
- [ ] B12 complete (Registration metadata)
- [ ] B13 complete (Form metadata)
- [ ] B14 complete (Create draft)
- [ ] B15 complete (Get entry)
- [ ] B16 complete (Update entry)
- [ ] B17 complete (Update selections)

## Gate Checks

### UI Flow
- [ ] Trial list displays from API
- [ ] User can select a trial
- [ ] Registration form renders with all fields
- [ ] Grid component renders with correct layout
- [ ] Disabled cells are not selectable
- [ ] User can fill dog information
- [ ] User can fill handler/contact information
- [ ] User can select grid cells
- [ ] User can clear grid cells

### API Flow
- [ ] `GET /api/trials` returns trial list
- [ ] `GET /api/trials/{id}/registration/metadata` returns form config
- [ ] `POST /api/entries` creates draft entry
- [ ] `GET /api/entries/{id}` returns entry detail
- [ ] `PUT /api/entries/{id}` updates entry fields
- [ ] `PUT /api/entries/{id}/selections` updates grid selections

### Draft Persistence
- [ ] Create draft on trial selection
- [ ] Save draft as user types (debounced)
- [ ] Reload page maintains draft data
- [ ] Grid selections persist

## Verification Commands
```bash
# Get trials
TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Handler" | jq -r '.accessToken')

curl http://localhost:5200/api/trials \
  -H "Authorization: Bearer $TOKEN" | jq

# Create draft
curl -X POST http://localhost:5200/api/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trialId": "<trial-id-from-above>"}'

# Update entry
curl -X PUT http://localhost:5200/api/entries/<entry-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dog": {"callName": "Ranger", "breed": "Australian Shepherd"}}'

# Update selections
curl -X PUT http://localhost:5200/api/entries/<entry-id>/selections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grid": "Upper", "items": [{"row": "Sheep", "col": "STD", "value": "X"}]}'
```

## Exit Criteria
- [ ] Full form renders without errors
- [ ] All CRUD operations work
- [ ] Draft persistence verified
- [ ] Grid interactions work correctly
- [ ] Disabled cells enforced

## Merge Guidance
- **Integration merge recommended** at M2
- Merge both streams to `main` or integration branch
- Run full E2E test suite
- Resolve any contract mismatches

## Playwright Verification
```typescript
test('draft save flow', async ({ page }) => {
  await loginAs(page, 'Handler');
  
  // Select trial
  await page.getByRole('button', { name: 'Select Trial' }).click();
  await page.getByText('Spring Stockdog Trial').click();
  
  // Fill form
  await page.getByLabel('Call Name').fill('Ranger');
  await page.getByLabel('Breed').fill('Australian Shepherd');
  
  // Select grid cell
  await page.getByTestId('grid-upper-sheep-std').click();
  
  // Wait for autosave
  await page.waitForTimeout(2000);
  
  // Reload
  await page.reload();
  
  // Verify persistence
  await expect(page.getByLabel('Call Name')).toHaveValue('Ranger');
  await expect(page.getByTestId('grid-upper-sheep-std')).toHaveAttribute('data-selected', 'true');
});
```
