#!/bin/bash
set -euo pipefail

SUBSCRIPTION="de345105-2ffc-4619-a6bc-9c41dec93241"
LOCATION="eastus"

echo "Deploying infrastructure..."

az account set --subscription "$SUBSCRIPTION"

az deployment sub create \
  --location "$LOCATION" \
  --template-file infra/main.bicep \
  --parameters infra/params.mvp.json \
  --name "dogtrials-$(date +%Y%m%d-%H%M%S)"

echo "Deployment complete."
