# Monitoring with Prometheus and Grafana

## What gets installed

`scripts/setup-monitoring.sh` installs the **kube-prometheus-stack** Helm chart into a `monitoring`
namespace. One chart, six moving parts:

| Component | Job |
|---|---|
| **Prometheus Operator** | Watches `ServiceMonitor`/`PodMonitor`/`PrometheusRule` CRDs and regenerates Prometheus config. You never hand-edit `prometheus.yml`. |
| **Prometheus** | Pulls (`scrapes`) `/metrics` from every discovered target every 15 s and stores the samples. |
| **Alertmanager** | Receives firing alerts from Prometheus, groups/deduplicates them, routes to email/Slack/PagerDuty. |
| **Grafana** | Dashboards on top of Prometheus. Pre-loaded with ~30 Kubernetes dashboards. |
| **node-exporter** | DaemonSet exporting host-level metrics (CPU, memory, disk, network per node). |
| **kube-state-metrics** | Exports the *state of Kubernetes objects* — replica counts, pod phases, restart counts, quota usage. |

Key idea: Prometheus is **pull-based**. The app does not push anywhere; it exposes a plain-text
endpoint and Prometheus comes to fetch it. That is why a scrape target failing is itself a signal (`up == 0`).

## What the app exposes — `GET /metrics`

| Metric | Type | Comes from | Answers |
|---|---|---|---|
| `http_requests_total{method,route,status_code}` | counter | our middleware | throughput, error rate |
| `http_request_duration_seconds_bucket{...}` | histogram | our middleware | p50/p95/p99 latency |
| `http_requests_in_flight` | gauge | our middleware | concurrency / saturation |
| `app_ready` | gauge | health service | is this replica serving? |
| `items_total` | gauge | items service | a *business* metric, per replica |
| `app_info{version,environment,pod,node}` | gauge | config | which build is running where |
| `nodejs_heap_size_used_bytes`, `nodejs_eventloop_lag_seconds`, `process_cpu_seconds_total`, … | various | `prom-client` defaults | runtime health |

Two implementation details worth pointing out during the training:

1. **Route templates, never raw URLs.** The middleware labels with `/api/items/:id`, not
   `/api/items/42`. Labelling with raw paths creates one time series per id — the classic
   cardinality explosion that takes Prometheus down. Unmatched requests collapse to `route="unmatched"`.
2. **A private registry.** `MetricsService` owns its own `prom-client` `Registry` instead of the
   global default, so tests and multiple app instances never hit "metric already registered".

Counters only ever go up; you always wrap them in `rate()`. Gauges go up and down and are read directly.

## Install

```bash
scripts/setup-monitoring.sh aks        # or: scripts/setup-monitoring.sh minikube
```

Then, in separate terminals:
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus   9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana      3001:80    # admin / training123
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
```

## How Prometheus finds our pods

```
Service (labels: app=nestjs-backend, port named "http")
   ^
   | selector: matchLabels app=nestjs-backend
ServiceMonitor (labels: release=kube-prometheus-stack)
   ^
   | serviceMonitorSelector
Prometheus
```
Three things must line up, and each is a classic failure:
- the ServiceMonitor's `selector` must match the **Service** labels (not the Pod labels);
- `endpoints[].port` is the **name** of the Service port (`http`), not the number;
- the ServiceMonitor's own labels must satisfy the Prometheus `serviceMonitorSelector`
  (our values file relaxes this to "any namespace, any label" for the workshop).

Debug order: `Status > Target health` in the Prometheus UI → `kubectl get servicemonitor -A` →
`kubectl get secret -n monitoring prometheus-kube-prometheus-stack-prometheus -o jsonpath='{.data.prometheus\.yaml\.gz}' | base64 -d | gunzip | head -50`.

## Queries to run in the Prometheus UI

```promql
up{job="nestjs-backend-service"}                                  # are we being scraped at all?
sum by (route) (rate(http_requests_total[2m]))                    # requests per second per route
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))                            # error ratio
histogram_quantile(0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m])))   # p95 latency
app_info                                                          # which version is deployed where
app_ready                                                         # 1 per ready replica
sum by (pod) (rate(container_cpu_usage_seconds_total{container="nestjs-backend"}[2m]))
kube_deployment_status_replicas_available{deployment="nestjs-backend"}
increase(kube_pod_container_status_restarts_total{container="nestjs-backend"}[15m])
nodejs_eventloop_lag_seconds                                      # spikes when you POST /demo/hang
```

## Alerts

`monitoring/prometheusrule.yaml` ships six alerts (absent target, not-ready, high error rate,
high latency, restart loop, blocked event loop) and two recording rules. Firing alerts appear in
Prometheus under **Alerts** and in Alertmanager. To route them somewhere real, add a receiver:

```yaml
# helm values
alertmanager:
  config:
    route:
      receiver: slack
    receivers:
      - name: slack
        slack_configs:
          - api_url: https://hooks.slack.com/services/XXX
            channel: '#alerts'
```

## Autoscaling

`monitoring/hpa.yaml` scales on CPU via **metrics-server** (pre-installed on AKS) — this is
independent of Prometheus. To scale on a *Prometheus* metric (say `http_requests_in_flight`) you
additionally need `prometheus-adapter`, which exposes PromQL results through the Kubernetes
custom-metrics API. Out of scope for one day; mention it as the next step.

## Managed alternative on Azure

Azure offers a hosted option that removes the operational burden of running Prometheus yourself:

```bash
az aks update -g $RESOURCE_GROUP -n $AKS_CLUSTER_NAME \
  --enable-azure-monitor-metrics        # Azure Managed Prometheus + Managed Grafana
```
It understands the same `ServiceMonitor`/`PodMonitor` CRDs, so the manifests in this folder work
unchanged. Self-hosted is used in the training because participants can see every component.

## Cleanup

```bash
helm uninstall kube-prometheus-stack -n monitoring
kubectl delete namespace monitoring
# the Operator's CRDs survive a helm uninstall by design:
kubectl delete crd $(kubectl get crd -o name | grep monitoring.coreos.com)
```
