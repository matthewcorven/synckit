# M0: Smoke Both Apps

**Type:** Milestone Gate  
**Dependencies:** CFG01, A01, B01  
**Purpose:** Verify both Angular and .NET apps start and respond to health checks.

## Entry Criteria
- [ ] CFG01 complete (worktrees, ports)
- [ ] A01 complete (Angular scaffold)
- [ ] B01 complete (API scaffold)

## Gate Checks

### Angular SPA
- [ ] `npm install` succeeds in `src/web`
- [ ] `npm start` starts dev server on configured port
- [ ] Browser navigates to `http://localhost:4200` (or 4201 for Stream B worktree)
- [ ] App shell renders without console errors

### .NET API
- [ ] `dotnet restore` succeeds in `src/api`
- [ ] `dotnet run` starts API on configured port
- [ ] `GET /api/health` returns 200 with status "ok"
- [ ] Response includes `utcNow` and `version` fields

### Proxy (if configured)
- [ ] Angular dev proxy routes `/api/*` to API (Stream A only)

## Verification Commands
```bash
# Stream A worktree
cd ~/git/matthewcorven/dog-trials-stream-a

# Start API (terminal 1)
cd src/api && dotnet run --urls=http://localhost:5100

# Start Web (terminal 2)  
cd src/web && npm start -- --port 4200

# Verify health
curl http://localhost:5100/api/health

# Verify proxy (from Angular)
# Navigate to localhost:4200 and check Network tab for /api calls
```

```bash
# Stream B worktree
cd ~/git/matthewcorven/dog-trials-stream-b

# Start API (terminal 1)
cd src/api && dotnet run --urls=http://localhost:5200

# Verify health
curl http://localhost:5200/api/health
```

## Exit Criteria
- [ ] Both apps start without errors
- [ ] Health endpoint returns expected response
- [ ] No port conflicts between worktrees
- [ ] Commits pushed to respective branches

## Merge Guidance
- Stream A and B can proceed independently after this gate
- No cross-stream merge required at M0
- Each stream should have green CI (if configured)
