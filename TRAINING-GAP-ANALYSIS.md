# Gap analysis of the original one-day curriculum

Each gap below would have stalled the room. All are fixed in this repository; the fix column points to where.

## A. Sequencing and environment

| # | Gap in original | Impact | Fix |
|---|---|---|---|
| A1 | Module 1 hands-on runs `az aks get-credentials` against `training-aks`, which is only created in Module 2 | Every participant blocked in the first 15 minutes | Module 1 now explores a **minikube** cluster started during registration (`INSTRUCTOR-RUNBOOK.md`, Module 0/1). AKS is not touched until Module 2 |
| A2 | `az aks create` takes 5–10 min and Module 2 allots 30 min for theory + creation + verification | Dead time, people fall out of sync | Cluster creation is kicked off at the **start of Module 1** (`scripts/setup-aks.sh`, runs while minikube is explored). Instructor also pre-provisions one fallback cluster |
| A3 | `git clone https://github.com/training-org/nestjs-backend.git` — repository does not exist | Module 3 cannot start | This repo *is* the app. Push it to your org and put the real URL in the runbook |
| A4 | `export ACR_NAME="trainingacr$(date +%s)"` – a new name every time the file is sourced; lost when a terminal closes | Participants create several registries, later commands point at the wrong one | `scripts/env.sh` generates once and persists to `.training-env` |
| A5 | Manifests contain `${ACR_NAME}.azurecr.io/...` – `kubectl apply` does not substitute shell variables | `ImagePullBackOff` with a literal `${ACR_NAME}` host | Kustomize base/overlays + `scripts/deploy.sh` which renders and swaps the image line |
| A6 | Windows / Docker prerequisites not listed; minikube and local image builds need Docker Desktop (or Podman), WSL2 on Windows | Setup failures | Prerequisite checklist + verification script in runbook, sent out 5 days ahead |
| A7 | `Standard_B2s` (burstable) nodes with 3 nodes; new subscriptions commonly have a 10 vCPU regional quota, and burstable nodes throttle during `az acr build` demos | Quota errors / sluggish cluster | `Standard_D2s_v3`, 2 nodes, free tier; instructor checks `az vm list-usage` beforehand |
| A8 | `--attach-acr` requires Owner or User Access Administrator on the ACR | Fails for participants with Contributor only | Documented fallback (`az aks update --attach-acr` by the instructor), or an ACR shared by the whole room |
| A9 | No cost/tear-down step | AKS + LoadBalancer public IPs keep billing | `scripts/cleanup.sh`, last item of Module 7 |
| A10 | No `az ad` permission check | `az ad sp create-for-rbac` / app registration is often blocked in corporate tenants | Runbook pre-check; single instructor-owned app registration as fallback |

## B. Application

| # | Gap | Fix |
|---|---|---|
| B1 | Health controller `throw new Error()` → HTTP 500 and stack traces; controller never registered in a module; artificial fixed 10 s wait | `HealthService` + `ServiceUnavailableException` (503); warm-up length via `STARTUP_DELAY_MS` so probes can be *shown* not just described |
| B2 | No Dockerfile, no `.dockerignore` | Multi-stage `Dockerfile`, non-root numeric UID, group-0 ownership (OpenShift-compatible), `APP_VERSION` build-arg for visible rolling updates |
| B3 | App had no configuration at all, so ConfigMaps/Secrets could not be demonstrated | Joi-validated env (`src/config`), `GET /config`, optional `API_KEY` Secret guarding `/api/*` |
| B4 | `npm test` in the pipeline with no tests | Unit + e2e tests that run in ~10 s and are executed in CI |
| B5 | No graceful shutdown → rolling updates drop requests | `enableShutdownHooks()`; readiness flips to false on SIGTERM |
| B6 | Nothing to show which replica served a request | `POD_NAME`/`NODE_NAME` via Downward API on every response |

## C. Module 3 (manual deploy)

| # | Gap | Fix |
|---|---|---|
| C1 | Rolling update to `nestjs-backend:v2` – that tag was never built; `rollout status` hangs for the whole timeout | Runbook builds `v1` and `v2` (different `APP_VERSION`) before the update, so `GET /` visibly changes |
| C2 | Deployment/Service YAML duplicated per environment with drift | One base, three overlays |
| C3 | Only `port-forward` — objective “access the deployed application” not met externally | prod overlay uses `type: LoadBalancer`; minikube uses NodePort + `minikube service` |

## D. Module 4 (GitHub Actions)

| # | Gap | Fix |
|---|---|---|
| D1 | `az ad sp create-for-rbac --sdk-auth` is deprecated; secret expires; `azure/login@v1` | OIDC federated credentials via `scripts/setup-github-oidc.sh`, `azure/login@v2`, no stored password |
| D2 | `ACR_PASSWORD` secret referenced but never created; `container-registry-username` set to the ACR *name*; a pull secret is unnecessary when `--attach-acr` is used | Pull-secret step removed (managed identity pulls) |
| D3 | `azure/k8s-deploy` `images:` input only rewrites images whose repository matches – it will not match `${ACR_NAME}.azurecr.io/...` | Workflow calls the same `scripts/deploy.sh` humans use → what you tested by hand is what CI does |
| D4 | `k8s/prod/service.yaml` referenced but never defined | Provided (prod overlay) |
| D5 | `paths:` filters on `src/**` – a Dockerfile or package.json change would not deploy | Filters removed; a `ci.yaml` runs on all other branches/PRs |
| D6 | Dev workflow used `kubectl set image` which fails if the Deployment does not yet exist in that namespace | `kubectl apply` of the full overlay is idempotent |
| D7 | `environment: production` implied a pre-configured environment | Note added: GitHub auto-creates it; optional reviewers give the approval gate |
| D8 | Node 20 | Node 22 (current LTS) everywhere: runner, Dockerfile, local |

## E. Module 5 (administration)

| # | Gap | Fix |
|---|---|---|
| E1 | `pods/exec` with verbs `get, list` – exec/port-forward are POST sub-resources requiring `create`, so the demo `kubectl exec` would be denied | Corrected role, added `pods/portforward` |
| E2 | Applying a ResourceQuota makes any Pod without requests/limits unschedulable; the LimitRange existed only for `dev` | LimitRange for both namespaces, applied *before* the quotas |
| E3 | Quota test used `kubectl run --overrides` (error-prone JSON) | Kept, but a ready-made `quotas/test-too-big-pod.yaml` is used instead |

## F. Module 6 (OpenShift)

| # | Gap | Fix |
|---|---|---|
| F1 | `oc login --username=developer --password=developer` is the OpenShift Local (CRC) default – CRC needs 9 GB RAM and 30+ min to install; `oc new-project` is not allowed in the free Developer Sandbox | Runbook uses **Developer Sandbox** with the pre-created project; token generated the same morning |
| F2 | `oc import-image` from a private ACR needs registry credentials that were never created; ImageStream indirection adds nothing for a 45-min demo | Pull-scoped ACR token + `imagePullSecrets`, pull the exact AKS image |
| F3 | `oc rollout latest` only works for DeploymentConfig, not Deployment | Removed |
| F4 | oc installed by `curl` from `mirror.openshift.com` and `oc login --insecure-skip-tls-verify` in CI | `redhat-actions/openshift-tools-installer` + `redhat-actions/oc-login` |
| F5 | SCC theory said “runAsUser MustRunAsRange” but the manifest did not explain why the image must not hard-code a UID | Dockerfile + comment in `openshift/deployment.yaml` |

## G. Timing

Original schedule had 8 h 30 min of content for an 8 h 30 min day with zero slack. The runbook rebalances:
Module 1 gains a working cluster (minikube), Module 2 shrinks (cluster already creating), Module 4 gets 15 min more
because it is where most support requests happen, Module 6 becomes an instructor-led demo with an optional
participant lab for those who created a Sandbox in advance.
