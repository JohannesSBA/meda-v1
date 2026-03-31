# Meda Application Audit (Logical + Structural Inconsistencies)

**Date:** 2026-03-17  
**Scope:** Repository-wide architecture, RBAC, payments, profile/admin UX surfaces, and operational quality  
**Goal:** Provide a practical improvement document that can be used as an engineering execution plan.

---

## 1) Executive Summary

The application has made strong progress toward a marketplace model (pitch owners, facilitators, split payments, payout setup, promo-based creation fees), but the codebase now has **consistency drift** between:

- Auth role sources,
- Middleware vs route-level protection,
- Validation schemas vs supported domain roles,
- UI orchestration boundaries,
- Data-model semantics (capacity, payment references), and
- Operational defaults (E2E and runtime assumptions).

The biggest issues are not syntax-level defects; they are **cross-layer contract mismatches** that can create hidden bugs and make future changes expensive.

---

## 2) Top Logical Inconsistencies

## 2.1 Role system has multiple authorities (Neon role + derived app role)

### Observation
The app derives effective roles (`pitch_owner`, `facilitator`) from relational tables while also carrying the raw auth role from Neon. This is useful, but currently creates a dual-authority model without a hard contract.

### Why this is risky
- Different layers can make decisions using different role fields (`role` vs `authRole`).
- Edge/runtime code paths intentionally avoid full enrichment; behavior can differ by runtime context.
- Auditing authorization bugs is harder because identity is computed differently depending on path.

### Recommendation
- Formalize one **canonical role contract** for authorization checks (`session.user.role` after normalization).
- Restrict `authRole` to diagnostics/telemetry only.
- Add a shared `assertRoleContract()` helper used in auth and guards tests.

---

## 2.2 Middleware protection scope is narrower than product surface

### Observation
Middleware only matches `/account/:path*`, while key authenticated flows also live under `/profile`, `/create-events`, and admin pages that rely on route-level checks and UI redirects.

### Why this is risky
- Protection semantics differ by route family.
- Future pages can be accidentally exposed if a guard is forgotten.
- Security posture depends on manual discipline rather than centralized policy.

### Recommendation
- Expand middleware matcher or codify a route-protection matrix and enforce in integration tests.
- Keep server-side guard checks as defense-in-depth even after matcher expansion.

---

## 2.3 Admin role mutation schema is not aligned with full role model

### Observation
Admin role update validation still accepts only `admin | user`, while the system behavior and UX now include `pitch_owner` and `facilitator` via other flows.

### Why this is risky
- Admin tooling appears partially inconsistent (special route for pitch-owner promotion; no unified role policy).
- Leads to fragmented role lifecycle paths.

### Recommendation
- Decide explicit policy:
  - **Option A:** Keep role mutation intentionally limited and document “promotion flows only.”
  - **Option B:** Move to a single role management API with explicit transition rules.
- Whichever option is chosen, encode it in schema comments + admin UX copy.

---

## 2.4 Capacity semantics still act like mutable inventory

### Observation
`Event.capacity` is used in runtime availability logic and is decremented/incremented through purchase/refund flows rather than serving purely as immutable total capacity.

### Why this is risky
- Reporting and analytics ambiguity (is capacity total or remaining?).
- Complex recovery behavior for retries/refunds/concurrency.
- Hard to reason about when introducing reservations or waitlist automation.

### Recommendation
- Introduce clear inventory modeling:
  - `capacityTotal` (immutable),
  - `capacityRemaining` (derived or explicit),
  - optional reservation ledger.
- Migrate logic to one availability service and prevent direct ad-hoc updates.

---

## 2.5 Payment model naming drift (`telebirr_*` mapped for Chapa flows)

### Observation
Payment fields like `providerReference` and `checkoutUrl` map to legacy `telebirr_*` columns while the active integration is Chapa/balance.

### Why this is risky
- Confusing operational debugging and BI exports.
- Increases onboarding cost for new contributors.
- Makes provider abstraction weaker than it appears.

### Recommendation
- Run a naming-normalization migration plan:
  - new neutral columns (`provider_reference`, `checkout_url`) if needed,
  - backfill + compatibility layer,
  - remove legacy naming debt after transition window.

---

## 3) Top Structural Inconsistencies

## 3.1 Profile/dashboard orchestration remains heavy and coupled

### Observation
Profile data composition still spreads across large hook surfaces coordinating unrelated concerns (user tickets, saved events, admin users/events/stats/billing, pitch-owner tools).

### Why this is risky
- Increased regression likelihood during small feature updates.
- Hard to test and reason about state transitions.
- UI behavior is driven by many implicit side-effects.

### Recommendation
- Move to feature-scoped hooks:
  - `useRegisteredEvents`, `useSavedEvents`, `useAdminUsers`, `useAdminEvents`, `useAdminBilling`, `usePitchOwnerWorkspace`.
- Add React Query/TanStack Query (or equivalent) for request lifecycle standardization.

---

## 3.2 Mixed service boundaries (route handlers still do too much)

### Observation
Some routes are cleanly delegated to services, while others still blend validation, control-flow orchestration, and persistence details.

### Why this is risky
- Business rules get duplicated.
- Harder to test “pure behavior” separately from HTTP concerns.

### Recommendation
- Standard route contract:
  1) Parse + validate request,
  2) Call service command/query,
  3) Map typed result to response.
- Enforce this via contributor guideline + code review checklist.

---

## 3.3 Runtime-dependent auth behavior introduces implicit complexity

### Observation
Session enrichment dynamically imports role enrichment in non-edge runtime and uses normalized fallback in edge runtime.

### Why this is risky
- Different behavior in middleware/page/API contexts can cause subtle authorization mismatches.
- Hard to replicate exact conditions in tests.

### Recommendation
- Make runtime behavior explicit in docs and tests:
  - unit test edge normalization path,
  - unit test server enrichment path,
  - integration test protected endpoint behavior across both.

---

## 3.4 Documentation-to-code drift risk remains high

### Observation
Major product-model changes landed quickly across many slices. README/legal docs were updated, but long-term drift risk remains because implementation spans many domains.

### Why this is risky
- New contributors may implement against stale assumptions.
- Policy/compliance docs can become inaccurate.

### Recommendation
- Introduce `docs/architecture/adr-*` records for role model, payouts, split settlement, and event creation billing.
- Add “docs impact required?” checkbox in PR template.

---

## 4) Reliability & Testing Gaps

## 4.1 Gaps in cross-flow integration tests

### Observation
Focused unit and API tests exist, but there are still multi-step workflow risks (promotion -> payout setup -> fee payment -> event creation -> attendee checkout -> refund).

### Recommendation
- Add 3 high-value integration suites:
  1. **Pitch-owner happy path** end-to-end lifecycle,
  2. **Payout incomplete block path** (event creation and checkout constraints),
  3. **Role transition path** (user -> pitch_owner, facilitator scope checks).

---

## 4.2 Need invariant tests for role consistency

### Recommendation
Add tests that enforce:
- `role` must always be one of app roles,
- `facilitator` implies `parentPitchOwnerUserId != null`,
- `pitch_owner` implies `parentPitchOwnerUserId == null`,
- Authorization helpers reject malformed role payloads.

---

## 5) Security & Compliance Notes

## 5.1 Payout encryption lifecycle needs operational runbook

### Observation
Encryption exists for payout fields, but key rotation and break-glass processes should be formalized.

### Recommendation
- Add operational runbook:
  - rotation procedure,
  - re-encryption strategy,
  - incident response for key compromise,
  - access audit cadence.

---

## 5.2 Auditability of financial state changes

### Observation
There is logging and status tracking, but a unified immutable financial audit trail is still recommended for settlement disputes.

### Recommendation
- Add append-only audit table for payment state transitions and split calculations.
- Include actor/system source and idempotency key on each transition.

---

## 6) Prioritized Improvement Backlog

## P0 (Immediate: 1–2 sprints)
1. Define canonical role contract and enforce with tests.
2. Align middleware protection strategy with real authenticated surface.
3. Clarify/admin-role lifecycle policy (`admin|user` only vs full role transitions).
4. Add integration tests for pitch-owner lifecycle and payout/checkout gating.

## P1 (Near-term: 2–4 sprints)
1. Refactor profile/admin client orchestration into feature hooks + shared data layer.
2. Normalize payment field naming debt and add migration plan.
3. Introduce ADR docs for marketplace architecture decisions.

## P2 (Medium-term)
1. Redesign inventory model (`capacityTotal` + reservations).
2. Add immutable financial transition ledger.
3. Strengthen observability dashboards for payout/split anomalies.

---

## 7) Suggested Success Metrics

- **Auth correctness:** 0 role-related authorization regressions across regression suite.
- **Operational clarity:** time-to-diagnose payment incident reduced by 50%.
- **Maintainability:** profile/admin modules reduced in average file size/complexity (LOC and cyclomatic metrics).
- **Consistency:** architecture docs updated in same PR for all product-model changes.

---

## 8) Conclusion

The application is feature-rich and moving in the right direction, but its main risk is now **consistency debt across boundaries** (auth, routing, model semantics, and orchestration). Addressing the P0/P1 items above will materially improve reliability, contributor velocity, and long-term correctness.
