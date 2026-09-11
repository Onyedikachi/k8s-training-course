# nestjs-backend — Kubernetes training application

Stateless NestJS 11 API driven entirely by environment variables (no database). Built for the
one-day *Kubernetes for Developers and DevOps Engineers* training: it runs identically on minikube,
AKS (dev/prod namespaces) and OpenShift, and every Kubernetes concept in the course has a matching endpoint.

| Endpoint | Purpose in the training |
|---|---|
| `GET /` | Shows greeting, version, env, **pod & node name** → proves ConfigMap, Downward API, load balancing, rolling updates |
| `GET /config` | Every non-secret setting the app received |
| `GET /health/started` `/ready` `/live` | Startup / readiness / liveness probes (503 until warm-up finishes) |
| `POST /demo/unready` `/ready` | Pod leaves/joins Service endpoints without restarting |
| `POST /demo/crash` `/hang` | Container restart via exit code / liveness probe timeout |
| `GET/POST/DELETE /api/items` | In-memory data (per replica!) — optionally protected by `x-api-key` from a Secret |

Demo endpoints are enabled per environment with `DEMO_ENDPOINTS_ENABLED` (true in minikube/dev, false in prod).

## Environment variables
See `.env.example`. `APP_ENV` is **required**; a missing/invalid value makes the container exit 1
(visible as `CrashLoopBackOff` with the reason in `kubectl logs`). Optional `API_KEY` comes from a Secret.

## Local
```bash
cp .env.example .env
npm ci && npm run start:dev          # http://localhost:3000
npm run test:all                     # unit + e2e
```

## Container
```bash
docker build -t nestjs-backend:local --build-arg APP_VERSION=1.0.0 .
docker run --rm -p 3000:3000 -e APP_ENV=local nestjs-backend:local
```

## Kubernetes layout
```
k8s/base                 Deployment + Service (image placeholder nestjs-backend:local)
k8s/overlays/minikube    namespace dev, NodePort, demo endpoints on
k8s/overlays/dev         namespace dev, 2 replicas
k8s/overlays/prod        namespace prod, 3 replicas, zero-downtime rollout, LoadBalancer
rbac/ quotas/            Module 5 material
openshift/               Module 6 material (+ README-openshift.md)
scripts/                 env.sh, setup-aks.sh, setup-github-oidc.sh, deploy.sh, smoke-test.sh, cleanup.sh
```
Deploy anything with one command: `scripts/deploy.sh <minikube|dev|prod> <image>`.

Full day-of instructions: **INSTRUCTOR-RUNBOOK.md**. Why things are the way they are: **TRAINING-GAP-ANALYSIS.md**.
