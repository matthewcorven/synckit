# M4: PDF + Email

**Type:** Milestone Gate  
**Dependencies:** 
- Stream A: (no new items, uses existing confirmation)
- Stream B: B20, B21, B22, B23, B24  
**Purpose:** Background processing generates PDF and sends email notifications.

## Entry Criteria

### Stream B
- [ ] B20 complete (Background channels)
- [ ] B21 complete (PDF stamping)
- [ ] B22 complete (Blob storage)
- [ ] B23 complete (Email sender)
- [ ] B24 complete (Processing status)

## Gate Checks

### Background Processing
- [ ] Submit enqueues PDF job
- [ ] PDF job generates valid PDF
- [ ] PDF uploaded to blob storage with deterministic name
- [ ] PDF job enqueues email jobs on success
- [ ] Email jobs send to handler and secretary
- [ ] All statuses tracked correctly

### PDF Generation
- [ ] Template loaded
- [ ] All form fields stamped
- [ ] Grid selections marked
- [ ] Registration number appears
- [ ] PDF is valid/viewable

### Blob Storage
- [ ] PDF stored at `entries/{entryId}.pdf`
- [ ] Overwrite works for regeneration
- [ ] SAS URLs generated with correct TTL

### Email Notifications
- [ ] Handler receives confirmation email
- [ ] Secretary receives notification email
- [ ] PDF download link in emails
- [ ] Links work (24-hour TTL)

### Processing Status
- [ ] Status endpoint returns current state
- [ ] PDF status transitions: Queued → InProgress → Success
- [ ] Email statuses transition correctly
- [ ] Download URL available when PDF ready

### Idempotency
- [ ] Re-submit doesn't regenerate PDF if Success
- [ ] Re-process doesn't resend email if Success
- [ ] Restart recovers incomplete work

## Verification Commands
```bash
TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Handler" | jq -r '.accessToken')

SEC_TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Secretary" | jq -r '.accessToken')

# Submit entry (from M3)
# ...

# Poll processing status
curl http://localhost:5200/api/admin/entries/<entry-id>/processing-status \
  -H "Authorization: Bearer $SEC_TOKEN" | jq

# Download PDF (once ready)
PDF_URL=$(curl -s http://localhost:5200/api/admin/entries/<entry-id>/processing-status \
  -H "Authorization: Bearer $SEC_TOKEN" | jq -r '.generatedPdfDownloadUrl')
  
curl -o entry.pdf "$PDF_URL"
open entry.pdf
```

## Exit Criteria
- [ ] End-to-end flow: submit → PDF → email works
- [ ] All statuses tracked
- [ ] Idempotency verified
- [ ] Error handling works
- [ ] Retry logic works

## Merge Guidance
- Merge Stream B items after M4
- Background processing is the critical path
- Test with real Azure resources if possible

## Playwright Verification
```typescript
test('submit generates PDF and sends emails', async ({ page, request }) => {
  const config = await getTestAuthConfig();
  
  // Login and submit entry (from M3)
  await loginAs(page, 'Handler');
  const entryId = await submitCompleteEntry(page);
  
  // Poll for completion
  const status = await waitForProcessingComplete(request, entryId, config);
  
  // Verify PDF ready
  expect(status.pdfStatus).toBe('Success');
  expect(status.generatedPdfDownloadUrl).toBeTruthy();
  
  // Verify emails sent
  expect(status.emailNotifications).toHaveLength(2);
  expect(status.emailNotifications.find(n => n.recipientType === 'Handler')?.status).toBe('Success');
  expect(status.emailNotifications.find(n => n.recipientType === 'Secretary')?.status).toBe('Success');
  
  // Download PDF
  const pdfResponse = await request.get(status.generatedPdfDownloadUrl);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
});
```

## Telemetry Verification
```
Trace: Entry.Submit
  └── Pdf.Generate (pdf.status=Success)
      ├── Email.Send (recipientType=Handler, email.status=Success)
      └── Email.Send (recipientType=Secretary, email.status=Success)
```
