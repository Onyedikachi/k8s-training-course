# OpenShift demo (Module 6)

Recommended cluster: **Red Hat Developer Sandbox** (free, 30 days, browser login, no install).
Note: the Sandbox gives you ONE pre-created project (`<username>-dev`); `oc new-project` is NOT allowed there.

```bash
# 1. login (copy the "oc login --token=... --server=..." line from the web console: user menu > Copy login command)
oc login --token=sha256~... --server=https://api.sandbox....openshiftapps.com:6443
oc project                                   # shows your project, e.g. jdoe-dev
export OCP_NS=$(oc project -q)

# 2. let OpenShift pull from the private ACR (token scoped to pull only)
az acr token create -n ocp-pull -r $ACR_NAME --scope-map _repositories_pull --query 'credentials.passwords[0].value' -o tsv > /tmp/acr-pull.txt
oc create secret docker-registry acr-pull \
  --docker-server=$ACR_NAME.azurecr.io --docker-username=ocp-pull --docker-password="$(cat /tmp/acr-pull.txt)" -n $OCP_NS

# 3. deploy the SAME image that runs on AKS
oc apply -n $OCP_NS -f openshift/configmap.yaml
sed "s|IMAGE_PLACEHOLDER|$ACR_NAME.azurecr.io/nestjs-backend:v1|" openshift/deployment.yaml | oc apply -n $OCP_NS -f -
oc apply -n $OCP_NS -f openshift/service.yaml -f openshift/route.yaml
oc rollout status deployment/nestjs-backend -n $OCP_NS

# 4. test through the Route (public HTTPS, no LoadBalancer needed)
curl -s https://$(oc get route nestjs-backend-route -n $OCP_NS -o jsonpath='{.spec.host}')/
oc get pod -n $OCP_NS -o jsonpath='{.items[0].spec.containers[0].securityContext}{"\n"}'   # note the injected UID

# 5. things to point out
oc get scc restricted-v2 -o yaml | head -40   # why runAsUser must not be hard-coded
oc get routes; oc describe route nestjs-backend-route
```

For the GitHub Actions workflow add secrets: `OPENSHIFT_SERVER`, `OPENSHIFT_TOKEN` (from `oc whoami -t`), `OPENSHIFT_NAMESPACE`.
Sandbox tokens expire after ~24 h - generate it on the morning of the training.
