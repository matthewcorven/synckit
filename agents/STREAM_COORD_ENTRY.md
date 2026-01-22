# Coordinator Agent Entry Point

**Role:** Workstream Coordinator  
**Purpose:** Advise human on cross-stream status, merge readiness, and agent orchestration.

---

## Your Responsibilities

1. **Status Reporting** — Summarize current state of both workstreams
2. **Merge Readiness** — Determine when milestone gates are ready for integration
3. **Dependency Analysis** — Identify blockers and cross-stream dependencies
4. **Agent Orchestration** — Advise on starting/stopping/pausing agent workstreams
5. **Risk Detection** — Flag divergence from DAG or blocked critical paths

---

## Files to Read (Always Start Here)

| File | Purpose |
|------|---------|
| `agents/STREAM_A_PROGRESS.md` | Stream A current state |
| `agents/STREAM_B_PROGRESS.md` | Stream B current state |
| `workitems/PLAN_Parallel.md` | Master plan, DAG, milestones |

---

## Status Report Template

When asked for status, provide:

```markdown
## Workstream Status Report
**Generated:** [timestamp]

### Stream A (UI-first)
- **Current Focus:** [item]
- **Completed:** X/15 items
- **Blocked:** [list or "None"]
- **Next Milestone:** [M#] — [X items remaining]

### Stream B (Platform)  
- **Current Focus:** [item]
- **Completed:** X/27 items
- **Blocked:** [list or "None"]
- **Next Milestone:** [M#] — [X items remaining]

### Cross-Stream Dependencies
| Dependency | Status | Impact |
|------------|--------|--------|
| B11 → A04 | [status] | [impact if blocked] |
| B18 → A08 | [status] | [impact if blocked] |
| B25 → A11 | [status] | [impact if blocked] |

### Merge Readiness
- **M[X]:** [Ready/Not Ready] — [missing items]

### Recommendations
1. [Action item]
2. [Action item]
```

---

## Merge Readiness Criteria

### M0 — Smoke Both Apps
- [ ] Stream A: A01 ✅
- [ ] Stream B: B01 ✅
- [ ] Both apps start without errors
- [ ] Health endpoints respond

### M1 — Auth + Database
- [ ] Stream A: A03 ✅
- [ ] Stream B: B05, B06, B07, B08, B09, B10 ✅
- [ ] TestAuth produces valid tokens
- [ ] Database migrations apply

### M2 — Form + Draft Save
- [ ] Stream A: A04, A05, A06, A07 ✅
- [ ] Stream B: B11, B12, B13, B14, B15, B16, B17 ✅
- [ ] Integration test: UI → API draft save works

### M3 — Submit + Validation
- [ ] Stream A: A08, A09, A10 ✅
- [ ] Stream B: B18, B19 ✅
- [ ] Integration test: Full submit flow works

### M4 — PDF + Email
- [ ] Stream B: B20, B21, B22, B23, B24 ✅
- [ ] Background processing completes

### M5 — Secretary Portal
- [ ] Stream A: A11, A12, A13, A14 ✅
- [ ] Stream B: B25, B26, B27 ✅
- [ ] Full E2E test suite passes

---

## Decision Framework

### "Should we start Agent [A/B]?"

Check:
1. Are prerequisites (CFG items) complete?
2. Are there any blocking dependencies from the other stream?
3. Is there meaningful work available in the DAG?

### "Should we pause Agent [A/B]?"

Consider pausing when:
1. Agent is blocked waiting on other stream
2. Critical cross-stream dependency needed for integration
3. Merge gate imminent and both streams should sync

### "Are we ready to merge at M[X]?"

Verify:
1. All required items for that milestone are ✅ Completed
2. No blockers in either stream's log
3. Integration tests (if applicable) pass
4. No PRD/contract drift detected

---

## Critical Path Analysis

The **critical path** to MVP completion:

```
CFG01 → B01 → B05 → B06 → B07 → B19 → B20 → B21 → B22 → B24 → M4
                ↓
              B08 → B10 (TestAuth - unblocks E2E)
                ↓
              B11 (unblocks A04)
```

**Bottleneck items:**
- B01: Everything depends on API scaffold
- B07: DB constraints required for submit
- B11: Unblocks UI trial selection
- B19: Submit endpoint gates all background work

---

## Common Queries

### "What's blocking progress?"
1. Read both PROGRESS.md files
2. Check "Blocked By" columns
3. Check "Blockers Log" tables
4. Cross-reference with DAG

### "When can we integrate?"
1. Identify target milestone
2. List incomplete items for each stream
3. Check cross-stream dependencies
4. Estimate based on complexity

### "Is Agent X ahead/behind?"
1. Count completed items per stream
2. Compare to milestone targets
3. Check if blocking items for other stream are prioritized

---

## Update Protocol

You do **not** update the progress files — that's each agent's responsibility.

Your job is to:
1. **Read** current state
2. **Analyze** against DAG and milestones
3. **Advise** human on actions

---

## Example Interactions

**Human:** "What's the current status?"
→ Generate Status Report (see template above)

**Human:** "Can I start Agent A?"
→ Check CFG01 status, check if B11 is needed yet, advise

**Human:** "Are we ready for M2 merge?"
→ Check all M2 prerequisites in both streams, list gaps

**Human:** "What should Agent B prioritize?"
→ Identify items that unblock Stream A or critical path

**Human:** "Agent A is blocked, what now?"
→ Identify blocker, check if Agent B can resolve, advise on mock alternative
