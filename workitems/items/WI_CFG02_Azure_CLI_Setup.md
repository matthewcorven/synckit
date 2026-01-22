# WI-CFG02: Azure CLI Setup

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** None  
**Artifacts folder (recommended):** `../artifacts/WI-CFG02/`

## Goal
Configure Azure CLI authentication and infrastructure parameters for deployment to the target subscription.

## Scope
### In
- `scripts/azure-login.sh` with `az login` + device code flow
- Subscription selection: `de345105-2ffc-4619-a6bc-9c41dec93241`
- `infra/params.mvp.json` with subscription, region, prefix, resource group
- Documentation in `docs/setup/Azure_CLI_Auth.md`

### Out
- Actual Bicep templates (see B26)
- Entra External ID setup (see B27)
- Key Vault secret population (see B26)

## Implementation notes
- Subscription ID: `de345105-2ffc-4619-a6bc-9c41dec93241`
- Region: `eastus`
- Naming prefix: `dgmvp`
- Resource Group: `rg-dgmvp`
- Use device code flow for CI/CD compatibility
- Verification step ensures correct subscription is selected

## Acceptance criteria
- [ ] Running `scripts/azure-login.sh` authenticates and sets correct subscription
- [ ] `az account show` displays subscription `de345105-2ffc-4619-a6bc-9c41dec93241`
- [ ] `infra/params.mvp.json` contains all required parameters
- [ ] Documentation explains the login process

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- N/A — configuration only

**Artifacts (add as relative links during work)**
- N/A

### Integration tests (BDD)
**Artifact requirements**
- Verify `az account show` output after running login script

**Artifacts (add as relative links during work)**
- `../artifacts/WI-CFG02/az-account-show.txt`

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
- Ensure subscription has sufficient quota for resources
- Verify user has Contributor role on subscription

## Files to Create

### scripts/azure-login.sh
```bash
#!/bin/bash
set -e

SUBSCRIPTION_ID="de345105-2ffc-4619-a6bc-9c41dec93241"

echo "Logging into Azure..."
az login --use-device-code

echo ""
echo "Setting subscription to $SUBSCRIPTION_ID..."
az account set --subscription "$SUBSCRIPTION_ID"

echo ""
echo "Verifying subscription..."
az account show --output table

echo ""
echo "Azure CLI configured successfully!"
echo "Subscription: $SUBSCRIPTION_ID"
echo "Run 'az account show' to verify at any time."
```

### infra/params.mvp.json
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "subscription": {
      "value": "de345105-2ffc-4619-a6bc-9c41dec93241"
    },
    "region": {
      "value": "eastus"
    },
    "prefix": {
      "value": "dgmvp"
    },
    "resourceGroup": {
      "value": "rg-dgmvp"
    },
    "sqlAdminLogin": {
      "value": "sqladmin"
    },
    "enableTestAuth": {
      "value": false
    }
  }
}
```

### docs/setup/Azure_CLI_Auth.md
```markdown
# Azure CLI Authentication Setup

## Prerequisites
- Azure CLI installed (`az --version`)
- Access to subscription `de345105-2ffc-4619-a6bc-9c41dec93241`
- Contributor role on the subscription

## Quick Start

```bash
# Run the login script
./scripts/azure-login.sh
```

This will:
1. Open device code authentication
2. Set the correct subscription
3. Display verification output

## Manual Steps

If you prefer manual setup:

```bash
# Login with device code (works in containers/SSH)
az login --use-device-code

# Set subscription
az account set --subscription de345105-2ffc-4619-a6bc-9c41dec93241

# Verify
az account show
```

## Verification

After login, verify you see:

| Field | Expected Value |
|-------|---------------|
| Subscription ID | `de345105-2ffc-4619-a6bc-9c41dec93241` |
| State | `Enabled` |

## Troubleshooting

### "Subscription not found"
- Verify you have access to the subscription
- Check with your Azure administrator

### "Not authorized"
- Ensure you have at least Contributor role
- Request access from subscription owner

## Resource Naming Convention

All resources use prefix `dgmvp`:

| Resource | Name |
|----------|------|
| Resource Group | `rg-dgmvp` |
| App Service Plan | `dgmvp-plan` |
| App Service (API) | `dgmvp-api` |
| Static Web App | `dgmvp-web` |
| SQL Server | `dgmvp-sql` |
| SQL Database | `dgmvp-db` |
| Storage Account | `dgmvpstorage` |
| Key Vault | `dgmvp-kv` |
| App Insights | `dgmvp-insights` |
| Log Analytics | `dgmvp-logs` |
| ACS Email | `dgmvp-acs` |
```
