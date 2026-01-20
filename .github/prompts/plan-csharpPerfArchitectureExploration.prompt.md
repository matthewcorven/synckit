## Plan: C# Server Performance Architecture Exploration (Final)

**TL;DR:** Capture local baseline with 3 test scenarios, apply quick-win optimizations to the base branch, then explore 4 architectural patterns branching from quick-wins—each tested against the same scenarios via automated CI workflow to find the best approach for reducing P95 latency.

### Steps

1. **Capture unoptimized baseline** — On current `feature/11-dotnet-server-perf` with simple `lock`, run `./run-perf-benchmark.sh csharp` and all 3 custom scenarios, save results to `tests/results/baseline-simple-lock.json`. Create [docs/.dotnet-feature/PERF_EXPERIMENTS.md](docs/.dotnet-feature/PERF_EXPERIMENTS.md) with baseline metrics table.

2. **Create test scenario scripts** — Add [tests/perf/scenarios/](tests/perf/scenarios/) with 3 TypeScript scripts:
   - `single-doc-contention.ts` — 10 clients × 1 document × 100 ops/sec (30s)
   - `multi-doc-distribution.ts` — 100 clients × 100 documents × 10 ops/sec (30s)  
   - `burst-recovery.ts` — 50 clients × 10 documents × 100-op bursts + 20s tail

3. **Apply quick-win optimizations to base branch** — On `feature/11-dotnet-server-perf`, implement: pre-sized collections, `ArrayPool<byte>` for buffers, `[MethodImpl(AggressiveInlining)]` on hot paths, cached timestamps. Re-run all scenarios, update [PERF_EXPERIMENTS.md](docs/.dotnet-feature/PERF_EXPERIMENTS.md) with quick-wins results. Commit as new baseline.

4. **Add CI workflow for perf experiments** — Create [.github/workflows/perf-experiment.yml](.github/workflows/perf-experiment.yml) triggered on `perf/*` branches, runs all 3 scenarios, uploads JSON results as artifacts, posts summary comment on PR.

5. **Experiment A: Actor Model (Channels)** — Branch `perf/actor-model` from quick-wins baseline, wrap [Document](server/csharp/src/SyncKit.Server/Sync/Document.cs) with `Channel<DeltaOperation>` per document, remove `_stateLock`. Push to trigger CI.

6. **Experiment B: Single-threaded Event Loop** — Branch `perf/single-threaded` from quick-wins, single global `Channel<Func<ValueTask>>` with one consumer thread. Push to trigger CI.

7. **Experiment C: Striped Locking** — Branch `perf/striped-locks` from quick-wins, 64-stripe lock array in [InMemoryStorageAdapter](server/csharp/src/SyncKit.Server/Storage/InMemoryStorageAdapter.cs). Push to trigger CI.

8. **Experiment D: Dataflow Pipeline** — Branch `perf/dataflow` from quick-wins, use `ActionBlock<T>` with `MaxDegreeOfParallelism=1` per document. Push to trigger CI.

9. **Compare and merge winner** — After all experiments complete, populate comparison matrix in [PERF_EXPERIMENTS.md](docs/.dotnet-feature/PERF_EXPERIMENTS.md), select best architecture, merge to `feature/11-dotnet-server-perf`.

### Test Scenarios

| Scenario | Clients | Documents | Ops/Sec/Client | Total Ops/Sec | Duration | Measures |
|----------|---------|-----------|----------------|---------------|----------|----------|
| **A: Single-Doc Contention** | 10 | 1 | 100 | 1,000 | 30s | Lock contention |
| **B: Multi-Doc Distribution** | 100 | 100 | 10 | 1,000 | 30s | Overhead without contention |
| **C: Burst + Recovery** | 50 | 10 | burst 100 | 5,000 peak | 10s + 20s | Queue depth, recovery |

### Expected Results Template (for PERF_EXPERIMENTS.md)

| Experiment | Scenario A P95 | Scenario B P95 | Scenario C P95 | Throughput | Memory |
|------------|----------------|----------------|----------------|------------|--------|
| Baseline (simple lock) | TBD | TBD | TBD | TBD | TBD |
| + Quick-wins | TBD | TBD | TBD | TBD | TBD |
| Actor Model | TBD | TBD | TBD | TBD | TBD |
| Single-threaded | TBD | TBD | TBD | TBD | TBD |
| Striped Locks | TBD | TBD | TBD | TBD | TBD |
| Dataflow | TBD | TBD | TBD | TBD | TBD |

### Further Considerations

1. **Baseline before quick-wins is critical** — Must capture unoptimized baseline first so we can measure quick-win impact independently before architectural changes.

2. **Experiments build on quick-wins** — Apply quick-wins to `feature/11-dotnet-server-perf` first, then branch experiments from there so they all include the micro-optimizations.

3. **CI integration for reproducibility** — Add GitHub Actions workflow that runs all 3 scenarios automatically when pushing to any `perf/*` branch, storing results as artifacts for easy comparison.
