# Instructor runbook — Kubernetes one-day intensive (revised)

Everything a participant types is in a code block. Everything the instructor does *before* the day is in section 0.
The original curriculum's theory sections are unchanged; only the hands-on flow and schedule are revised.

## Revised schedule

| Time | Module | Theory | Hands-on |
|---|---|---|---|
| 08:30–09:00 | 0 · Registration & environment check | – | `scripts/preflight.sh`, `minikube start` |
| 09:00–09:50 | 1 · Kubernetes fundamentals | 20 | Explore **minikube**; kick off AKS creation in background |
| 09:50–10:30 | 2 · AKS cluster access & namespaces | 10 | Connect, namespaces, deploy the app to **minikube** first |
| 10:30–10:45 | Break | | |
| 10:45–12:00 | 3 · Core objects on AKS | 20 | Build in ACR, deploy to `dev`, scale, rolling update, rollback, probes demo |
| 12:00–13:00 | Lunch | | |
| 13:00–14:45 | 4 · GitHub Actions CI/CD | 20 | OIDC setup, dev + prod pipelines, approval gate, public LoadBalancer |
| 14:45–15:00 | Break | | |
| 15:00–16:05 | 5 · Administration | 20 | RBAC, quotas, LimitRange, metrics, debugging |
| 16:05–16:45 | 6 · OpenShift | 15 | Instructor demo on Developer Sandbox (optional participant lab) |
| 16:45–17:00 | 7 · Wrap-up | 15 | **Cleanup** |

---

## 0. Before the day (instructor)

**T-5 days — send participants the prerequisite mail** (copy `docs-prereqs` block below) and this repo URL.

**T-2 days — verify your own subscription**
```bash
az login
az vm list-usage --location westeurope -o table | grep -i "Standard DSv3"   # need >= 4 vCPU per participant cluster
az provider show -n Microsoft.ContainerService --query registrationState    # must be Registered
az ad app create --display-name permission-probe --query appId -o tsv && az ad app delete --id <that id>   # can participants create app registrations? if not: use plan B (one shared app, see 4.1)
```
**T-1 day**
- Fork/push this repo to the training org; create branches `develop`, `main`, `openshift`. Protect nothing (participants fork it).
- Pre-provision one **fallback AKS + ACR** with `scripts/setup-aks.sh` (`RESOURCE_GROUP=k8s-training-fallback`). Grant participants `Azure Kubernetes Service Cluster User Role` on it.
- Create a **Developer Sandbox** account (https://developers.redhat.com/developer-sandbox) and confirm `oc login` works.
- Run the entire runbook once end-to-end on a clean machine. Budget 90 minutes.

**Morning of** — regenerate the Sandbox token (`oc whoami -t`, expires in 24 h), check the fallback cluster is `Running`.

### Prerequisite mail (docs-prereqs)
- Laptop with 8 GB RAM free, admin rights. Windows users: WSL2 + Ubuntu, run everything inside WSL.
- Install: Docker Desktop (or Podman Desktop), `minikube`, `kubectl`, `az` CLI, `node` 22 LTS, `git`, `curl`. Optional: `oc`.
- Azure subscription where you can create resource groups (check: `az group create -n probe-rg -l westeurope && az group delete -n probe-rg -y`).
- GitHub account; fork the training repository.
- Run `scripts/preflight.sh` from the fork and send the output if anything is red.

---

## Module 0 · 08:30 Environment check
```bash
git clone https://github.com/<ORG>/nestjs-backend.git && cd nestjs-backend
scripts/preflight.sh
minikube start --driver=docker --cpus=2 --memory=4096     # ~2 min; leave it running all day
```
Fallback for a machine that cannot run minikube: pair with a neighbour or use the fallback AKS from 10:00.

## Module 1 · 09:00 Fundamentals on minikube
Theory (20 min) as in the original curriculum. Then:

```bash
kubectl config current-context                   # minikube
kubectl cluster-info
kubectl get nodes -o wide
kubectl get namespaces
kubectl get pods -n kube-system                  # the control plane as pods: apiserver, etcd, scheduler, controller-manager, coredns, kube-proxy
kubectl describe node minikube | sed -n '/Allocatable/,/Events/p'
```
While the room explores, **start AKS creation in the background** (it takes ~6 min):
```bash
az login
source scripts/env.sh                            # generates + persists ACR_NAME
scripts/setup-aks.sh &                           # runs while we continue on minikube
```
Talking points while it runs: `kubectl get events -A --sort-by=.lastTimestamp`, `kubectl api-resources | head -30`.

## Module 2 · 09:50 AKS access — and first deployment (still on minikube)
Theory (10 min): managed control plane, cluster identity, `--attach-acr`, namespaces.

```bash
wait                                              # setup-aks.sh finished?  (or: az aks show -g $RESOURCE_GROUP -n $AKS_CLUSTER_NAME --query provisioningState)
kubectl config get-contexts                       # two contexts now: minikube and training-aks
kubectl config use-context minikube               # stay on minikube for the first deploy
```
Build the image *inside* minikube (no registry needed) and deploy:
```bash
minikube image build -t nestjs-backend:local --build-arg APP_VERSION=1.0.0 .
scripts/deploy.sh minikube nestjs-backend:local   # creates namespace dev, ConfigMap, Deployment, NodePort Service
kubectl get all -n dev
minikube service nestjs-backend-service -n dev --url   # open the URL in a browser: /, /config, /api/items
```
Watch the probes do their job (STARTUP_DELAY_MS=5000 in this overlay):
```bash
kubectl get pods -n dev -w         # Running but 0/1 READY for ~5 s, then 1/1
```

## Module 3 · 10:45 Core objects on AKS
Theory (20 min): Pod, ReplicaSet, Deployment, Service types, probes.

```bash
source scripts/env.sh
kubectl config use-context $AKS_CLUSTER_NAME
kubectl get nodes

# 3.1 build in ACR (cloud build - no local docker required)
az acr build -r $ACR_NAME -t nestjs-backend:v1 --build-arg APP_VERSION=1.0.0 .
az acr build -r $ACR_NAME -t nestjs-backend:v2 --build-arg APP_VERSION=2.0.0 .   # for the rolling update later
az acr repository show-tags -n $ACR_NAME --repository nestjs-backend

# 3.2 deploy to dev
scripts/deploy.sh dev $ACR_LOGIN_SERVER/nestjs-backend:v1
kubectl get pods,svc,endpoints -n dev
scripts/smoke-test.sh dev

# 3.3 every response tells you which pod answered
kubectl port-forward -n dev svc/nestjs-backend-service 8080:80 &
for i in 1 2 3 4 5 6; do curl -s localhost:8080/ | grep -o '"pod":"[^"]*"'; done
curl -s localhost:8080/config

# 3.4 ConfigMap is where the env comes from
kubectl get configmap -n dev
kubectl describe deployment nestjs-backend -n dev | grep -A3 "Environment Variables from"

# 3.5 scale
kubectl scale deployment nestjs-backend -n dev --replicas=4
kubectl get pods -n dev -w                         # Ctrl-C when 4/4

# 3.6 rolling update v1 -> v2 (watch the version change on GET /)
scripts/deploy.sh dev $ACR_LOGIN_SERVER/nestjs-backend:v2
kubectl rollout history deployment/nestjs-backend -n dev
curl -s localhost:8080/ | grep -o '"version":"[^"]*"'

# 3.7 rollback
kubectl rollout undo deployment/nestjs-backend -n dev
kubectl rollout status deployment/nestjs-backend -n dev
curl -s localhost:8080/ | grep -o '"version":"[^"]*"'

# 3.8 probes, made visible
kubectl get endpoints nestjs-backend-service -n dev          # N addresses
curl -s -X POST localhost:8080/demo/unready                  # that pod leaves the endpoints, no restart
kubectl get endpoints nestjs-backend-service -n dev          # N-1
curl -s -X POST localhost:8080/demo/crash                    # RESTARTS column increments
kubectl get pods -n dev
curl -s -X POST localhost:8080/demo/hang                     # ~30 s later liveness fails -> restart
kubectl get events -n dev --sort-by=.lastTimestamp | tail -5

# 3.9 a Secret becomes an env var
curl -s localhost:8080/api/items                              # 200 - no key configured
kubectl create secret generic nestjs-backend-secret -n dev --from-literal=API_KEY=training123
kubectl rollout restart deployment/nestjs-backend -n dev && kubectl rollout status deployment/nestjs-backend -n dev
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/api/items                              # 401
curl -s -H 'x-api-key: training123' localhost:8080/api/items                                   # 200
curl -s localhost:8080/config | grep -o '"apiKeyConfigured":[a-z]*'

# 3.10 break it on purpose: invalid config -> CrashLoopBackOff with a readable reason
kubectl set env deployment/nestjs-backend -n dev APP_ENV=banana
kubectl get pods -n dev; kubectl logs -n dev deploy/nestjs-backend | tail -2
kubectl set env deployment/nestjs-backend -n dev APP_ENV-   # remove override, ConfigMap value returns
kill %1                                                       # stop port-forward
```

## Module 4 · 13:00 GitHub Actions
Theory (20 min): push vs pull (GitOps), OIDC vs stored secrets, environments and approvals.

```bash
# 4.1 Azure side (one command). Plan B if app registrations are blocked: instructor runs it once and shares the 3 IDs.
source scripts/env.sh
scripts/setup-github-oidc.sh <your-github-user>/nestjs-backend

# 4.2 GitHub side: Settings > Secrets and variables > Actions > New repository secret
#     AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, ACR_NAME, RESOURCE_GROUP, AKS_CLUSTER_NAME
#     (values printed by the script)

# 4.3 trigger dev
git checkout -b develop
sed -i 's/Hello from NestJS in the DEV namespace on AKS/Hello from CI, DEV/' k8s/overlays/dev/kustomization.yaml
git commit -am "dev: greeting via pipeline" && git push -u origin develop
# GitHub > Actions > "Deploy to Development (AKS)"  (~3-4 min). Then:
scripts/smoke-test.sh dev                    # greeting changed, version = dev-<sha>

# 4.4 approval gate for prod (optional but impressive)
# GitHub > Settings > Environments > production > Required reviewers > add yourself

# 4.5 trigger prod
git checkout -b main && git push -u origin main
# approve in Actions UI when it pauses. Then:
kubectl get svc nestjs-backend-service -n prod -w            # wait for EXTERNAL-IP (60-90 s)
curl http://<EXTERNAL-IP>/                                    # public!
curl -s -X POST http://<EXTERNAL-IP>/demo/crash              # 403 - demo endpoints disabled in prod via ConfigMap
```
Common issues: secret name typo (`AZURE_CLIENT_ID` vs `AZURE_CLIENTID`); federated credential subject mismatch when the branch is not exactly `develop`/`main` (`az ad app federated-credential list --id <APP_ID>`); npm cache step fails if `package-lock.json` was not committed.

## Module 5 · 15:00 Administration
Theory (20 min) as in the original.
```bash
kubectl config use-context $AKS_CLUSTER_NAME

# 5.1 RBAC
kubectl create serviceaccount dev-deployer -n dev
kubectl create serviceaccount prod-deployer -n prod
kubectl apply -f rbac/
kubectl auth can-i delete deployments --as=system:serviceaccount:dev:dev-deployer -n dev     # yes
kubectl auth can-i delete deployments --as=system:serviceaccount:prod:prod-deployer -n prod  # no
kubectl auth can-i create pods/exec --as=system:serviceaccount:prod:prod-deployer -n prod    # no
kubectl auth can-i list pods --as=system:serviceaccount:dev:dev-deployer -n prod             # no (namespace boundary)
kubectl auth can-i --list --as=system:serviceaccount:prod:prod-deployer -n prod

# 5.2 LimitRange FIRST, then quotas (order matters - see gap E2)
kubectl apply -f quotas/limit-range.yaml
kubectl apply -f quotas/dev-quota.yaml -f quotas/prod-quota.yaml
kubectl describe resourcequota -n dev
kubectl apply -f quotas/test-too-big-pod.yaml                # rejected: exceeded quota
kubectl run tiny --image=registry.k8s.io/pause:3.9 -n dev    # accepted: LimitRange injected defaults
kubectl get pod tiny -n dev -o jsonpath='{.spec.containers[0].resources}{"\n"}'
kubectl delete pod tiny -n dev

# 5.3 metrics
kubectl top nodes
kubectl top pods -n dev
kubectl top pods -n prod --containers

# 5.4 debugging toolbox
kubectl logs -n dev deploy/nestjs-backend --tail=20
kubectl logs -n dev deploy/nestjs-backend --previous          # the container that crashed in 3.8
kubectl exec -n dev deploy/nestjs-backend -- env | sort | grep -E 'APP_|POD_|NODE_'
kubectl exec -n dev deploy/nestjs-backend -it -- sh           # whoami -> uid 1001
kubectl get events -n dev --sort-by=.lastTimestamp | tail
kubectl describe pod -n dev -l app=nestjs-backend | sed -n '/Conditions/,/Events/p'
```

## Module 6 · 16:05 OpenShift (instructor demo)
Follow `openshift/README-openshift.md` step by step on the Developer Sandbox. Show, in this order:
1. Same image, same ConfigMap idea, different `securityContext` story (`oc get pod -o yaml | grep -A5 securityContext` – UID assigned by SCC).
2. `Route` vs `LoadBalancer` – public HTTPS with no cloud load balancer.
3. `oc` = `kubectl` + extras: `oc get all`, `oc status`, `oc rsh`, web console topology view.
4. Push to branch `openshift` to run `deploy-openshift.yaml` if time allows.

## Module 7 · 16:45 Wrap-up
Key takeaways as in the original. Then, everyone:
```bash
minikube delete
source scripts/env.sh && scripts/cleanup.sh      # deletes AKS, ACR, public IPs
az ad app delete --id <APP_ID from 4.1>          # optional
```
Instructor deletes the fallback resource group.
