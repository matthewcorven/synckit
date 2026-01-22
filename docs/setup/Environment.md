# Environment variables (MVP)

This repo uses a small set of environment variables for local testing and tooling.

## DOGTRIALS_TEST_SQL
**Purpose:** Enables SQL-backed integration tests.

**Used by:** `DogTrials.Api.Tests` (skips SQL tests when not set).

**Example:**
```
DOGTRIALS_TEST_SQL=Server=localhost,1433;Database=DogTrialsTests;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;
```

**Quick start (macOS):**
1) Start SQL Server via Docker: see [docs/setup/Local_Db_Setup.md](Local_Db_Setup.md)
2) Run tests:
```
DOGTRIALS_TEST_SQL='Server=localhost,1433;Database=DogTrialsTests;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;' \
  dotnet test src/api/DogTrials.sln -v minimal
```
