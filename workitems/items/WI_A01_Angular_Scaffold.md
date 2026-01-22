# WI-A01: Angular Scaffold

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** CFG01  
**Artifacts folder (recommended):** `../artifacts/WI-A01/`

## Goal
Create the Angular 22 application shell with Material design, routing, and the base layout structure.

## Scope
### In
- Angular 22 project initialization with strict mode
- Angular Material integration
- Routing module with lazy-loaded feature modules
- Base layout component (header, nav, content area)
- Environment configuration for mock/live switching
- Basic theme configuration

### Out
- Actual page content (see A02-A13)
- Playwright tests (see A14)
- Mock data (see A15)

## Implementation notes
- Use Angular CLI: `ng new dog-trials-web --routing --style=scss`
- Install Material: `ng add @angular/material`
- Use standalone components (Angular 22 default)
- Configure environment files per stream (from CFG01)
- Create feature module structure:
  - `trials/` — Trial selection
  - `registration/` — Entry form
  - `secretary/` — Secretary portal
- Follow API contract DTOs for model shapes

## Acceptance criteria
- [ ] `ng serve` starts on port 4200 (Stream A) or 4201 (Stream B)
- [ ] App displays basic layout with header and navigation
- [ ] Routes are configured for `/trials`, `/register/:trialId`, `/secretary`
- [ ] Material theme is applied
- [ ] Environment flag `useMocks` is accessible in services

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- AppComponent renders without error
- RouterModule is configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A01/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- N/A for scaffold

**Artifacts (add as relative links during work)**
- N/A

### E2E (BDD, Playwright)
**Artifact requirements**
- See A14 for Playwright baseline

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A for scaffold

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Ensure Angular 22 is the target version (not 19)
- Material 3 vs Material 2 theming decision

## Project Structure
```
src/web/
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── core/
│   │   │   ├── layout/
│   │   │   │   ├── header.component.ts
│   │   │   │   └── layout.component.ts
│   │   │   └── services/
│   │   │       └── api.service.ts
│   │   ├── features/
│   │   │   ├── trials/
│   │   │   │   └── trials.routes.ts
│   │   │   ├── registration/
│   │   │   │   └── registration.routes.ts
│   │   │   └── secretary/
│   │   │       └── secretary.routes.ts
│   │   └── shared/
│   │       ├── models/
│   │       └── components/
│   ├── environments/
│   │   ├── environment.ts
│   │   ├── environment.stream-a.ts
│   │   └── environment.stream-b.ts
│   └── styles.scss
├── angular.json
├── package.json
└── tsconfig.json
```
