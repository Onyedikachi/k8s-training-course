#!/usr/bin/env bash
# Creates an Entra app + federated credentials so GitHub Actions can log in to Azure WITHOUT a
# stored client secret (no expiring passwords, no --sdk-auth). Prints the 3 values to add as repo secrets.
# Usage: source scripts/env.sh && scripts/setup-github-oidc.sh <github-owner>/<repo>
set -euo pipefail
GH_REPO="${1:?usage: setup-github-oidc.sh owner/repo}"
: "${RESOURCE_GROUP:?run: source scripts/env.sh}"
APP_NAME="github-actions-${GH_REPO//\//-}"

SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

APP_ID=$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)
if [[ -z "$APP_ID" ]]; then
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  az ad sp create --id "$APP_ID" -o none
  echo ">> created app $APP_NAME ($APP_ID)"
fi

# Contributor on the resource group covers: az acr build, aks get-credentials, kubectl via local accounts
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/${SUB_ID}/resourceGroups/${RESOURCE_GROUP}" -o none 2>/dev/null || true

add_fc() { # name subject
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"$1\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$2\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none 2>/dev/null || echo "   (federated credential $1 already exists)"
}
add_fc "branch-develop" "repo:${GH_REPO}:ref:refs/heads/develop"
add_fc "branch-main"    "repo:${GH_REPO}:ref:refs/heads/main"
add_fc "env-production" "repo:${GH_REPO}:environment:production"

cat <<MSG

Add these GitHub repository secrets (Settings > Secrets and variables > Actions):
  AZURE_CLIENT_ID        = $APP_ID
  AZURE_TENANT_ID        = $TENANT_ID
  AZURE_SUBSCRIPTION_ID  = $SUB_ID
  ACR_NAME               = ${ACR_NAME:-<your acr name>}
  RESOURCE_GROUP         = $RESOURCE_GROUP
  AKS_CLUSTER_NAME       = ${AKS_CLUSTER_NAME:-training-aks}
MSG
