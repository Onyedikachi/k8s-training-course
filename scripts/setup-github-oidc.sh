#!/usr/bin/env bash
# Creates an Entra app + federated credentials so GitHub Actions can log in to Azure WITHOUT a
# stored client secret (no expiring passwords, no --sdk-auth). Prints the 3 values to add as repo secrets.
# Usage: source scripts/env.sh && scripts/setup-github-oidc.sh <github-owner>/<repo>

# the initial run failed because of the following:
# only a user with subscription owner role can run these scripts successfully
# also the federated user step i demanding for github actor and sub to be added to it at creation
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

# fixes

# az aks update -g devescops-rg -n training-aks
#  --attach-acr trainingacrraining0911

# APP_ID="bc7533ad-78cb-4658-b59c-886f19ce86a8"

# az ad app federated-credential delete \
#   --id "$APP_ID" \
#   --federated-credential-id "env-production"

# az ad app federated-credential delete \
#   --id "$APP_ID" \
#   --federated-credential-id "branch-main"

# az ad app federated-credential delete \
#   --id "$APP_ID" \
#   --federated-credential-id "branch-develop"

# az ad app federated-credential create \
#   --id "$APP_ID" \
#   --parameters '{
#     "name": "env-production",
#     "issuer": "https://token.actions.githubusercontent.com",
#     "subject": "repo:Onyedikachi@25103378/k8s-training-course@1365885060:environment:production",
#     "audiences": ["api://AzureADTokenExchange"]
#   }'

# az ad app federated-credential create \
#   --id "$APP_ID" \
#   --parameters '{
#     "name": "branch-main",
#     "issuer": "https://token.actions.githubusercontent.com",
#     "subject": "repo:Onyedikachi@25103378/k8s-training-course@1365885060:ref:refs/heads/main",
#     "audiences": ["api://AzureADTokenExchange"]
#   }'

# az ad app federated-credential create \
#   --id "$APP_ID" \
#   --parameters '{
#     "name": "branch-develop",
#     "issuer": "https://token.actions.githubusercontent.com",
#     "subject": "repo:Onyedikachi@25103378/k8s-training-course@1365885060:ref:refs/heads/develop",
#     "audiences": ["api://AzureADTokenExchange"]
#   }'

# az role assignment create \
#   --assignee-object-id "211a7210-053a-4243-aef2-1b6a586b34e2" \
#   --assignee-principal-type ServicePrincipal \
#   --role "Contributor" \
#   --scope "/subscriptions/d6f9bc60-8534-46f3-ad36-5233427d8158"

# az role assignment list \
#   --assignee-object-id "211a7210-053a-4243-aef2-1b6a586b34e2" \
#   --scope "/subscriptions/d6f9bc60-8534-46f3-ad36-5233427d8158" \
#   -o table 

# az account show \
#   --query "{subscriptionId:id,tenantId:tenantId,name:name}" \
#   -o json

# az ad app show \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "{appId:appId,tenantId:publisherDomain}" \
#   -o json

# az ad sp show \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "{appId:appId,tenantId:appOwnerOrganizationId,displayName:displayName}" \
#   -o json

# az ad app federated-credential list \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "[?name=='env-production']" \
#   -o json

# az ad app federated-credential list \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "[].{name:name,issuer:issuer,subject:subject,audiences:audiences}" \
#   -o json

# az ad app show \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "{appId:appId,displayName:displayName,id:id}" \
#   -o json

# az ad sp show \
#   --id "bc7533ad-78cb-4658-b59c-886f19ce86a8" \
#   --query "{appId:appId,objectId:id,displayName:displayName}" \
#   -o json
