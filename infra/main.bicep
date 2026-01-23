targetScope = 'subscription'

@description('The environment name (dev, staging, prod)')
param environment string = 'dev'

@description('The Azure region for resources')
param location string = 'eastus'

@description('Resource naming prefix')
param prefix string = 'dgmvp'

@description('Resource group name')
param resourceGroupName string = 'rg-${prefix}'

@description('Static Web App location (must be a supported region)')
param staticWebAppLocation string = 'eastus2'

@description('SQL Server location (must be a supported region)')
param sqlLocation string = 'eastus2'

@description('SQL admin username')
param sqlAdminLogin string = 'sqladmin'

@secure()
@description('SQL admin password (auto-generated if not provided)')
param sqlAdminPassword string = newGuid()

@description('ACS Email data location')
param acsDataLocation string = 'United States'

@description('Log Analytics retention days')
param logAnalyticsRetentionDays int = 30

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

module resources 'modules/resources.bicep' = {
  name: 'resources-${environment}'
  scope: rg
  params: {
    prefix: prefix
    location: location
    staticWebAppLocation: staticWebAppLocation
    sqlLocation: sqlLocation
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
    acsDataLocation: acsDataLocation
    logAnalyticsRetentionDays: logAnalyticsRetentionDays
  }
}

output apiUrl string = resources.outputs.apiUrl
output webUrl string = resources.outputs.webUrl
output sqlServerFqdn string = resources.outputs.sqlServerFqdn
output keyVaultName string = resources.outputs.keyVaultName
output storageAccountName string = resources.outputs.storageAccountName
output acsEmailServiceName string = resources.outputs.acsEmailServiceName
