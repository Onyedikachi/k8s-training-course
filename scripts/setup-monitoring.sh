#!/usr/bin/env bash
# Installs kube-prometheus-stack (Prometheus Operator + Prometheus + Alertmanager + Grafana
# + node-exporter + kube-state-metrics) and wires up our app.
# Usage: scripts/setup-monitoring.sh [minikube|aks]
set -euo pipefail
FLAVOUR="${1:-aks}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

command -v helm >/dev/null || { echo "helm is required: https://helm.sh/docs/intro/install/"; exit 1; }

echo ">> adding the prometheus-community chart repo"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update >/dev/null

EXTRA=()
if [[ "$FLAVOUR" == "minikube" ]]; then
  # a 2-CPU minikube cannot host the full stack comfortably
  EXTRA+=(--set alertmanager.enabled=false --set prometheus-node-exporter.enabled=false
          --set grafana.resources.requests.cpu=50m
          --set prometheus.prometheusSpec.resources.requests.cpu=100m)
fi

echo ">> installing kube-prometheus-stack into namespace 'monitoring' (3-5 min)"
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --values "$ROOT/monitoring/values-kube-prometheus-stack.yaml" \
  "${EXTRA[@]}" \
  --wait --timeout 10m

echo ">> applying ServiceMonitors, alert rules and the Grafana dashboard"
kubectl apply -f "$ROOT/monitoring/servicemonitor.yaml"      # dev + prod
kubectl apply -f "$ROOT/monitoring/prometheusrule.yaml"
kubectl apply -f "$ROOT/monitoring/grafana-dashboard-configmap.yaml"

kubectl get pods -n monitoring
cat <<'MSG'

Open the UIs (each command blocks; run them in separate terminals):
  kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090   # http://localhost:9090
  kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana    3001:80     # http://localhost:3001  (admin / training123)
  kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093 # http://localhost:9093

In Prometheus: Status > Target health should list nestjs-backend (2 targets, state UP).
In Grafana: Dashboards > "NestJS backend".
MSG
