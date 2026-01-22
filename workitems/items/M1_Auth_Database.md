# M1: Auth + Database

**Type:** Milestone Gate  
**Dependencies:** 
- Stream A: A03 (routing)
- Stream B: B05, B06, B07, B08, B09, B10  
**Purpose:** JWT auth works, database schema deployed, users provisioned.

## Entry Criteria

### Stream A
- [ ] A03 complete (routing with auth guards)

### Stream B
- [ ] B05 complete (DbContext scaffold)
- [ ] B06 complete (Entries entity)
- [ ] B07 complete (DB constraints)
- [ ] B08 complete (JWT middleware)
- [ ] B09 complete (User provisioning)
- [ ] B10 complete (TestAuth endpoint)

## Gate Checks

### Database
- [ ] EF migrations generated
- [ ] Local SQL Server/container running
- [ ] Migrations apply successfully
- [ ] Tables created with correct constraints:
  - Trials (with OrganizerSlug + EventSlug unique index)
  - TrialCounters
  - Entries (with SequenceNumber + RegNumber unique indexes)
  - Notifications
  - Users

### Authentication
- [ ] TestAuth endpoint returns valid JWT for Handler role
- [ ] TestAuth endpoint returns valid JWT for Secretary role
- [ ] JWT middleware validates tokens
- [ ] User provisioning creates user on first auth
- [ ] Protected endpoints reject unauthenticated requests

### Angular Guards
- [ ] Auth guard redirects unauthenticated users
- [ ] Role guards work (if implemented)

## Verification Commands
```bash
# Database (from Stream B worktree)
cd src/api
dotnet ef migrations add InitialCreate
dotnet ef database update

# Verify tables exist
sqlcmd -S localhost -d dogtrials -Q "SELECT name FROM sys.tables"

# TestAuth
curl -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Handler"

# Protected endpoint (should fail without token)
curl http://localhost:5200/api/entries
# Expected: 401

# With token
TOKEN=$(curl -s -X POST http://localhost:5200/api/testauth/token \
  -H "X-Test-Auth-Secret: test-secret-for-dev" \
  -H "X-Test-Role: Handler" | jq -r '.accessToken')
  
curl http://localhost:5200/api/entries \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 (empty array)
```

## Exit Criteria
- [ ] Database schema matches PRD spec
- [ ] All constraints verified
- [ ] JWT validation works
- [ ] TestAuth produces valid tokens
- [ ] User provisioning creates records
- [ ] Angular guards protect routes (Stream A)

## Merge Guidance
- Stream B: Merge B05-B10 to `feature/stream-b` branch
- Stream A: Merge A03 to `feature/stream-a` branch
- **Integration merge point**: Both streams ready for API contract testing
- After M1, Stream A can start calling real endpoints if integration is desired
