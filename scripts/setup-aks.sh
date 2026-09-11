#!/usr/bin/env bash
# One-shot AKS + ACR provisioning. Idempotent enough to re-run.
# Usage: source scripts/env.sh && scripts/setup-aks.sh
set -euo pipefail
: "${RESOURCE_GROUP:?run: source scripts/env.sh}"
: "${AKS_CLUSTER_NAME:?}" "${ACR_NAME:?}" "${LOCATION:?}"

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none
echo ">> resource group $RESOURCE_GROUP ready"

if ! az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" -o none 2>/dev/null; then
  az acr create -g "$RESOURCE_GROUP" -n "$ACR_NAME" --sku Basic -o none
fi
echo ">> ACR $ACR_NAME ready"

if ! az aks show -n "$AKS_CLUSTER_NAME" -g "$RESOURCE_GROUP" -o none 2>/dev/null; then
  # --attach-acr requires Owner / User Access Administrator on the ACR. If it fails, the
  # instructor runs: az aks update -g $RESOURCE_GROUP -n $AKS_CLUSTER_NAME --attach-acr $ACR_NAME
  az aks create \
    -g "$RESOURCE_GROUP" -n "$AKS_CLUSTER_NAME" \
    --node-count 2 \
    --node-vm-size Standard_D2s_v3 \
    --tier free \
    --enable-managed-identity \
    --attach-acr "$ACR_NAME" \
    --generate-ssh-keys \
    -o none
fi
echo ">> AKS $AKS_CLUSTER_NAME ready"

az aks get-credentials -g "$RESOURCE_GROUP" -n "$AKS_CLUSTER_NAME" --overwrite-existing
kubectl get nodes
