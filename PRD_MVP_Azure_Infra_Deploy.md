# PRD — Azure Infrastructure + Deployment (Workstation → Azure via CLI)

**Assumptions**
- Developers deploy from workstation using Azure CLI.
- The deployed environment is effectively “public production” with limited audience; safety controls are required.

---

## 1) Azure resources (MVP)
- Resource Group
- Azure Static Web Apps (Angular)
- Azure App Service (API, .NET 10)
- Azure SQL Server + Database
- Storage account + private blob container `pdf`
- Key Vault
- Application Insights
- Azure Communication Services Email

---

## 2) Infrastructure as Code (Bicep)
Repo:
- `/infra/main.bicep`
- `/infra/params.mvp.json`
- `/infra/scripts/deploy.ps1` (or bash)

Command example:
- `az deployment group create --resource-group <rg> --template-file ./infra/main.bicep --parameters ./infra/params.mvp.json`

**Acceptance criteria**
- Re-running the deployment is safe and idempotent.
- Outputs include SWA URL and API URL.

---

## 3) Secrets and configuration
Store secrets in Key Vault:
- SQL connection string
- Storage connection string (or MI config)
- ACS Email connection string
- External ID config values (authority/audience/client id)
- TestAuth secret and signing key (only if used; default disabled)

App settings:
- `ENABLE_TEST_AUTH=false` by default
- `SECRETARY_EMAIL_ALLOWLIST` set
- `TERMS_VERSION` set

---

## 4) Deployment approach

### 4.1 API deploy
- `dotnet publish -c Release`
- deploy via `az webapp deploy` (zip) OR standard container deploy (pick one)

### 4.2 SWA deploy
- build Angular
- deploy with `swa deploy` or `az staticwebapp`

**Acceptance criteria**
- SWA serves app and proxies `/api/*` correctly.

---

## 5) Database migrations (code-first)
- Provide explicit script to run `dotnet ef database update` against Azure SQL.
- SQL firewall rule added temporarily to allow workstation IP (document process).

**Acceptance criteria**
- Schema exists and trials are seeded.

---

## 6) Observability wiring
- OpenTelemetry configured and exporting to Application Insights.
- Logs are structured; do not emit PII.

**Acceptance criteria**
- Submit flow produces trace with entryId and child spans for pdf/email processing.

---

## 7) Production safety controls
- TestAuth disabled by default and gated by secret + allowlist when enabled.
- Rate limit submit endpoint.
- Blob is private; PDFs served via SAS with TTL.
- CORS restricted to SWA origin only.

