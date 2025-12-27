# Integration tests (server/typescript)

These tests validate shared database migrations and other integration scenarios that require Postgres and Redis.

Requirements
- Docker (for Testcontainers or Docker Compose)
- Bun (or use the Docker image provided by the repo)

Run locally (using Testcontainers - recommended):

1. Install deps:
   ```bash
   cd server/typescript
   bun install
   ```

2. Run only integration tests:
   ```bash
   bun test tests/integration --summary
   ```

Run locally (using Docker Compose):

1. Start services:
   ```bash
   docker compose -f server/typescript/docker-compose.yml up -d postgres redis
   ```

2. Run tests (this will use Testcontainers for TypeScript tests or connect to the services if applicable):
   ```bash
   cd server/typescript
   bun install
   bun test tests/integration --summary
   ```

Notes
- Tests are resilient when Docker/Testcontainers are unavailable and will skip gracefully in developer environments or CI where Docker isn't available.
- CI: See `.github/workflows/integration-tests.yml` for how GitHub Actions brings up services and runs both TypeScript and C# integration tests.
