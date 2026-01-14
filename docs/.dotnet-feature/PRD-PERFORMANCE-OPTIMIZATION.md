
## Iteration 7: Add CI support for diagnostic tooling

**Date:** 2026-01-13
**Change:** Updated .github/workflows/dotnet-server.yml to install dotnet-trace and dotnet-counters as global dotnet tools so profiling can be executed in CI runs.
**Files Modified:**
- .github/workflows/dotnet-server.yml

**Hypothesis:** Having diagnostic tools available in CI will enable automated allocation sampling and traces during integration runs and help catch allocation regressions earlier.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 49/61 (80%) | N/A (CI change) | N/A |
| Server Stable | N/A | N/A | N/A |
| Timeouts | N/A | N/A | N/A |

### Evidence
- Workflow updated to install dotnet-trace and dotnet-counters; will validate on next CI run.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase C - Run CI with profiling enabled to collect allocation traces; added label-gated profiling workflow and local profiling scripts to run 120s traces and upload artifacts (see new workflows and tests/scripts).
