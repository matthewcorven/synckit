# dog-trials.com

This repository is the build-out of the **MVP: Stock Dog Trial Registration** web app.

**Target stack (MVP):** Angular 22 (Azure Static Web Apps) + .NET 10 Web API + EF Core + Azure SQL + Azure Blob + ACS Email + OpenTelemetry.

## What the MVP ships
- Handler + Trial Secretary login (Microsoft Entra External ID)
- Trial selection from a seeded/static list
- On-screen registration form matching the **left-half** of the official ASCA entry form
- Web-style terms acceptance (versioned)
- Submit writes to DB, generates official PDF from template, stores it in blob, and emails handler + secretary
- Secretary portal: list entries, view details, download PDF
- Testability: deterministic Playwright via TestAuth mode (disabled by default)
- Observability: correlated traces/metrics/logs with a Support ID

## What is explicitly out of MVP (MVP+ / future)
- Payments and fee calculation beyond user-entered “Total Entry Fees”
- Wizard mode, PDF upload/extraction
- SMS
- Community forum, training resources, profiles, news, general event directory

## Start here
- Docs index: [docs/README.md](docs/README.md)
- PRDs: [docs/prd](docs/prd)
- Work items: [workitems/README.md](workitems/README.md)
- Agent coordination: [agents/README.md](agents/README.md)