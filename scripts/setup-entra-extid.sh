#!/usr/bin/env bash
set -euo pipefail

# Starter script for Entra External ID app registrations.
# Some steps must be completed in the Portal (user flows, identity providers, SPA redirect URIs).
# See docs/setup/Auth_Entra_ExternalId.md for the full checklist.

TENANT_ID="${TENANT_ID:-}"
API_APP_NAME="${API_APP_NAME:-dgmvp-api}"
SPA_APP_NAME="${SPA_APP_NAME:-dgmvp-web}"
API_IDENTIFIER_URI="${API_IDENTIFIER_URI:-api://dgmvp}"

if [[ -z "$TENANT_ID" ]]; then
  echo "TENANT_ID is required (set env var)" >&2
  exit 1
fi

echo "Logging into tenant $TENANT_ID..."
az account show --tenant "$TENANT_ID" >/dev/null 2>&1 || az login --tenant "$TENANT_ID"

echo "Creating API app registration: $API_APP_NAME"
API_APP_ID=$(az ad app create \
  --display-name "$API_APP_NAME" \
  --identifier-uris "$API_IDENTIFIER_URI" \
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
  ]' \
  --query appId -o tsv)

echo "API App ID: $API_APP_ID"

echo "Creating SPA app registration: $SPA_APP_NAME"
SPA_APP_ID=$(az ad app create \
  --display-name "$SPA_APP_NAME" \
  --query appId -o tsv)

echo "SPA App ID: $SPA_APP_ID"

cat <<EOF

Next steps (Portal):
1) Configure User Flows and Identity Providers.
2) Expose API scope "access_as_user" on $API_APP_NAME.
3) Add SPA redirect URIs for local/dev/prod.
4) Grant API permissions to $SPA_APP_NAME.
5) Assign app roles to users in Enterprise Applications.

See docs/setup/Auth_Entra_ExternalId.md for the full checklist.

EOF
