# Worktree Setup for Dual-Stream Development

This project uses git worktrees to enable two AI agents (or developers) to work in parallel on different feature streams without conflicts.

## Port Assignments

| Stream | API Port | Web Port | Branch |
|--------|----------|----------|--------|
| **Stream A** (UI-first) | 5100 | 4200 | `feature/stream-a` |
| **Stream B** (Platform) | 5200 | 4201 | `feature/stream-b` |

## Quick Setup

Run the setup script from the main repository:

```bash
./scripts/setup-worktrees.sh
```

This creates two worktrees:
- `../dog-trials-stream-a` → branch `feature/stream-a`
- `../dog-trials-stream-b` → branch `feature/stream-b`

## Manual Setup

If you prefer to set up manually:

```bash
# Create branches
git branch feature/stream-a
git branch feature/stream-b

# Create worktrees
git worktree add ../dog-trials-stream-a feature/stream-a
git worktree add ../dog-trials-stream-b feature/stream-b
```

## Running the Applications

### Stream A

```bash
cd ../dog-trials-stream-a

# API (port 5100)
cd src/api
dotnet run --launch-profile stream-a

# Web (port 4200)
cd src/web
ng serve --port 4200 --proxy-config proxy.conf.stream-a.json
```

### Stream B

```bash
cd ../dog-trials-stream-b

# API (port 5200)
cd src/api
dotnet run --launch-profile stream-b

# Web (port 4201)
cd src/web
ng serve --port 4201 --proxy-config proxy.conf.stream-b.json
```

## Configuration Files

### API Launch Profiles

Located at `src/api/Properties/launchSettings.json`:
- `stream-a` profile: runs on `http://localhost:5100`
- `stream-b` profile: runs on `http://localhost:5200`

### Web Proxy Configs

- `src/web/proxy.conf.stream-a.json` → proxies `/api/*` to `:5100`
- `src/web/proxy.conf.stream-b.json` → proxies `/api/*` to `:5200`

### Environment Files

- `src/web/environments/environment.stream-a.ts` → `apiPort: 5100`
- `src/web/environments/environment.stream-b.ts` → `apiPort: 5200`

## Worktree Management

### List worktrees

```bash
git worktree list
```

### Remove a worktree

```bash
git worktree remove ../dog-trials-stream-a
```

### Prune stale worktree references

```bash
git worktree prune
```

## Best Practices

1. **Stay on your branch** — Each worktree is locked to its branch. Don't switch branches within a worktree.

2. **Merge frequently** — Keep feature branches up to date with main to minimize conflicts.

3. **Check your location** — Before committing, verify you're in the correct worktree:
   ```bash
   git branch --show-current
   ```

4. **Coordinate on shared files** — If both streams need to modify the same file (e.g., API contracts), communicate and merge promptly.

## Troubleshooting

### Port already in use

If a port is already bound, find and kill the process:

```bash
lsof -i :5100
kill -9 <PID>
```

### Worktree already exists

If the script reports the worktree exists but the directory is missing:

```bash
git worktree prune
./scripts/setup-worktrees.sh
```

### Wrong branch in worktree

Worktrees are locked to their branches. If you need to switch, remove and recreate:

```bash
git worktree remove ../dog-trials-stream-a
git worktree add ../dog-trials-stream-a feature/stream-a
```
