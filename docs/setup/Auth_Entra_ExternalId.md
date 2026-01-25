# Entra External ID setup (MVP)

**Purpose:** Configure Microsoft Entra External ID with social identity providers (Microsoft, Google) for handler/secretary authentication.

**Status:** App registrations created; Portal configuration required.

---

## Quick Reference

| Resource | Value |
|----------|-------|
| **Tenant ID** | `baf8c799-55bb-481d-ba6b-ff989086852b` |
| **Tenant Domain** | `dgmvp.onmicrosoft.com` |
| **API App ID** | `0c865a69-f8d0-416a-b3b7-7214a797a3dc` |
| **SPA App ID** | `79e059f9-a911-45d6-91c3-10c5cba11015` |
| **Authority** | `https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn` |
| **Audience** | `api://dgmvp` |
| **API Scope** | `api://dgmvp/access_as_user` |

---

## Portal Configuration Steps

### Step 1: Access Microsoft Entra Admin Center

**URL:** https://entra.microsoft.com/

**Page Title:** `Microsoft Entra admin center`

**Navigation:**
1. Sign in with your Microsoft account
2. If prompted, select tenant: `dgmvp.onmicrosoft.com` (baf8c799-55bb-481d-ba6b-ff989086852b)

**Validation:** Top-right corner should show your account and "dgmvp.onmicrosoft.com"

---

### Step 2: Verify App Registrations Exist

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps

**Page Title:** `App registrations | Microsoft Entra admin center`

**Expected Apps:**
- `dgmvp-api` (Application ID: `0c865a69-f8d0-416a-b3b7-7214a797a3dc`)
- `dgmvp-web` (Application ID: `79e059f9-a911-45d6-91c3-10c5cba11015`)

**Validation:** Both apps should appear in the list with the Client IDs above.

---

### Step 3: Configure API App (dgmvp-api)

#### 3.1 Open API App Registration

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/0c865a69-f8d0-416a-b3b7-7214a797a3dc

**Page Title:** `dgmvp-api - Overview | Microsoft Entra admin center`

**Validation:** "Application (client) ID" field shows `0c865a69-f8d0-416a-b3b7-7214a797a3dc`

---

#### 3.2 Set Application ID URI

**Navigation:** In left menu, click **Expose an API**

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/ProtectAnAPI/appId/0c865a69-f8d0-416a-b3b7-7214a797a3dc

**Page Title:** `dgmvp-api - Expose an API | Microsoft Entra admin center`

**Actions:**
1. Click **Add** next to "Application ID URI"
2. Set value to: `api://dgmvp`
3. Click **Save**

**Validation:** "Application ID URI" field shows `api://dgmvp`

---

#### 3.3 Add API Scope

**Same Page:** `dgmvp-api - Expose an API`

**Actions:**
1. Click **+ Add a scope**
2. Fill in the form:
   - **Scope name:** `access_as_user`
   - **Who can consent:** `Admins and users`
   - **Admin consent display name:** `Access Dog Trials API as user`
   - **Admin consent description:** `Allows the app to access the Dog Trials API on behalf of the signed-in user`
   - **User consent display name:** `Access Dog Trials API`
   - **User consent description:** `Allows the app to access the Dog Trials API on your behalf`
   - **State:** `Enabled`
3. Click **Add scope**

**Validation:** Scope `api://dgmvp/access_as_user` appears in the scopes list

---

#### 3.4 Verify App Roles

**Navigation:** In left menu, click **App roles**

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/AppRoles/appId/0c865a69-f8d0-416a-b3b7-7214a797a3dc

**Page Title:** `dgmvp-api - App roles | Microsoft Entra admin center`

**Validation:** Two app roles should exist:
- **Handler** (Value: `Handler`, Description: `Handler role for dog trial participants`)
- **Secretary** (Value: `Secretary`, Description: `Secretary role for trial administrators`)

**Note:** These were created by the setup script; no action needed.

---

### Step 4: Configure SPA App (dgmvp-web)

#### 4.1 Open SPA App Registration

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/79e059f9-a911-45d6-91c3-10c5cba11015

**Page Title:** `dgmvp-web - Overview | Microsoft Entra admin center`

**Validation:** "Application (client) ID" field shows `79e059f9-a911-45d6-91c3-10c5cba11015`

---

#### 4.2 Add Redirect URIs

**Navigation:** In left menu, click **Authentication**

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/79e059f9-a911-45d6-91c3-10c5cba11015

**Page Title:** `dgmvp-web - Authentication | Microsoft Entra admin center`

**Actions:**
1. Under "Platform configurations", click **+ Add a platform**
2. Select **Single-page application**
3. Add redirect URIs:
   - `http://localhost:4201/`
   - `https://localhost:4201/`
   - (Add production SWA URL when deployed: `https://<your-swa>.azurestaticapps.net/`)
4. Under "Implicit grant and hybrid flows", ensure both checkboxes are **UNCHECKED** (PKCE flow, not implicit)
5. Click **Configure**

**Validation:** Redirect URIs appear under "Single-page application" platform

---

#### 4.3 Add API Permissions

**Navigation:** In left menu, click **API permissions**

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/79e059f9-a911-45d6-91c3-10c5cba11015

**Page Title:** `dgmvp-web - API permissions | Microsoft Entra admin center`

**Actions:**
1. Click **+ Add a permission**
2. Click **My APIs** tab
3. Select **dgmvp-api**
4. Select **Delegated permissions**
5. Check **access_as_user**
6. Click **Add permissions**

**Validation:** Permission `api://dgmvp/access_as_user` appears with type "Delegated"

---

#### 4.4 Grant Admin Consent

**Same Page:** `dgmvp-web - API permissions`

**Actions:**
1. Click **✓ Grant admin consent for dgmvp**
2. Confirm by clicking **Yes**

**Validation:** "Status" column shows green checkmark with "Granted for dgmvp"

---

### Step 5: Create User Flow

**Navigation:** From home, go to **External Identities** (not Identity)

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/CompanyRelationshipsMenuBlade/~/UserFlows

**Page Title:** `User flows | Microsoft Entra admin center`

**Actions:**
1. Click **+ New user flow**
2. Select flow type: **Sign up and sign in**
3. Select version: **Recommended**
4. Fill in details:
   - **Name:** `SignUpSignIn` (will become `B2C_1_SignUpSignIn`)
   - **Identity providers:** Check **Email signup** (configure social providers in Step 6)
   - **Multifactor authentication:** `Optional` (or `Required` for production)
   - **Conditional access:** Leave default
5. Under "User attributes and token claims":
   - **Attributes to collect:** Check `Display Name`, `Email Address`
   - **Claims to return:** Check `Display Name`, `Email Addresses`, `User's Object ID`
6. Click **Create**

**Validation:** User flow `B2C_1_SignUpSignIn` appears in the list

---

### Step 6: Configure Identity Providers

#### 6.1 Navigate to Identity Providers

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/CompanyRelationshipsMenuBlade/~/IdentityProviders

**Page Title:** `Identity providers | Microsoft Entra admin center`

---

#### 6.2 Add Microsoft Account Provider

**Actions:**
1. Click **+ New OpenID Connect provider** (or **+ Microsoft Account** if available)
2. Fill in form:
   - **Name:** `Microsoft`
   - **Client ID:** (Your Microsoft App Client ID from https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
   - **Client secret:** (Create secret in Azure Portal under app registration)
   - **Scope:** `openid profile email`
   - **Response type:** `code`
   - **Response mode:** `query`
   - **Domain hint:** `live.com`
3. Click **Save**

**Validation:** Microsoft provider appears in the list

---

#### 6.3 Add Google Provider

**Actions:**
1. Click **+ New OpenID Connect provider** (or **+ Google** if available)
2. Fill in form:
   - **Name:** `Google`
   - **Client ID:** (Your Google OAuth Client ID from https://console.cloud.google.com/apis/credentials)
   - **Client secret:** (Your Google OAuth Client Secret)
   - **Scope:** `openid profile email`
   - **Response type:** `code`
   - **Response mode:** `form_post`
3. Click **Save**

**Validation:** Google provider appears in the list

---

#### 6.4 Add Providers to User Flow

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/CompanyRelationshipsMenuBlade/~/UserFlows

**Actions:**
1. Click on **B2C_1_SignUpSignIn** user flow
2. In left menu, click **Identity providers**
3. Check **Microsoft** and **Google** (in addition to **Email signup**)
4. Click **Save**

**Validation:** User flow shows 3 identity providers

---

### Step 7: Assign App Roles to Test Users

#### 7.1 Navigate to Enterprise Applications

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AppAppsPreview

**Page Title:** `Enterprise applications | Microsoft Entra admin center`

---

#### 7.2 Find API App

**Actions:**
1. In search box, type: `dgmvp-api`
2. Click on the **dgmvp-api** result

**Page Title:** `dgmvp-api - Overview | Microsoft Entra admin center`

**Validation:** "Application ID" shows `0c865a69-f8d0-416a-b3b7-7214a797a3dc`

---

#### 7.3 Assign Users to Roles

**Navigation:** In left menu, click **Users and groups**

**URL:** https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Users/objectId/[object-id]/appId/0c865a69-f8d0-416a-b3b7-7214a797a3dc

**Page Title:** `dgmvp-api - Users and groups | Microsoft Entra admin center`

**Actions (for each test user):**
1. Click **+ Add user/group**
2. Click **None Selected** under "Users"
3. Search for and select test user
4. Click **Select**
5. Click **None Selected** under "Select a role"
6. Choose **Handler** or **Secretary**
7. Click **Select**
8. Click **Assign**

**Validation:** User appears in list with assigned role

---

### Step 8: Test Authority URL

**Test URL:** https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn/v2.0/.well-known/openid-configuration

**Expected Result:** JSON document with OIDC metadata including:
- `"issuer": "https://dgmvp.b2clogin.com/baf8c799-55bb-481d-ba6b-ff989086852b/v2.0/"`
- `"authorization_endpoint": "https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn/oauth2/v2.0/authorize"`
- `"token_endpoint": "https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn/oauth2/v2.0/token"`

**Validation:** If this URL returns JSON, your External ID configuration is working

---

## Configuration Summary

**API Configuration (appsettings.json):**
```json
{
  "Authentication": {
    "Authority": "https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn",
    "Audience": "api://dgmvp",
    "ValidIssuers": [
      "https://dgmvp.b2clogin.com/baf8c799-55bb-481d-ba6b-ff989086852b/v2.0/"
    ],
    "ValidAudiences": [
      "api://dgmvp",
      "0c865a69-f8d0-416a-b3b7-7214a797a3dc"
    ],
    "RoleClaimType": "roles",
    "RequireHttpsMetadata": true
  }
}
```

**SPA Configuration (environment.stream-b.ts):**
```typescript
export const environment = {
  production: false,
  apiPort: 5200,
  useMocks: true,
  auth: {
    clientId: '79e059f9-a911-45d6-91c3-10c5cba11015',
    authority: 'https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn',
    redirectUri: 'http://localhost:4201/',
    scopes: ['api://dgmvp/access_as_user'],
    knownAuthorities: ['dgmvp.b2clogin.com']
  }
};
```

---

## MVP Implementation Notes

### Internal user identity
- Use JWT `sub` claim as the stable external identifier.
- Persist an internal `Users` table keyed by External Subject (`sub`) and map to internal `UserId` (GUID).
- Store internal `UserId` (GUID) on domain rows (e.g., `Entries.CreatedByUserId`) and enforce ownership/authorization via that value.

### Authenticated email claim extraction
- Prefer `preferred_username`.
- Fallback to `email`.
- Fallback to first value in `emails` (if present).

### Security notes
- Use PKCE flow (not implicit flow) for SPA authentication.
- Validate JWT issuer, audience, and signature server-side.
- Extract roles from `roles` claim in JWT.
- Never log PII (email, name) in telemetry.