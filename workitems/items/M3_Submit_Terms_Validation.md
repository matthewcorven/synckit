# M3: Submit + validation + terms

**Owner:** Agent B (API) + Agent A (UI)  
**Status:** Proposed  
**Dependencies:** M2

## Goal
Enable submit with server-side validation and terms acceptance recording.

## Scope
- Terms endpoint + UI gating
- Submit endpoint implementing PRD validation rules
- ProblemDetails field errors wired into UI

## Acceptance criteria
- Submitting invalid draft yields field errors.
- Submitting valid entry sets status Submitted, allocates `SequenceNumber`, and returns `registrationOrTrackingNumber` + `supportId`.
