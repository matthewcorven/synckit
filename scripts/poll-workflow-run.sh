#!/usr/bin/env bash
set -euo pipefail

# poll-workflow-run.sh
# Usage: ./scripts/poll-workflow-run.sh [run_id|--latest] [--timeout N] [--interval N]
#
# Polls a specific GitHub Actions workflow run until completion or timeout.
# If run_id is --latest or omitted, finds the latest run for perf-benchmark.yml on current branch.
#
# Environment:
#   GITHUB_TOKEN - Required for authenticated API requests
#   OWNER_REPO   - Optional: owner/repo (auto-detected from git remote if not set)

GITHUB_TOKEN=${GITHUB_TOKEN:-}
OWNER_REPO="${OWNER_REPO:-matthewcorven/synckit}"
WORKFLOW_PATH=".github/workflows/perf-benchmark.yml"

die(){ echo "❌ ERROR: $*" >&2; exit 1; }
info(){ echo "ℹ️  $*"; }
success(){ echo "✅ $*"; }
warn(){ echo "⚠️  $*"; }

api_get(){
  local url="$1"
  if [[ -n "$GITHUB_TOKEN" ]]; then
    curl -sS -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$url"
  else
    curl -sS -H "Accept: application/vnd.github+json" "$url"
  fi
}

determine_repo(){
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    OWNER_REPO="$GITHUB_REPOSITORY"
    return
  fi
  if [[ -n "${OWNER_REPO:-}" && "$OWNER_REPO" != "" ]]; then
    return
  fi
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local url
    url=$(git remote get-url origin || true)
    if [[ -z "$url" ]]; then die "Cannot determine git remote origin URL"; fi
    if [[ "$url" =~ github.com[:/]+([^/]+)/([^.]+)(.git)?$ ]]; then
      OWNER_REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    else
      die "Unsupported remote URL format: $url"
    fi
  else
    die "Not in a git repository and GITHUB_REPOSITORY/OWNER_REPO not set"
  fi
}

get_workflow_id(){
  local resp
  resp=$(api_get "https://api.github.com/repos/$OWNER_REPO/actions/workflows/$WORKFLOW_PATH")
  echo "$resp" | jq -r '.id // empty'
}

get_latest_run_id(){
  local workflow_id="$1"
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  local url="https://api.github.com/repos/$OWNER_REPO/actions/workflows/$workflow_id/runs?per_page=1"
  if [[ -n "$branch" ]]; then
    url="${url}&branch=$branch"
  fi
  local resp
  resp=$(api_get "$url")
  echo "$resp" | jq -r '.workflow_runs[0].id // empty'
}

get_run_info(){
  local run_id="$1"
  api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id"
}

get_jobs(){
  local run_id="$1"
  api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id/jobs"
}

get_artifacts(){
  local run_id="$1"
  api_get "https://api.github.com/repos/$OWNER_REPO/actions/runs/$run_id/artifacts"
}

print_status(){
  local run_id="$1"
  local run_json jobs_json artifacts_json
  
  run_json=$(get_run_info "$run_id")
  jobs_json=$(get_jobs "$run_id")
  artifacts_json=$(get_artifacts "$run_id")
  
  local status conclusion event head_branch head_sha html_url name
  status=$(echo "$run_json" | jq -r '.status')
  conclusion=$(echo "$run_json" | jq -r '.conclusion // "n/a"')
  event=$(echo "$run_json" | jq -r '.event')
  head_branch=$(echo "$run_json" | jq -r '.head_branch')
  head_sha=$(echo "$run_json" | jq -r '.head_sha')
  html_url=$(echo "$run_json" | jq -r '.html_url')
  name=$(echo "$run_json" | jq -r '.name')
  
  local jobs_total
  jobs_total=$(echo "$jobs_json" | jq -r '.total_count')
  
  local artifacts_total
  artifacts_total=$(echo "$artifacts_json" | jq -r '.total_count')
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Workflow Run: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "   Run ID:      $run_id"
  echo "   Status:      $status"
  echo "   Conclusion:  $conclusion"
  echo "   Event:       $event"
  echo "   Branch:      $head_branch"
  echo "   Commit:      ${head_sha:0:12}"
  echo "   Jobs:        $jobs_total"
  echo "   Artifacts:   $artifacts_total"
  echo "   URL:         $html_url"
  echo ""
  
  if [[ "$jobs_total" != "0" ]]; then
    echo "📦 Jobs:"
    echo "$jobs_json" | jq -r '.jobs[] | "   • \(.name): \(.status) (\(.conclusion // "pending"))"'
    echo ""
  fi
  
  if [[ "$artifacts_total" != "0" ]]; then
    echo "📁 Artifacts:"
    echo "$artifacts_json" | jq -r '.artifacts[] | "   • \(.name) (\(.size_in_bytes) bytes)"'
    echo ""
  fi
  
  echo "$status"
}

poll_run(){
  local run_id="$1"
  local timeout="${2:-600}"
  local interval="${3:-15}"
  local elapsed=0
  
  info "Polling run $run_id every ${interval}s (timeout: ${timeout}s)..."
  echo ""
  
  while (( elapsed < timeout )); do
    local status
    status=$(print_status "$run_id" | tail -1)
    
    if [[ "$status" == "completed" ]]; then
      success "Run completed!"
      return 0
    fi
    
    info "Waiting ${interval}s... (elapsed: ${elapsed}s / ${timeout}s)"
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  
  warn "Timeout reached after ${timeout}s"
  return 1
}

usage(){
  cat <<EOF
Usage: $0 [run_id|--latest] [OPTIONS]

Poll a GitHub Actions workflow run until completion.

Arguments:
  run_id        Specific run ID to poll (or --latest for most recent)
  --latest      Use the latest run for perf-benchmark.yml on current branch

Options:
  --timeout N   Maximum seconds to wait (default: 600)
  --interval N  Seconds between polls (default: 15)
  --once        Print status once and exit (no polling)
  --help        Show this help

Environment:
  GITHUB_TOKEN  GitHub PAT for API access (recommended)
  OWNER_REPO    Override owner/repo detection

Examples:
  $0 --latest                    # Poll latest run
  $0 12345678 --timeout 300      # Poll specific run, 5min timeout
  $0 --latest --once             # Just show current status
EOF
}

main(){
  local run_id="" timeout=600 interval=15 once=false
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help|-h) usage; exit 0;;
      --latest) run_id="latest"; shift;;
      --timeout) timeout="$2"; shift 2;;
      --interval) interval="$2"; shift 2;;
      --once) once=true; shift;;
      *) 
        if [[ -z "$run_id" ]]; then
          run_id="$1"
        else
          die "Unexpected argument: $1"
        fi
        shift
        ;;
    esac
  done
  
  determine_repo
  info "Repository: $OWNER_REPO"
  
  if [[ -z "$run_id" || "$run_id" == "latest" ]]; then
    local workflow_id
    workflow_id=$(get_workflow_id)
    if [[ -z "$workflow_id" ]]; then
      die "Could not find workflow ID for $WORKFLOW_PATH"
    fi
    run_id=$(get_latest_run_id "$workflow_id")
    if [[ -z "$run_id" ]]; then
      die "No runs found for workflow on current branch"
    fi
    info "Using latest run: $run_id"
  fi
  
  if $once; then
    print_status "$run_id" | head -n -1
    exit 0
  fi
  
  poll_run "$run_id" "$timeout" "$interval"
}

main "$@"
