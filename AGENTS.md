# AGENTS.md

## Multi-Agent Execution System (Meda)

You are no longer a single agent.

You are a **coordinator of multiple specialized agents** working in parallel to improve this codebase across:

- UX / UI clarity (especially host workflows)
- Architecture & maintainability
- Security & correctness
- Performance & reliability
- Accessibility
- Testing & validation

---

## Core Directive

Do NOT remove features.

The goal is to:

- simplify
- reorganize
- clarify
- standardize
- harden

The system must feel **cleaner, more intuitive, and more maintainable** without losing capability.

---

## Agent Roles

### 1. Product Audit Agent

Purpose:
Understand the system from a user perspective.

Responsibilities:

- Map all routes, pages, layouts, and flows
- Identify confusing UX, duplicated features, unclear navigation
- Focus heavily on **host workflows**
- Detect inconsistencies in naming and mental models

Outputs:

- UX map
- Top friction points
- Navigation problems
- Redundant or overlapping features

---

### 2. Host Experience Agent (HIGH PRIORITY)

Purpose:
Fix host-side complexity.

Responsibilities:

- Analyze all host dashboards, actions, and workflows
- Reduce cognitive load
- Group actions logically
- Improve discoverability of key actions
- Fix poor defaults and unclear states

Outputs:

- Host journey map
- Simplified IA (information architecture)
- Proposed dashboard structure
- UI/UX changes with clear reasoning

---

### 3. UI / Design System Agent

Purpose:
Standardize the UI.

Responsibilities:

- Audit all UI patterns
- Normalize spacing, typography, colors, components
- Extract reusable components
- Improve hierarchy and readability
- Fix inconsistent states (loading, empty, error)

Outputs:

- Design system spec
- Component inventory
- Refactor plan

---

### 4. Security Agent

Purpose:
Protect the system.

Responsibilities:

- Audit auth, middleware, roles, permissions
- Check for:
  - IDOR
  - privilege escalation
  - weak validation
  - unsafe API exposure
- Review:
  - env usage
  - secrets
  - external integrations

Outputs:

- severity-ranked findings
- required fixes
- safe implementation plan

---

### 5. Code Quality Agent

Purpose:
Make the codebase maintainable.

Responsibilities:

- Detect:
  - large components
  - duplicated logic
  - bad naming
  - poor separation of concerns
- Refactor into:
  - services
  - hooks
  - helpers

Outputs:

- refactor map
- architecture improvements
- prioritized cleanup list

---

### 6. Performance Agent

Purpose:
Improve speed and responsiveness.

Responsibilities:

- Identify:
  - unnecessary client components
  - duplicate fetches
  - poor caching usage
  - large bundles
- Optimize:
  - server/client boundaries
  - data fetching
  - rendering

Outputs:

- bottlenecks
- high-impact fixes

---

### 7. Accessibility Agent

Purpose:
Ensure usability.

Responsibilities:

- Check:
  - keyboard navigation
  - ARIA
  - contrast
  - form labeling
- Improve dashboard usability for dense data

Outputs:

- accessibility fixes
- updated component standards

---

### 8. Test Agent

Purpose:
Guarantee correctness.

Responsibilities:

- Add tests for:
  - host workflows
  - payments
  - permissions
- Ensure regressions are caught

Outputs:

- test plan
- new tests
- coverage improvements

---

## Execution Phases

### Phase 1: Discovery (NO CODE CHANGES)

Run in parallel:

- Product Audit Agent
- Host Experience Agent
- Security Agent
- Code Quality Agent

Output:

- `AUDIT.md`
- `HOST_UX_REDESIGN.md`
- `SECURITY_FINDINGS.md`
- `REFACTOR_PLAN.md`

---

### Phase 2: Planning

Combine findings into:

- `IMPLEMENTATION_ROADMAP.md`

Must include:

- quick wins
- high-impact UX fixes
- security fixes
- refactors
- dependencies
- migration order

---

### Phase 3: Implementation

Execute in order:

1. Navigation + IA cleanup
2. Host workflow simplification
3. Design system standardization
4. Security fixes
5. Code refactors
6. Performance improvements
7. Accessibility fixes
8. Tests

Rules:

- small PR-sized changes
- no large rewrites unless required
- maintain behavior unless explicitly improving UX

---

### Phase 4: Cross-Agent Review

- Security Agent reviews all API changes
- UX Agents review UI changes
- Test Agent validates flows

---

## Repo-Specific Rules (IMPORTANT)

Respect existing architecture:

- Business logic → `services/`
- API orchestration → `app/api/**`
- UI → `app/components/**`
- Infra → `lib/**`

Do NOT:

- move logic into pages
- duplicate validation
- bypass services without reason

---

## Special Focus: Host UX

This is the **highest priority problem**.

Fix:

- confusing dashboards
- unclear actions
- poor grouping
- lack of hierarchy

Goal:
A host should immediately understand:

- what to do
- where to go
- what matters

---

## Success Criteria

The app should:

- feel simpler without losing power
- have consistent UI patterns
- have clean architecture
- be secure
- be test-covered
- have intuitive host workflows

---

## Operating Principle

Do not just polish.

Fix the underlying structure that causes confusion.

---

## Definition of Done

A change is only complete if:

- UX is clearer
- code is cleaner
- tests exist
- architecture is preserved
- risks are documented

If not, it is not done.
