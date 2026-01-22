# WI-B26: Bicep Scaffold

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M5  
**Dependencies:** B01  
**Artifacts folder (recommended):** `../artifacts/WI-B26/`

## Goal
Create Bicep templates for all Azure resources required by MVP.

## Scope
### In
- `infra/main.bicep` — Main template
- All MVP resources:
  - Resource Group
  - App Service Plan + App Service (API)
  - Static Web App (Angular)
  - SQL Server + Database
  - Storage Account + container
  - Key Vault
  - Application Insights + Log Analytics
  - ACS Email (reference only — may need Portal)
- Random SQL admin password → Key Vault
- Deployment scripts
- `infra/params.mvp.json` parameters

### Out
- Entra External ID (see B27)
- Domain configuration
- SSL certificates (handled by Azure)

## Implementation notes
- Prefix: `dgmvp`
- Region: `eastus`
- Resource Group: `rg-dgmvp`
- Use secure parameters for secrets
- Generate random SQL password and store in Key Vault
- Configure Key Vault access for App Service
- Enable managed identity on App Service
- Idempotent deployment

## Acceptance criteria
- [ ] Bicep validates without errors
- [ ] Deployment creates all resources
- [ ] Re-deployment is idempotent
- [ ] SQL password in Key Vault
- [ ] App Service can access Key Vault
- [ ] Storage container created

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- N/A — infrastructure

**Artifacts (add as relative links during work)**
- N/A

### Integration tests (BDD)
**Artifact requirements**
- Deployment completes successfully
- Resources accessible

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B26/deployment-output.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — infrastructure

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Database accessible
- Schema migration runs

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B26/db/connection-test.txt`

### Telemetry verification
- App Insights receiving data

**Artifact requirements**
- Screenshot of App Insights

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B26/telemetry/appinsights-screenshot.png`

## Risks / Questions
- ACS Email may require Portal setup
- SQL firewall rules for deployment

## Bicep Template: infra/main.bicep
```bicep
targetScope = 'subscription'

@description('The environment name (dev, staging, prod)')
param environment string = 'dev'

@description('The Azure region for resources')
param location string = 'eastus'

@description('Resource naming prefix')
param prefix string = 'dgmvp'

@description('SQL admin username')
param sqlAdminLogin string = 'sqladmin'

@secure()
@description('SQL admin password (auto-generated if not provided)')
param sqlAdminPassword string = newGuid()

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${prefix}'
  location: location
}

// Deploy resources in resource group scope
module resources 'modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    prefix: prefix
    location: location
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
  }
}

output apiUrl string = resources.outputs.apiUrl
output webUrl string = resources.outputs.webUrl
output sqlServerFqdn string = resources.outputs.sqlServerFqdn
output keyVaultName string = resources.outputs.keyVaultName
```

## Module: infra/modules/resources.bicep
```bicep
param prefix string
param location string
param sqlAdminLogin string
@secure()
param sqlAdminPassword string

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: '${prefix}-kv'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Store SQL password in Key Vault
resource sqlPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'sql-admin-password'
  properties: {
    value: sqlAdminPassword
  }
}

// SQL Server
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${prefix}-sql'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

// SQL Database
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: '${prefix}-db'
  location: location
  sku: { name: 'Basic', tier: 'Basic' }
}

// SQL Firewall - Allow Azure services
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Storage Account
resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: '${prefix}storage'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// Blob container for PDFs
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: storage
  name: 'default'
}

resource pdfContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'pdf'
  properties: {
    publicAccess: 'None'
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${prefix}-plan'
  location: location
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic' }
  properties: {
    reserved: true
  }
}

// App Service (API)
resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: '${prefix}-api'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appSettings: [
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'KeyVaultName', value: keyVault.name }
      ]
    }
  }
}

// Static Web App
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: '${prefix}-web'
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

// Key Vault access for App Service
resource kvAccessPolicy 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appService.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: appService.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalType: 'ServicePrincipal'
  }
}

// Store connection strings in Key Vault
resource sqlConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'sql-connection-string'
  properties: {
    value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabase.name};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;'
  }
}

resource storageConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value}'
  }
}

output apiUrl string = 'https://${appService.properties.defaultHostName}'
output webUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output keyVaultName string = keyVault.name
```

## Deployment Script: scripts/deploy-infra.sh
```bash
#!/bin/bash
set -e

SUBSCRIPTION="de345105-2ffc-4619-a6bc-9c41dec93241"
LOCATION="eastus"
PREFIX="dgmvp"

echo "Deploying infrastructure..."

az account set --subscription "$SUBSCRIPTION"

az deployment sub create \
  --location "$LOCATION" \
  --template-file infra/main.bicep \
  --parameters infra/params.mvp.json \
  --name "dogtrials-$(date +%Y%m%d-%H%M%S)"

echo "Deployment complete!"
```
