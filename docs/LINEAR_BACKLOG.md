# Linear Backlog

Purpose: a Linear-ready backlog derived from the repository audit, architecture scan, and recent debugging work. Each item is phrased to be copyable into a Linear issue with minimal cleanup.

---

## P0

### 1. Define and enforce a canonical application role contract

- Type: `tech-debt`
- Area: `auth`
- Problem: the effective user role is derived from both Neon auth state and DB-backed marketplace relationships, which makes authorization behavior harder to reason about.
- Scope:
  - define the canonical authorization field to use everywhere
  - document when `authRole` is informational only
  - add invariant tests for malformed or inconsistent role payloads
- Acceptance criteria:
  - authorization helpers rely on one normalized role contract
  - tests cover admin, user, pitch owner, and facilitator behavior
  - edge and server runtime behavior are both explicitly tested
- Verification:
  - targeted auth tests
  - `npm test`

### 2. Align middleware protection with the actual authenticated surface

- Type: `bug`
- Area: `auth`
- Problem: authenticated flows span `/profile`, `/create-events`, `/admin`, and related routes, but protection semantics have drifted between middleware and route-level checks.
- Scope:
  - define the intended protection matrix
  - ensure middleware and route guards cover the same surface
  - preserve redirect and E2E bypass behavior
- Acceptance criteria:
  - protected routes behave consistently for authenticated and unauthenticated users
  - redirect behavior is explicit and test-covered
  - E2E auth bypass still works in non-production test runs
- Verification:
  - relevant unit tests
  - `npm run test:e2e`

### 3. Decide and encode the role transition policy in admin flows

- Type: `tech-debt`
- Area: `admin`
- Problem: admin-facing role mutation rules do not cleanly match the real marketplace role model.
- Scope:
  - choose whether admin role APIs remain limited to base auth roles or become the canonical role transition surface
  - align schemas, route semantics, and UI copy with that policy
- Acceptance criteria:
  - the allowed role transitions are documented and enforced
  - admin APIs and UI no longer imply contradictory role behavior
  - tests cover permitted and forbidden transitions
- Verification:
  - targeted admin route tests
  - `npm test`

### 4. Add a high-value integration lifecycle for pitch-owner commerce

- Type: `testing`
- Area: `payments`
- Problem: core marketplace behavior spans promotion, payout setup, event creation, checkout, and refund, but the repo lacks one end-to-end confidence path across those boundaries.
- Scope:
  - add an integration flow covering pitch-owner onboarding through ticket purchase and refund
  - include at least one negative path for incomplete payout setup
- Acceptance criteria:
  - the lifecycle can be exercised in tests without manual setup drift
  - key permission and settlement assumptions are asserted
- Verification:
  - `npm run test:integration`

## P1

### 5. Clarify event inventory semantics instead of overloading `capacity`

- Type: `tech-debt`
- Area: `events`
- Problem: `Event.capacity` behaves like mutable remaining inventory in some flows, which makes reporting and concurrency reasoning harder.
- Scope:
  - define whether capacity is total, remaining, or derived
  - align availability logic and mutation paths with that definition
  - add migration follow-up if the chosen model needs schema support
- Acceptance criteria:
  - the meaning of capacity is unambiguous in code and tests
  - purchase, refund, and availability logic use the same semantics
- Verification:
  - targeted service tests
  - `npm test`

### 6. Normalize payment field naming away from legacy provider terminology

- Type: `tech-debt`
- Area: `payments`
- Problem: payment fields still map through legacy `telebirr_*` column names while the app now runs Chapa and balance flows.
- Scope:
  - define a migration path to provider-neutral naming
  - preserve backward compatibility during the transition
  - update code references and any operational docs
- Acceptance criteria:
  - the domain model reads as provider-neutral
  - code and schema no longer imply the wrong payment provider
- Verification:
  - targeted payment tests
  - `npm run build`

### 7. Decompose profile dashboard state into feature-scoped hooks

- Type: `refactor`
- Area: `profile`
- Problem: profile/dashboard orchestration is broad and mixes registered events, saved events, admin controls, billing, and pitch-owner tooling.
- Scope:
  - split large hook surfaces into smaller feature-scoped hooks
  - preserve existing UI behavior and tab semantics
  - avoid introducing a broad state-management rewrite
- Acceptance criteria:
  - feature hooks have narrower ownership boundaries
  - loading, error, and refresh behavior still matches current UX
  - the refactor reduces coupling without changing product behavior
- Verification:
  - targeted component tests where feasible
  - `npm run test:e2e`

### 8. Standardize route-to-service boundaries in profile and admin APIs

- Type: `refactor`
- Area: `admin`
- Problem: some routes delegate to `services/*`, while others still combine parsing, data access, and business logic directly in route handlers.
- Scope:
  - identify profile and admin routes with meaningful business logic still embedded at the boundary
  - move only non-trivial logic into services
  - keep simple read-only routes simple when abstraction adds no value
- Acceptance criteria:
  - route handlers are consistently thin where domain rules are involved
  - business logic is easier to test without HTTP setup
- Verification:
  - relevant unit tests
  - `npm test`

### 9. Split dense public-event read logic into documented sub-responsibilities

- Type: `tech-debt`
- Area: `events`
- Problem: `services/publicEvents.ts` is a concentration point for filtering, grouping, caching, availability, and serialization.
- Scope:
  - do not split for style alone
  - document the intended responsibility boundaries first
  - extract only the most stable seams if it materially improves testability or readability
- Acceptance criteria:
  - the service has an explicit internal structure or companion documentation
  - future contributors can identify where to change filtering, grouping, or serialization behavior
- Verification:
  - targeted public event tests
  - `npm test`

### 10. Fix environment and dependency drift that can surprise contributors

- Type: `bug`
- Area: `docs`
- Problem: there are signs of operational drift, including a suspicious default Supabase bucket name and implicit reliance on undeclared transitive packages.
- Scope:
  - verify and correct the default bucket behavior in `lib/supabaseAdmin.ts`
  - add direct dependencies where the app imports packages directly
  - update docs where current setup instructions are misleading
- Acceptance criteria:
  - runtime defaults match documented intent
  - direct imports are declared in `package.json`
  - local setup friction is reduced
- Verification:
  - `npm run lint`
  - `npm run typecheck`
  - targeted smoke verification

## P2

### 11. Add an operational runbook for payout encryption and key rotation

- Type: `docs`
- Area: `payments`
- Problem: payout encryption exists in code, but the repo does not clearly document rotation, re-encryption, or incident handling.
- Scope:
  - write a runbook for key rotation, re-encryption strategy, and break-glass access
  - document what must be audited after an incident
- Acceptance criteria:
  - the runbook explains who rotates keys, what data is affected, and how success is verified
  - operational steps are explicit enough for on-call use
- Verification:
  - doc review

### 12. Introduce financial state-transition auditability for disputes

- Type: `tech-debt`
- Area: `payments`
- Problem: settlement and refund behavior is spread across payment status fields and logs, but there is no single append-only audit trail for financial transitions.
- Scope:
  - design an immutable audit record for payment and refund state transitions
  - include actor or system source and idempotency context
  - avoid changing user-visible behavior in the first pass
- Acceptance criteria:
  - there is a documented audit model and implementation plan
  - new financial transitions can be traced without reconstructing state from scattered logs
- Verification:
  - design review
  - targeted tests if implementation lands

### 13. Add ADR-style architecture docs for the highest-friction decisions

- Type: `docs`
- Area: `docs`
- Problem: major decisions around role derivation, payouts, split settlement, and event-creation billing are implemented across many files but not captured as compact architecture records.
- Scope:
  - write ADRs for role model, payout/split settlement, and event-creation fee flow
  - keep them short and tied to concrete code paths
- Acceptance criteria:
  - contributors can find one source of truth for the key architectural decisions
  - future changes can reference the relevant ADR instead of reverse-engineering behavior
- Verification:
  - doc review

### 14. Create a repo-level docs impact checklist for architecture-sensitive changes

- Type: `docs`
- Area: `docs`
- Problem: the README and audit material are detailed, which increases drift risk when architecture changes land quickly.
- Scope:
  - define which changes require docs review
  - add a lightweight checklist for PRs or issue completion notes
- Acceptance criteria:
  - contributors have a simple rule for when docs must be updated
  - architecture-sensitive work leaves fewer stale explanations behind
- Verification:
  - doc review
