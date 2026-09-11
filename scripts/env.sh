# source this file in every new terminal:  source scripts/env.sh
# Put the same values in a file called .training-env (git-ignored) so they survive terminal restarts.
if [[ -f "$(dirname "${BASH_SOURCE[0]}")/../.training-env" ]]; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/../.training-env"
fi
export LOCATION="${LOCATION:-westeurope}"
export RESOURCE_GROUP="${RESOURCE_GROUP:-k8s-training-rg}"
export AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-training-aks}"
# ACR names: globally unique, 5-50 lowercase alphanumerics. Set once, persist it.
export ACR_NAME="${ACR_NAME:-}"
if [[ -z "$ACR_NAME" ]]; then
  export ACR_NAME="trainingacr$(whoami | tr -cd 'a-z0-9' | cut -c1-8)$(date +%m%d)"
  echo "ACR_NAME=$ACR_NAME" >> "$(dirname "${BASH_SOURCE[0]}")/../.training-env"
  echo ">> generated ACR_NAME=$ACR_NAME (saved to .training-env)"
fi
export ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
echo "LOCATION=$LOCATION RESOURCE_GROUP=$RESOURCE_GROUP AKS=$AKS_CLUSTER_NAME ACR=$ACR_LOGIN_SERVER"
