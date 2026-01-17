# Plan: Auto-Update SERVER_PERFORMANCE.md in Perf Pipeline

## Current State

### Existing Components ✅
1. **`tests/perf/update-perf-table.ts`** - Script that:
   - Reads JSON results from `tests/results/perf-*.json`
   - Finds latest results for each server type (TypeScript, C#)
   - Updates `docs/architecture/SERVER_PERFORMANCE.md` between markers:
     - `<!-- PERF_TABLE_START -->` / `<!-- PERF_TABLE_END -->`
     - `<!-- PERF_ENV_START -->` / `<!-- PERF_ENV_END -->`

2. **`tests/run-perf-benchmark.sh`** - Already calls:
   ```bash
   bun run perf/capture-all.ts    # Generates perf-{serverType}-{timestamp}.json
   bun run perf/update-perf-table.ts  # Updates SERVER_PERFORMANCE.md
   ```

3. **Workflow `perf-benchmark.yml`** - Currently:
   - Runs benchmark and update script
   - Uploads `SERVER_PERFORMANCE.md` as artifact
   - **Does NOT commit changes back to repo**

### Gap
The updated `SERVER_PERFORMANCE.md` is only available as a downloadable artifact. It's not committed back to the repository.

---

## Proposed Solution

### Option A: Auto-Commit to Feature Branch (Recommended)

Add a step after the perf run to commit and push the updated file:

```yaml
- name: Commit updated SERVER_PERFORMANCE.md
  if: success()
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    
    # Check if there are changes
    if git diff --quiet docs/architecture/SERVER_PERFORMANCE.md; then
      echo "No changes to SERVER_PERFORMANCE.md"
      exit 0
    fi
    
    # Commit and push
    git add docs/architecture/SERVER_PERFORMANCE.md
    git commit -m "docs(perf): update SERVER_PERFORMANCE.md with ${{ github.event.inputs.server_type }} results

    Run ID: ${{ github.run_id }}
    Server Type: ${{ github.event.inputs.server_type }}
    Triggered by: ${{ github.actor }}"
    
    git push origin HEAD:${{ github.ref_name }}
```

**Pros:**
- Automatic, no manual steps
- Changes tracked in git history
- Works with existing workflow permissions

**Cons:**
- Commits directly to feature branch (acceptable for perf updates)
- Needs `contents: write` permission

### Option B: Create PR with Changes

Use `peter-evans/create-pull-request` action to create a PR:

```yaml
- name: Create PR with perf results
  if: success()
  uses: peter-evans/create-pull-request@v5
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    commit-message: "docs(perf): update SERVER_PERFORMANCE.md with ${{ github.event.inputs.server_type }} results"
    branch: perf-results/${{ github.run_id }}
    title: "📊 Perf Results: ${{ github.event.inputs.server_type }} (${{ github.run_id }})"
    body: |
      Auto-generated perf results update.
      
      **Server Type:** ${{ github.event.inputs.server_type }}
      **Run:** ${{ github.run_id }}
    labels: documentation, automated
```

**Pros:**
- Review before merge
- Clean git history on main branches

**Cons:**
- Requires manual merge
- Additional action dependency

### Option C: Commit to Dedicated Results Branch

Push results to a `perf-results` branch for historical tracking:

```yaml
- name: Push results to perf-results branch
  run: |
    git fetch origin perf-results || git checkout -b perf-results
    git checkout perf-results
    cp tests/results/*.json perf-history/
    cp docs/architecture/SERVER_PERFORMANCE.md .
    git add .
    git commit -m "perf(${{ github.event.inputs.server_type }}): ${{ github.run_id }}"
    git push origin perf-results
```

---

## Recommended Implementation: Option A

### Changes to `perf-benchmark.yml`

Add after the upload steps:

```yaml
      - name: Commit updated SERVER_PERFORMANCE.md
        if: success()
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          
          # Check if SERVER_PERFORMANCE.md was updated
          if git diff --quiet docs/architecture/SERVER_PERFORMANCE.md; then
            echo "ℹ️ No changes to SERVER_PERFORMANCE.md - skipping commit"
            exit 0
          fi
          
          echo "📊 Changes detected in SERVER_PERFORMANCE.md"
          git diff docs/architecture/SERVER_PERFORMANCE.md
          
          # Stage and commit
          git add docs/architecture/SERVER_PERFORMANCE.md
          git commit -m "docs(perf): update SERVER_PERFORMANCE.md [${{ github.event.inputs.server_type }}]
          
          Automated update from perf benchmark run.
          
          Run ID: ${{ github.run_id }}
          Server: ${{ github.event.inputs.server_type }}
          Branch: ${{ github.ref_name }}
          Actor: ${{ github.actor }}"
          
          # Push to the same branch
          git push origin HEAD:${{ github.ref_name }}
          echo "✅ Committed and pushed SERVER_PERFORMANCE.md update"
```

### Permissions

Ensure the workflow has write permissions:

```yaml
permissions:
  contents: write
  actions: read
```

Or in repository settings, ensure "Workflow permissions" allows read/write.

---

## Implementation Checklist

- [ ] Add `permissions: contents: write` to workflow
- [ ] Add commit step after artifact upload
- [ ] Test with TypeScript server run
- [ ] Test with C# server run
- [ ] Verify commit appears in branch history
- [ ] Verify SERVER_PERFORMANCE.md shows both server results after both runs

---

## Future Enhancements

1. **Historical Tracking**: Keep JSON results in `tests/results/history/` with date subdirs
2. **Trend Charts**: Generate SVG charts from historical data
3. **Regression Alerts**: Compare current vs previous and warn if >10% regression
4. **Badge Generation**: Create shields.io compatible badges for README
