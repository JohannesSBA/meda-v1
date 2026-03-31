# Meda Technical Audit And Agent Improvement Plan

Date: 2026-03-30

## Purpose
This document is a repo-grounded technical audit of Meda and a systematic execution plan for an agent to improve the application without destabilizing core product flows.

The goal is not to rewrite the product. The goal is to:

- reduce unnecessary complexity
- make the architecture easier to reason about
- improve safety around payments, tickets, payouts, and owner operations
- improve maintainability and testability
- give an agent a step-by-step plan with clear boundaries and validation gates

This audit is based on the current codebase state, including the newer booking-first flows, owner tools, group payments, host payouts, and the recent UI modernization work.

---

## 1. Current Snapshot

### 1.1 Stack
- Next.js 16.1.6 App Router
- React 19
- Prisma 7 + PostgreSQL
- Neon Auth
- Chapa for payments and transfers
- Supabase storage
- Resend email
- Upstash Redis / ratelimit
- Vitest + Playwright

### 1.2 Current script surface
From `package.json`:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:coverage`

### 1.3 App surface shape
The repo now contains both legacy event-first flows and newer booking-first flows.

Primary product surfaces:
- `/play`
- `/tickets`
- `/host`
- `/profile`
- `/admin`
- `/create-events`

Legacy compatibility surfaces still exist:
- `/events`
- `/slots`
- `/bookings`
- `/my-tickets`
- `/account/owner`

This is useful for compatibility, but it increases route and UX complexity.

### 1.4 Largest current hotspots by file size
These are strong indicators of maintenance risk and likely refactor targets:

| Lines | File |
| ---: | --- |
| 2048 | `app/components/owner/OwnerOperationsWorkspace.tsx` |
| 1929 | `services/bookings.ts` |
| 1222 | `app/components/bookings/SlotMarketplace.tsx` |
| 1199 | `app/components/tickets/TicketsHubWorkspace.tsx` |
| 1102 | `app/components/owner/OwnerDashboardWorkspace.tsx` |
| 1049 | `services/subscriptions.ts` |
| 1033 | `services/paymentPools.ts` |
| 1028 | `app/components/account/AccountWorkspace.tsx` |
| 1025 | `services/parties.ts` |
| 920 | `services/slots.ts` |
| 915 | `services/ownerAnalytics.ts` |
| 820 | `services/payments.ts` |
| 593 | `services/payouts.ts` |
| 584 | `app/components/create-event/CreateEventForm.tsx` |

Interpretation:
- UI monoliths are still a real problem.
- booking/payment/party/subscription services are carrying too many responsibilities.
- account/profile surfaces still remain larger than they should be.

### 1.5 Current automated coverage shape
Present:
- API tests for balance, event creation, registration, refunds, ticket verify, Chapa confirm
- service tests for event creation fee, events, facilitator, payments split, pitch-owner payout, refunds, promo codes, ticket sharing
- one payments concurrency integration test
- refund integration test
- e2e coverage for auth, payment status, profile actions, scan

Noticeable gaps:
- no dedicated e2e coverage for `/play`
- no dedicated e2e coverage for `/tickets`
- no dedicated e2e coverage for `/host`
- no dedicated e2e coverage for booking slots, group payments, dependents, claim links, host plan renewal, or owner payouts

### 1.6 Current verification state
At audit time:
- `npm run typecheck` passes
- recent targeted ESLint checks on modernized surfaces pass
- full repo lint and full test suite were not re-run as part of this audit pass

---

## 2. Executive Audit Summary

Meda has the right product capability set, but the codebase is now in a transitional state:

- the product is feature-rich
- the booking-first architecture exists
- UI simplification work has started
- but the codebase is carrying both legacy and modern flows at the same time

The biggest risks are:

1. oversized UI workspaces
2. service-layer over-concentration around booking/payment logic
3. inconsistent route and ownership boundaries
4. weak end-to-end coverage for money and ticket flows
5. lack of explicit operational observability around deadlines, refunds, and payouts

This does not require a rewrite.
It requires controlled decomposition, stronger contracts, and more disciplined test coverage.

---

## 3. Detailed Findings

## 3.1 Frontend architecture

### Finding
Several feature UIs are still implemented as monolithic client components.

Primary examples:
- `app/components/owner/OwnerOperationsWorkspace.tsx`
- `app/components/tickets/TicketsHubWorkspace.tsx`
- `app/components/bookings/SlotMarketplace.tsx`
- `app/components/owner/OwnerDashboardWorkspace.tsx`
- `app/components/account/AccountWorkspace.tsx`

### Impact
- harder to change without accidental regressions
- difficult to test in isolation
- hard to share sub-patterns across routes
- easier for local state to become inconsistent
- harder for an agent to work safely in parallel

### Recommendation
Split these into:
- route shell
- view model hook/loader
- section components
- reusable item cards
- reusable action panels

### Priority
High

---

## 3.2 Service-layer concentration

### Finding
Several business services have become large orchestration layers that combine:
- validation
- authorization assumptions
- persistence
- pricing
- state transitions
- notification side effects
- external payment side effects

Primary examples:
- `services/bookings.ts`
- `services/paymentPools.ts`
- `services/subscriptions.ts`
- `services/parties.ts`
- `services/payments.ts`
- `services/slots.ts`
- `services/ownerAnalytics.ts`

### Impact
- high blast radius for small changes
- difficult to test edge cases independently
- greater chance of state drift
- harder to introduce retries or idempotency safely

### Recommendation
Refactor service internals into smaller domain units without changing public API immediately.

Suggested sub-boundaries:
- booking creation
- booking state transition rules
- ticket generation
- price computation
- group contribution computation
- pool expiry
- refund issuance
- payout availability computation
- notification triggers

### Priority
High

---

## 3.3 Route sprawl and compatibility debt

### Finding
The app keeps both new IA routes and legacy aliases alive.

Examples:
- `/play` and `/slots`
- `/tickets`, `/bookings`, `/my-tickets`
- `/host` and `/account/owner`
- `/admin` plus historical admin functionality previously embedded in profile

### Impact
- duplicated mental models
- more redirect edge cases
- more route-level QA burden
- greater risk of stale links and partial UX drift

### Recommendation
Keep compatibility routes, but mark them as compatibility-only and systematically reduce direct internal use.

Concrete rule:
- primary app navigation and all internal CTA links must use canonical routes only
- aliases should remain as redirect shims only

### Priority
Medium

---

## 3.4 Mixed auth enforcement strategy

### Finding
Auth is enforced through a mix of:
- `middleware.ts`
- server page redirects
- route handler guards

`middleware.ts` currently protects:
- account
- profile
- create-events
- admin

But other sensitive flows rely on server-side redirect logic or route-level guard logic.

Also note:
- Next.js is warning that the `middleware` file convention is deprecated in favor of `proxy`

### Impact
- policy can drift between surface types
- harder to reason about role protection holistically
- future framework upgrade pressure

### Recommendation
Create a single route-protection matrix and migrate toward:
- thin framework entrypoint
- centralized role rules
- documented ownership of auth checks by route type

Also plan a dedicated migration from `middleware.ts` to the new Next.js `proxy` convention.

### Priority
High

---

## 3.5 UI system maturity

### Finding
The repo now has better shared primitives, but adoption is partial.

Good signs:
- new page header
- new section card
- shared inline banners
- overlay portal
- responsive action bar

Still inconsistent:
- some older pages still use older layout patterns
- responsive table strategy is not fully adopted
- advanced views still expose dense controls too early

### Impact
- UX feels more polished in some routes than others
- higher cognitive load for users
- harder for agents to follow one consistent page pattern

### Recommendation
Adopt a formal page composition standard:
- `AppPageHeader`
- `AppSectionCard`
- one primary action
- one secondary action strip
- optional advanced section
- responsive table-to-card fallback on phone

### Priority
Medium

---

## 3.6 Booking and payment state complexity

### Finding
The application now supports:
- daily bookings
- monthly full-pitch group bookings
- group contributions
- automatic expiry
- auto-refund to Meda balance
- ticket claiming
- dependent ticket management
- payout settlement

These are inherently stateful and money-sensitive.

### Impact
Without explicit state transition instrumentation and stronger tests, small regressions could cause:
- incorrect payout availability
- incorrect refund issuance
- stale ticket validity
- inaccurate group payment status
- owner/customer trust failures

### Recommendation
Treat these as explicit state machines and document the allowed transitions.

Mandatory audited state machines:
- booking status
- payment pool status
- contribution status
- ticket status
- subscription status
- payout status

### Priority
Critical

---

## 3.7 Test coverage risk

### Finding
Newer booking-first surfaces are under-tested end to end.

Especially missing:
- host plan start/renew/expire/grace flows
- slot creation through host UI
- daily booking from `/play`
- monthly group booking and contributions
- ticket assignment, dependent tickets, claim links
- QR visibility and scanning for booking tickets
- owner payout initiation based on current Meda balance

### Impact
The product can compile while still failing on real money/ticket flows.

### Recommendation
Make E2E coverage a first-class improvement phase, not a later nice-to-have.

### Priority
Critical

---

## 3.8 External integration risk

### Finding
Meda depends on real external services:
- Chapa
- Resend
- Supabase
- Upstash

These are not optional paths; they affect core value flows.

### Impact
- env misconfiguration can break core journeys
- sandbox vs production behavior can drift
- retries and callback reconciliation can become brittle

### Recommendation
Create explicit integration health checks and internal docs for:
- required env vars
- webhook expectations
- retry/idempotency rules
- failure fallbacks
- local development behavior

### Priority
High

---

## 3.9 Data and migration discipline

### Finding
The Prisma surface is evolving quickly and now includes:
- booking models
- pool payments
- payouts
- surcharges
- host subscriptions
- pitch location metadata

### Impact
- local databases will drift
- developers will see runtime failures if migrations are not applied
- generated client drift remains a recurring risk

### Recommendation
Add a standard change protocol:
- schema change
- migration
- prisma generate
- minimal smoke test
- release note entry

Also consider adding a startup/dev check that warns clearly when migrations are pending.

### Priority
Medium

---

## 3.10 Observability and operational clarity

### Finding
The application logs errors, but there is not yet a clearly defined product analytics and operational telemetry layer for critical user flows.

Missing or under-defined:
- conversion funnel tracking
- payment drop-off
- group expiry rates
- ticket assignment completion rate
- payout initiation rate
- host plan renewal funnel

### Impact
- hard to prioritize improvements with confidence
- hard to detect hidden UX friction
- harder to catch regressions before support tickets appear

### Recommendation
Add lightweight event tracking for critical product flows and align it with dashboarding.

### Priority
Medium

---

## 4. Architecture Improvement Goals

The target architecture should preserve current capability while making the codebase easier to operate and improve.

### 4.1 Desired frontend shape
- route shell
- page header
- page-specific data loader / hook
- section components
- item cards
- advanced details drawer or expandable section

### 4.2 Desired service shape
- thin route handlers
- service entrypoints
- internal domain modules
- explicit state transition helpers
- isolated notification emitters
- isolated pricing helpers
- isolated external gateway adapters

### 4.3 Desired verification shape
- typecheck must pass
- targeted lint must pass
- core service tests for changed domains
- E2E coverage for all money/ticket critical paths

---

## 5. Systematic Agent Execution Plan

This is the part another agent should follow directly.

## Phase 0 — Baseline and guardrails

### Goal
Freeze understanding before refactoring.

### Tasks
1. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
2. Record current failures separately as:
   - pre-existing
   - introduced by current branch
3. Create a route map:
   - canonical routes
   - compatibility aliases
   - protected routes
   - admin-only routes
4. Create a state map:
   - booking
   - ticket
   - contribution
   - pool
   - payout
   - subscription

### Output
- `docs/ROUTE_MATRIX.md`
- `docs/STATE_MACHINES.md`
- `docs/BASELINE_CHECKS.md`

### Exit criteria
- agent knows canonical vs compatibility routes
- agent knows all critical state transitions
- current validation baseline is documented

---

## Phase 1 — Frontend shell standardization

### Goal
Make all core routes follow one page composition pattern.

### Primary targets
- `app/play/*`
- `app/tickets/*`
- `app/host/*`
- `app/profile/*`
- `app/admin/*`
- `app/create-events/*`

### Tasks
1. Finish adoption of:
   - `AppPageHeader`
   - `AppSectionCard`
   - `ResponsiveActionBar`
   - `InlineStatusBanner`
   - `OverlayPortal`
2. Remove nested card-on-card layouts where unnecessary.
3. Ensure every page has:
   - one primary action
   - one clear summary description
   - one optional advanced/details area
4. Convert dense tables to responsive card layouts on phone.

### Output
- consistent shell across all main routes

### Exit criteria
- no critical page feels like a raw admin console
- phone layouts have no important horizontal scroll
- overlays always render to viewport, not local container

---

## Phase 2 — Decompose UI monoliths

### Goal
Break large client components into maintainable feature slices.

### Highest-priority files
- `app/components/owner/OwnerOperationsWorkspace.tsx`
- `app/components/tickets/TicketsHubWorkspace.tsx`
- `app/components/bookings/SlotMarketplace.tsx`
- `app/components/owner/OwnerDashboardWorkspace.tsx`
- `app/components/account/AccountWorkspace.tsx`

### Rules
- no new component should exceed ~350-450 lines unless strongly justified
- extract view-model mapping out of JSX files
- keep route shell thin

### Suggested decomposition example

`OwnerOperationsWorkspace.tsx`:
- `OwnerPlanCard`
- `PlaceEditorCard`
- `OpenDaysCard`
- `SlotEditorCard`
- `HostCalendarPanel`
- `HostCalendarDayDrawer`

`TicketsHubWorkspace.tsx`:
- `TicketsHeader`
- `TicketsSection`
- `BookingTicketCard`
- `EventTicketCard`
- `GroupPaymentPanel`
- `DependentTicketPanel`
- `QrTicketTile`

`SlotMarketplace.tsx`:
- `PlayHeader`
- `OfferFilterBar`
- `OfferCard`
- `OfferDaySelector`
- `OfferTimeSelector`
- `BookingSummaryPanel`
- `MonthlyGroupSetupPanel`
- `SlotMapModal`

### Exit criteria
- each major workspace split into focused components
- view-model logic extracted from rendering logic
- new changes can target one subcomponent safely

---

## Phase 3 — Service decomposition and state safety

### Goal
Reduce service blast radius and make money/ticket transitions safer.

### Primary targets
- `services/bookings.ts`
- `services/paymentPools.ts`
- `services/parties.ts`
- `services/subscriptions.ts`
- `services/payments.ts`
- `services/payouts.ts`

### Tasks
1. Extract pricing helpers:
   - daily booking pricing
   - monthly full-pitch pricing
   - surcharge computation
   - payout availability computation
2. Extract state transitions into explicit modules:
   - booking transitions
   - pool transitions
   - ticket transitions
   - subscription transitions
   - payout transitions
3. Separate side effects:
   - database mutation
   - email/notification sending
   - external provider calls
4. Add idempotency comments and tests around:
   - confirm endpoints
   - webhook endpoints
   - expiry jobs

### Exit criteria
- service files are smaller and domain-focused
- state transitions are explicit and documented
- webhook/confirm flows are easier to test independently

---

## Phase 4 — Route and auth cleanup

### Goal
Reduce route confusion and make protection strategy explicit.

### Tasks
1. Migrate internal links to canonical routes only.
2. Keep aliases as redirect-only compatibility shims.
3. Audit protection for:
   - `/host`
   - `/tickets`
   - `/admin`
   - `/create-events`
4. Plan migration from `middleware.ts` to Next.js `proxy`.
5. Document ownership:
   - framework entrypoint auth
   - server page redirects
   - API route guards

### Exit criteria
- route behavior is predictable
- auth enforcement is documented and less duplicated

---

## Phase 5 — Testing expansion

### Goal
Cover the booking-first business flows that matter most.

### New E2E scenarios to add
1. host activates plan
2. host creates place and pins map
3. host edits existing place map pin
4. host creates booking times
5. player books daily slot
6. player starts monthly group booking
7. group member pays share
8. unpaid group expires
9. paid shares auto-refund to Meda balance
10. purchaser assigns dependent ticket
11. purchaser creates claim link
12. recipient claims ticket
13. QR appears on valid ticket
14. host payout uses current Meda balance, not gross earnings

### New service/API test priorities
- payout availability math
- group contribution split math
- expiry and refund logic
- booking confirmation idempotency
- subscription grace-period transitions

### Exit criteria
- core money/ticket flows are covered end to end
- high-risk service math is tested directly

---

## Phase 6 — Observability and operational maturity

### Goal
Make product and operational issues visible early.

### Tasks
1. Add lightweight analytics events for:
   - play mode switch
   - slot booking started
   - slot booking completed
   - monthly group booking started
   - monthly group booking expired
   - ticket claimed
   - ticket assigned
   - host payout started
   - host plan renewed
2. Add structured logs around:
   - payment pool expiry
   - refund issuance
   - payout initiation
   - payout failure
   - webhook reconciliation
3. Define operational dashboards for:
   - payment failures
   - expiry volume
   - refund volume
   - payout latency

### Exit criteria
- operators can see where users fail
- agent changes can be measured

---

## 6. Agent Working Rules For This Repo

This is the protocol an implementation agent should follow.

### 6.1 Scope discipline
- one phase at a time
- one subsystem at a time
- no cross-cutting rewrites without a written migration note

### 6.2 Safe change boundaries
- keep business rules in `services/`
- keep route handlers thin
- use `lib/validations/**` for request parsing
- use `apply_patch` for manual edits
- do not rewrite Prisma schema unless the task explicitly requires it

### 6.3 Refactor rules
- do not change backend contracts and UI in the same step unless necessary
- add wrappers and adapters first
- move internals behind the same public API second
- remove dead code only after compatibility is verified

### 6.4 Verification rules
For every meaningful step:
1. `npm run typecheck`
2. targeted `eslint`
3. narrowest relevant service/API test
4. broader test only after targeted checks pass

### 6.5 Documentation rules
Every phase should update:
- what changed
- what was not changed
- what remains risky
- what should be tested manually

---

## 7. Recommended Backlog For An Agent

This is a practical execution queue.

### Critical
1. Document all booking/payment/ticket/payout state machines.
2. Add E2E for daily booking, monthly group booking, and expiry/refund.
3. Add E2E for host payout from current Meda balance.
4. Split `OwnerOperationsWorkspace.tsx`.
5. Split `TicketsHubWorkspace.tsx`.
6. Split `SlotMarketplace.tsx`.

### High
7. Decompose `services/bookings.ts`.
8. Decompose `services/paymentPools.ts`.
9. Decompose `services/subscriptions.ts`.
10. Create a canonical route matrix and remove internal alias links.
11. Plan `middleware.ts` to `proxy` migration.
12. Convert owner/admin dense tables to true phone card layouts.

### Medium
13. Split `OwnerDashboardWorkspace.tsx`.
14. Split `AccountWorkspace.tsx`.
15. Add integration health docs for Chapa, Resend, Supabase, Upstash.
16. Add route-level observability events.
17. Add startup/dev warning for pending Prisma migrations.

### Lower but worthwhile
18. Introduce tighter view-model types for play/tickets/host.
19. Add story-like visual review fixtures for key UI cards.
20. Write contributor docs for booking-first architecture.

---

## 8. Definition Of Done For The Improvement Program

The improvement effort is done when:

- core product routes use one consistent shell pattern
- large monolith components are split into focused subcomponents
- high-risk service files are decomposed into domain units
- booking/ticket/payment/payout state transitions are documented and tested
- all critical money/ticket flows have E2E coverage
- canonical routes are the only routes used in internal navigation
- auth strategy is documented and prepared for Next.js `proxy`
- operational dashboards exist for payment, expiry, refund, and payout health

---

## 9. Final Recommendation

Do not attempt one giant cleanup branch.

The correct approach is:
- stabilize and document first
- decompose the heaviest UI files second
- harden the money/ticket state machines third
- expand automated coverage fourth
- clean up route/auth/observability last

This repo is already capable. The next win is not more features. The next win is making the current feature set safer, calmer, and easier to maintain.
