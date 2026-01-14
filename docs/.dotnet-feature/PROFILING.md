# Profiling Guide

This document describes how to run profiling locally and in CI for the SyncKit .NET server.

Workflows
- The repository contains a label-gated profiling workflow (`perf/profile`) and a manual workflow_dispatch option.
- The profiling run collects a 120s dotnet-trace and dotnet-counters capture while a burst→sustained workload runs.

Local profiling
- Install tools:
  - dotnet tool install --global dotnet-trace --version 9.0.661903
  - dotnet tool install --global dotnet-counters --version 9.0.661903
- Run: tests/scripts/profile-against-csharp.sh
- Load generator is: tests/scripts/profile-load.sh (defaults: burst 200 conns for 10s, sustain 100 conns for 120s at 50ms intervals, 256B payload)

Artifacts
- The profiling workflow produces:
  - .nettrace (NetTrace)
  - .speedscope.json (Speedscope format)
  - counters-<id>.json (dotnet-counters output)
  - server-<id>.log
  - health-<id>.json
- Artifacts are retained for 7 days in GitHub Actions.

Interpreting traces
- Open the .speedscope.json in https://www.speedscope.app/ to view sampled stacks and hotspots.
- Use counters JSON to inspect allocation rate, GC pauses, and CPU time.

Security
- Profiling on PRs is label-gated using pull_request_target with a collaborator check to avoid running on untrusted forks.
