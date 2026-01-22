# WI-CFG01: Worktree & Port Configuration

**Owner:** Both Agents  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** None  
**Artifacts folder (recommended):** `../artifacts/WI-CFG01/`

## Goal
Configure git worktrees and port assignments so both agents can develop in parallel without conflicts.

## Scope
### In
- `scripts/setup-worktrees.sh` — Creates worktrees for `feature/stream-a`, `feature/stream-b`
- `src/api/Properties/launchSettings.json` with profiles per stream
- `src/web/proxy.conf.stream-a.json` and `proxy.conf.stream-b.json`
- Environment files with `apiPort` variable
- Documentation in `docs/setup/Worktree_Setup.md`

### Out
- Actual Angular or .NET project scaffolding (see A01, B01)
- Azure infrastructure configuration (see CFG02)

## Implementation notes
- Port scheme:
  - **Stream A:** API `:5100`, Web `:4200`
  - **Stream B:** API `:5200`, Web `:4201`
- Worktree paths (relative to repo root):
  - `../dog-trials-stream-a` → branch `feature/stream-a`
  - `../dog-trials-stream-b` → branch `feature/stream-b`
- launchSettings.json profiles:
  - `stream-a`: `http://localhost:5100`
  - `stream-b`: `http://localhost:5200`
- Proxy configs route `/api/*` to respective API port

## Acceptance criteria
- [ ] Running `scripts/setup-worktrees.sh` creates both worktrees
- [ ] Each worktree can run API on its designated port without conflict
- [ ] Each worktree can run web on its designated port without conflict
- [ ] Proxy configuration correctly routes `/api/*` to local API

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- N/A — configuration only

**Artifacts (add as relative links during work)**
- N/A

### Integration tests (BDD)
**Artifact requirements**
- Verify script executes without error
- Verify worktrees are created with correct branches

**Artifacts (add as relative links during work)**
- `../artifacts/WI-CFG01/setup-script-output.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — configuration only

**Artifacts (add as relative links during work)**
- N/A

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
- Ensure developers don't accidentally commit to wrong branch
- Consider adding branch indicator to shell prompt in worktrees

## Files to Create

### scripts/setup-worktrees.sh
```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up worktrees for dual-stream development..."

# Create branches if they don't exist
git branch feature/stream-a 2>/dev/null || echo "Branch feature/stream-a already exists"
git branch feature/stream-b 2>/dev/null || echo "Branch feature/stream-b already exists"

# Create worktrees
STREAM_A_PATH="$REPO_ROOT/../dog-trials-stream-a"
STREAM_B_PATH="$REPO_ROOT/../dog-trials-stream-b"

if [ ! -d "$STREAM_A_PATH" ]; then
    git worktree add "$STREAM_A_PATH" feature/stream-a
    echo "Created Stream A worktree at $STREAM_A_PATH"
else
    echo "Stream A worktree already exists at $STREAM_A_PATH"
fi

if [ ! -d "$STREAM_B_PATH" ]; then
    git worktree add "$STREAM_B_PATH" feature/stream-b
    echo "Created Stream B worktree at $STREAM_B_PATH"
else
    echo "Stream B worktree already exists at $STREAM_B_PATH"
fi

echo ""
echo "Worktrees created successfully!"
echo "  Stream A: $STREAM_A_PATH (API :5100, Web :4200)"
echo "  Stream B: $STREAM_B_PATH (API :5200, Web :4201)"
```

### src/api/Properties/launchSettings.json
```json
{
  "profiles": {
    "stream-a": {
      "commandName": "Project",
      "launchBrowser": false,
      "applicationUrl": "http://localhost:5100",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "stream-b": {
      "commandName": "Project",
      "launchBrowser": false,
      "applicationUrl": "http://localhost:5200",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

### src/web/proxy.conf.stream-a.json
```json
{
  "/api": {
    "target": "http://localhost:5100",
    "secure": false,
    "changeOrigin": true
  }
}
```

### src/web/proxy.conf.stream-b.json
```json
{
  "/api": {
    "target": "http://localhost:5200",
    "secure": false,
    "changeOrigin": true
  }
}
```

### src/web/environments/environment.stream-a.ts
```typescript
export const environment = {
  production: false,
  apiPort: 5100,
  useMocks: true
};
```

### src/web/environments/environment.stream-b.ts
```typescript
export const environment = {
  production: false,
  apiPort: 5200,
  useMocks: true
};
```
