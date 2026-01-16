#!/usr/bin/env bash
set -euo pipefail

# collect-perf-diagnostics.sh
# Usage: ./scripts/collect-perf-diagnostics.sh [run_id] [--wait-seconds N]
# If run_id omitted, picks the latest workflow run for the perf workflow on the current branch.
# Requires: curl, jq, unzip (for artifact extraction). Prefer to have GITHUB_TOKEN set for authenticated requests.

GITHUB_TOKEN=${GITHUB_TOKEN:-}
OWNER_REPO=""

die(){ echo "ERROR: $*" >&2; exit 1; }
info(){ echo "[INFO] $*"; }

api_get(){
  local url="$1"
  if [[ -n "$GITHUB_TOKEN" ]]; then
    curl -sS -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$url"
  else
    curl -sS -H "Accept: application/vnd.github+json" "$url"
  fi
}

# Determine owner/repo from git
determine_repo(){
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    OWNER_REPO="$GITHUB_REPOSITORY"
    return
  fi
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local url
    url=$(git remote get-url origin || true)
    if [[ -z "$url" ]]; then die "Cannot determine git remote origin URL"; fi
    # url formats: git@github.com:owner/repo.git or https://github.com/owner/repo.git
    if [[ "$url" =~ github.com[:/]+([^/]+)/([^.]+)(.git)?$ ]]; then
      OWNER_REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    else
      die "Unsupported remote URL format: $url"
    fi
  else
    die "Not in a git repository and GITHUB_REPOSITORY not set"
  fi
}

# Find the perf workflow by path and get its id
get_workflow_id(){
  local path=".github/workflows/perf-benchmark.yml"
  local resp
  resp=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/workflows/$path")
  echo "$resp" | jq -r '.id // empty'
}

# Get latest run id for the workflow and branch
get_latest_run(){
  local workflow_id="$1"
  local branch param
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [[ -n "$branch" ]]; then
    param="branch=$branch"
  else
    param=""
  fi
  local resp
  resp=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/workflows/$workflow_id/runs?per_page=5&$param")
  echo "$resp" | jq -r '.workflow_runs[0].id // empty'
}

# Print summary for run
print_run_summary(){
  local run_id="$1"
  local r
  r=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id")
  echo "\n=== RUN SUMMARY ==="
  echo "run_id: $(echo "$r" | jq -r '.id')"
  echo "name: $(echo "$r" | jq -r '.name')"
  echo "status: $(echo "$r" | jq -r '.status')"
  echo "conclusion: $(echo "$r" | jq -r '.conclusion')"
  echo "event: $(echo "$r" | jq -r '.event')"
  echo "head_branch: $(echo "$r" | jq -r '.head_branch')"
  echo "head_sha: $(echo "$r" | jq -r '.head_sha')"
  echo "html_url: $(echo "$r" | jq -r '.html_url')"
}

# Poll until run completes or timeout
wait_for_run_completion(){
  local run_id="$1"; local timeout=${2:-600}; local interval=8; local elapsed=0
  info "Waiting up to ${timeout}s for run $run_id to complete (poll every ${interval}s)..."
  while (( elapsed < timeout )); do
    local s
    s=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id" | jq -r '.status')
    if [[ "$s" == "completed" ]]; then
      info "Run $run_id completed"
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed+interval))
  done
  die "Timeout waiting for run $run_id to complete"
}

# Download artifacts and extract diagnostic files
download_and_inspect_artifacts(){
  local run_id="$1"
  local resp
  resp=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id/artifacts")
  local total
  total=$(echo "$resp" | jq -r '.total_count')
  if [[ "$total" == "0" ]]; then
    info "No artifacts found for run $run_id"
    return 1
  fi
  info "Found $total artifacts, downloading..."
  mkdir -p /tmp/perf-diagnostics/run-$run_id/artifacts
  local items
  items=$(echo "$resp" | jq -c '.artifacts[]')
  local i=0
  while read -r art; do
    i=$((i+1))
    local id name url
    id=$(echo "$art" | jq -r '.id')
    name=$(echo "$art" | jq -r '.name')
    url=$(echo "$art" | jq -r '.archive_download_url')
    echo "- Artifact #$i: $name (id: $id)"
    if [[ -z "$GITHUB_TOKEN" ]]; then
      curl -sSL "$url" -o /tmp/perf-diagnostics/run-$run_id/artifacts/artifact-$id.zip
    else
      curl -sS -H "Authorization: token $GITHUB_TOKEN" -L "$url" -o /tmp/perf-diagnostics/run-$run_id/artifacts/artifact-$id.zip
    fi
    unzip -q -d /tmp/perf-diagnostics/run-$run_id/artifacts/artifact-$id /tmp/perf-diagnostics/run-$run_id/artifacts/artifact-$id.zip || true
  done <<<"$(echo "$resp" | jq -c '.artifacts[]')"

  # Search for key diagnostic files and print tails
  echo "\n--- Diagnostic files (tails) ---"
  local found=0
  for f in $(find /tmp/perf-diagnostics/run-$run_id/artifacts -type f -name '*.log' -o -name '*.txt' -o -name '*smoke*' -o -name '*bun*' ); do
    found=1
    echo "\n== File: $f =="
    tail -n 200 "$f" || true
  done
  if [[ $found -eq 0 ]]; then
    info "No log-like files found in artifacts"
    return 2
  fi
  return 0
}

# If no artifacts, check ci/perf-diagnostics branch tree for files
check_perf_diagnostics_branch(){
  local run_id="$1"
  # Get branch tip sha
  local branch_resp
  branch_resp=$(api_get "https://api.github.com/repos/$OWNER_REPO/branches/ci/perf-diagnostics" ) || { info "ci/perf-diagnostics branch not found"; return 1; }
  local sha
  sha=$(echo "$branch_resp" | jq -r '.commit.sha // empty')
  if [[ -z "$sha" ]]; then info "No commit found on ci/perf-diagnostics"; return 1; fi
  local tree
  tree=$(api_get "https://api.github.com/repos/$OWNER_REPO/git/trees/$sha?recursive=1")
  # Find interesting diagnostic files
  local candidates
  candidates=$(echo "$tree" | jq -r '.tree[] | select(.path | test("bun-install|smoke|diagnostics")) | .path' ) || true
  if [[ -z "$candidates" ]]; then info "No perf diagnostics files found on ci/perf-diagnostics branch"; return 1; fi
  echo "\n--- Files on ci/perf-diagnostics branch matching bun/smoke/diagnostics ---"
  while read -r p; do
    echo "\n== $p =="
    # Use raw URL to fetch file
    curl -sS "https://raw.githubusercontent.com/$OWNER_REPO/ci/perf-diagnostics/$p" || true
  done <<<"$candidates"
  return 0
}

# Print job list and minimal job details
print_jobs(){
  local run_id="$1"
  local r
  r=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id/jobs")
  local total
  total=$(echo "$r" | jq -r '.total_count')
  echo "\n=== JOBS (total: $total) ==="
  if [[ "$total" == "0" ]]; then
    echo "No jobs were created for this run."
    return 1
  fi
  echo "$r" | jq -r '.jobs[] | "- id: \(.id) name: \(.name) status: \(.status) conclusion: \(.conclusion) started_at: \(.started_at) completed_at: \(.completed_at)"'
}

# Main
main(){
  determine_repo
  local provided_run_id=""; local wait_seconds=600
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --wait|--wait-seconds) wait_seconds="$2"; shift 2;;
      --help|-h) sed -n '1,160p' "$0"; exit 0;;
      *) if [[ -z "$provided_run_id" ]]; then provided_run_id="$1"; shift; else die "Unexpected arg: $1"; fi;;
    esac
  done

  local workflow_id run_id
  workflow_id=$(get_workflow_id) || die "Failed to find perf workflow id"
  if [[ -n "$provided_run_id" ]]; then
    run_id="$provided_run_id"
  else
    run_id=$(get_latest_run "$workflow_id")
  fi
  [[ -n "$run_id" ]] || die "Could not determine run id"

  print_run_summary "$run_id"

  # If run not completed, wait
  local status
  status=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id" | jq -r '.status')
  if [[ "$status" != "completed" ]]; then
    wait_for_run_completion "$run_id" "$wait_seconds"
  fi

  print_run_summary "$run_id"
  print_jobs "$run_id" || true

  if download_and_inspect_artifacts "$run_id"; then
    info "Artifacts inspected"
    exit 0
  fi

  # Fallback: check branch
  if check_perf_diagnostics_branch "$run_id"; then
    info "Found diagnostics on ci/perf-diagnostics branch"
    exit 0
  fi

  info "No artifacts or branch diagnostics discovered. Fetching run logs URL for more context"
  local run_json
  run_json=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id")
  echo "logs_url: $(echo "$run_json" | jq -r '.logs_url')"
  echo "check_suite_url: $(echo "$run_json" | jq -r '.check_suite_url')"

  info "Done."
}

main "$@"
