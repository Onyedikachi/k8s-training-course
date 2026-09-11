#!/usr/bin/env bash
# Port-forwards the service and hits the main endpoints. Usage: scripts/smoke-test.sh <namespace>
set -euo pipefail
NS="${1:-dev}"
kubectl port-forward -n "$NS" svc/nestjs-backend-service 8080:80 >/dev/null 2>&1 &
PF=$!; trap 'kill $PF 2>/dev/null' EXIT
sleep 2
for p in / /config /health/live /health/ready /api/items; do
  printf '%-16s ' "$p"; curl -s -w ' [%{http_code}]\n' "http://localhost:8080$p"
done
