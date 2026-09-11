#!/usr/bin/env bash
# Render a kustomize overlay, swap in the real image, apply, and wait for the rollout.
# Usage: scripts/deploy.sh <minikube|dev|prod> <image-ref>
# Example: scripts/deploy.sh dev myacr.azurecr.io/nestjs-backend:v1
set -euo pipefail
ENV_NAME="${1:?usage: deploy.sh <minikube|dev|prod> <image>}"
IMAGE="${2:?usage: deploy.sh <minikube|dev|prod> <image>}"
OVERLAY="$(dirname "$0")/../k8s/overlays/${ENV_NAME}"
[[ -d "$OVERLAY" ]] || { echo "unknown environment '${ENV_NAME}'"; exit 1; }

NS=$(grep -E '^namespace:' "$OVERLAY/kustomization.yaml" | awk '{print $2}')
echo ">> deploying ${IMAGE} to namespace '${NS}' (overlay ${ENV_NAME})"
kubectl kustomize "$OVERLAY" \
  | sed "s|image: nestjs-backend:local|image: ${IMAGE}|g" \
  | kubectl apply -f -
kubectl rollout status deployment/nestjs-backend -n "$NS" --timeout=180s
kubectl get pods -n "$NS" -l app=nestjs-backend -o wide
