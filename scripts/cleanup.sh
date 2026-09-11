#!/usr/bin/env bash
# Deletes everything created today (AKS, ACR, public IPs). Run at the end of the training!
set -euo pipefail
: "${RESOURCE_GROUP:?run: source scripts/env.sh}"
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
echo ">> deletion of $RESOURCE_GROUP started (runs in background)"
