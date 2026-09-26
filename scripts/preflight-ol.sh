#!/usr/bin/env bash
# Participant environment check. Green = ready.
ok(){ printf '\033[32m  OK  \033[0m %s\n' "$1"; }
bad(){ printf '\033[31m FAIL \033[0m %s\n' "$1"; FAILED=1; }
need(){ command -v "$1" >/dev/null 2>&1 && ok "$1 $(${1} ${2:-version} 2>/dev/null | head -1 | cut -c1-60)" || bad "$1 not installed - $3"; }

need git --version "https://git-scm.com"
need node --version "Node 22 LTS: https://nodejs.org"
need npm --version "comes with node"
need docker --version "Docker Desktop or Podman (alias docker=podman)"
need minikube version "https://minikube.sigs.k8s.io/docs/start/"
need kubectl "version --client" "https://kubernetes.io/docs/tasks/tools/"
need az version "https://learn.microsoft.com/cli/azure/install-azure-cli"
need curl --version "curl"

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
[[ "${NODE_MAJOR:-0}" -ge 20 ]] && ok "node major version $NODE_MAJOR" || bad "node must be >= 20 (found ${NODE_MAJOR:-none})"

docker info >/dev/null 2>&1 && ok "docker daemon reachable" || bad "docker daemon not running - start Docker Desktop"
az account show >/dev/null 2>&1 && ok "az logged in ($(az account show --query name -o tsv))" || bad "run: az login"

MEM_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
if [[ -n "$MEM_KB" ]]; then [[ "$MEM_KB" -gt 4000000 ]] && ok "free memory $((MEM_KB/1024)) MB" || bad "less than 4 GB free memory - close apps before minikube start"; fi

[[ -z "$FAILED" ]] && echo && echo "All good. Next: minikube start --driver=docker --cpus=2 --memory=4096" || { echo; echo "Fix the FAIL lines above, then re-run."; exit 1; }
