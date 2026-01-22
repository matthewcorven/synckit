# WI-B27: Entra External ID

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M5  
**Dependencies:** B26  
**Artifacts folder (recommended):** `../artifacts/WI-B27/`

## Goal
Configure Entra External ID for user authentication with social login support.

## Scope
### In
- Entra External ID tenant setup (hybrid: scripts + Portal docs)
- App registration for API
- App registration for SPA
- User flows (sign-up, sign-in)
- Social identity providers:
  - Microsoft
  - Google
  - Apple (optional)
  - Email/password
- API app settings configuration
- Documentation for Portal steps

### Out
- JWT validation (see B08)
- User provisioning (see B09)

## Implementation notes
- Hybrid approach: Some config via `az rest`, some requires Portal
- External ID requires separate tenant or External ID feature
- Configure redirect URIs for SPA
- Configure API permissions
- Document all Portal steps with screenshots

## Acceptance criteria
- [ ] External ID tenant configured
- [ ] API app registration created
- [ ] SPA app registration created
- [ ] User flows work (sign-up, sign-in)
- [ ] At least one social provider works
- [ ] Documentation complete

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- N/A — configuration

**Artifacts (add as relative links during work)**
- N/A

### Integration tests (BDD)
**Artifact requirements**
- Sign-in flow works
- Token contains expected claims

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B27/auth-flow-test.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — real auth bypassed by TestAuth

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
- External ID licensing costs
- Social provider developer account requirements
- Apple Sign-In complexity

## Scripted Configuration

### scripts/setup-entra-extid.sh
```bash
#!/bin/bash
set -e

# This script sets up what can be automated.
# See docs/setup/Auth_Entra_ExternalId.md for Portal steps.

TENANT_ID="your-external-id-tenant-id"
API_APP_NAME="dgmvp-api"
SPA_APP_NAME="dgmvp-web"
API_IDENTIFIER="api://dgmvp"

echo "Setting up Entra External ID app registrations..."

# Note: External ID tenant setup must be done in Portal first
# These commands assume you're logged into the External ID tenant

# Create API app registration
az ad app create \
  --display-name "$API_APP_NAME" \
  --identifier-uris "$API_IDENTIFIER" \
  --app-roles '[
    {
      "allowedMemberTypes": ["User"],
      "description": "Handler role for trial entry",
      "displayName": "Handler",
      "isEnabled": true,
      "value": "Handler"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Secretary role for trial management",
      "displayName": "Secretary",
      "isEnabled": true,
      "value": "Secretary"
    }
  ]'

# Create SPA app registration
az ad app create \
  --display-name "$SPA_APP_NAME" \
  --public-client-redirect-uris \
    "http://localhost:4200" \
    "http://localhost:4201" \
    "https://dgmvp-web.azurestaticapps.net" \
  --enable-access-token-issuance true \
  --enable-id-token-issuance true

echo "App registrations created!"
echo "Complete the remaining steps in Portal - see docs/setup/Auth_Entra_ExternalId.md"
```

## Portal Documentation: docs/setup/Auth_Entra_ExternalId.md

```markdown
# Entra External ID Setup (Portal Steps)

This document covers the Portal steps required for Entra External ID setup.
Run `scripts/setup-entra-extid.sh` first for scripted configuration.

## Prerequisites

1. Azure subscription with External ID enabled
2. Access to Entra admin center (https://entra.microsoft.com)

## Step 1: Create External ID Tenant (if not exists)

1. Go to Azure Portal → Create a resource
2. Search "Azure AD B2C" or "External ID"
3. Create new External ID tenant
4. Note the tenant domain (e.g., `dgmvpextid.onmicrosoft.com`)

## Step 2: Configure User Flows

1. In Entra admin center, switch to External ID tenant
2. Go to **External Identities** → **User flows**
3. Create sign-up and sign-in flow:
   - Name: `B2C_1_SignUpSignIn`
   - Identity providers: Select enabled providers
   - User attributes: Email, Display name
   - Token claims: email, sub, preferred_username

## Step 3: Add Identity Providers

### Microsoft Account
1. Go to **External Identities** → **All identity providers**
2. Select **Microsoft Account**
3. Configure (usually automatic)

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/oauth2/authresp`
4. In Entra, add Google provider with Client ID and Secret

### Apple (Optional)
1. Go to [Apple Developer](https://developer.apple.com)
2. Create Services ID and configure Sign in with Apple
3. Generate private key
4. In Entra, add Apple provider

## Step 4: Configure App Registrations

### API App
1. Go to **App registrations** → `dgmvp-api`
2. Add API scope:
   - **Expose an API** → Add scope
   - Scope name: `access_as_user`
   - Admin consent display name: "Access Dog Trials API"
3. Note the Application ID URI

### SPA App
1. Go to **App registrations** → `dgmvp-web`
2. Add API permissions:
   - **API permissions** → Add permission
   - Select `dgmvp-api` → `access_as_user`
3. Configure authentication:
   - **Authentication** → Add platform → Single-page application
   - Add redirect URIs (if not already added)

## Step 5: API Configuration

Update `appsettings.json`:

```json
{
  "Authentication": {
    "Authority": "https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}",
    "Audience": "api://dgmvp",
    "ValidIssuers": [
      "https://{tenant}.b2clogin.com/{tenant-id}/v2.0/",
      "test-auth"
    ]
  }
}
```

## Step 6: SPA Configuration

Update Angular environment:

```typescript
export const environment = {
  production: true,
  auth: {
    clientId: '{spa-app-client-id}',
    authority: 'https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}',
    redirectUri: 'https://dgmvp-web.azurestaticapps.net',
    scopes: ['api://dgmvp/access_as_user']
  }
};
```

## Verification

1. Navigate to SPA URL
2. Click sign-in
3. Complete sign-up/sign-in flow
4. Verify token contains expected claims
5. Verify API accepts token
```

## API Configuration Reference

### appsettings.Production.json
```json
{
  "Authentication": {
    "Instance": "https://dgmvpextid.b2clogin.com",
    "Domain": "dgmvpextid.onmicrosoft.com",
    "TenantId": "{tenant-id}",
    "ClientId": "{api-app-client-id}",
    "Audience": "api://dgmvp",
    "SignUpSignInPolicyId": "B2C_1_SignUpSignIn"
  }
}
```

### Token Claims Expected
| Claim | Description |
|-------|-------------|
| `sub` | Unique user identifier (stable) |
| `preferred_username` | User's email |
| `email` | User's email (fallback) |
| `roles` | App roles (Handler, Secretary) |
