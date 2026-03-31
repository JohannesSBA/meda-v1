# Upcoming Features And Services

Date: 2026-03-31

## Purpose

This document captures the next product features Meda should prioritize based on the current codebase shape, business logic, and marketplace model.

It is not a promise that every item ships as written.
It is a repo-grounded roadmap proposal meant to guide implementation, service boundaries, and backlog planning.

---

## Current Product Strengths

Meda already has a strong operational core for:

- event discovery and filtering
- free and paid ticketing
- refunds to Meda balance
- ticket sharing and claim flows
- check-in scanning
- waitlists
- recurring events
- pitch-owner payouts
- host subscriptions
- booking slots and group payment flows

The next wave should focus less on raw transaction plumbing and more on:

- fill rate
- repeat usage
- trust and quality signals
- captain and host workflow efficiency
- measurable marketplace retention

---

## Product Direction

The most valuable roadmap theme for Meda is:

1. Fill more events that are already being created
2. Help users come back without manual outreach
3. Make hosts and players easier to trust
4. Reduce no-shows and last-minute roster chaos

The recommended delivery order is:

1. paid waitlist auto-conversion
2. host ratings and trust signals
3. follows and saved-search alerts
4. squad templates and recurring roster tools
5. reliability scoring and attendance controls
6. referrals and player credits

---

## Priority Roadmap

### 1. Paid Waitlist Auto-Conversion

### Problem

Meda already supports waitlists, but the current automatic promotion flow only works for free events.
For paid events, a newly opened spot still requires manual user action and loses urgency.

### User and Business Value

- improves conversion on sold-out events
- recovers revenue from cancellations and expired reservations
- reduces host/admin manual coordination

### Proposed Experience

- when a paid spot opens, the next waitlisted user gets a timed purchase window
- Meda reserves one seat for that user for a short period, such as 10 to 15 minutes
- the user receives an in-app and email call-to-action with a checkout link
- if they do not complete payment, the offer expires and rolls to the next person

### Proposed Services

- `services/paidWaitlistOffers.ts`
  - create offers
  - expire offers
  - promote next eligible user
- `services/waitlistCheckout.ts`
  - validate an active offer before payment
  - connect reserved inventory with existing payment flows

### Notes

- should reuse existing payment hold and availability rules where possible
- should keep route handlers thin and let services own the state machine
- likely needs explicit expiry handling via cron or reservation reconciliation

---

### 2. Host Ratings And Trust Signals

### Problem

The product copy already implies host trust matters, but the platform does not currently expose a real review or rating system.

### User and Business Value

- helps players choose between similar matches
- rewards reliable hosts
- gives Meda a trust layer that improves conversion, not just moderation

### Proposed Experience

- only checked-in attendees can leave a rating and short review
- event cards and host pages show aggregate score and review count
- repeat issues such as poor organization or inaccurate listings become visible

### Proposed Services

- `services/hostReviews.ts`
  - create review
  - enforce eligibility rules
  - aggregate rating summary
- `services/trustScore.ts`
  - derive host trust metrics from ratings, attendance quality, refund behavior, and cancellation behavior

### Notes

- ratings should be post-event only
- a first pass can avoid public free-form comments if moderation cost is a concern
- aggregated summary data should be cached for listing pages

---

### 3. Follows And Saved-Search Alerts

### Problem

Meda has saved events and reminder emails, but it does not yet convert passive interest into repeat demand.

### User and Business Value

- increases return visits
- helps new events reach the right audience faster
- gives recurring hosts a native audience channel inside Meda

### Proposed Experience

- users can follow hosts
- users can follow pitches or venues
- users can save a search such as weekday evening football near a location within a price range
- Meda sends alerts when new events match those preferences

### Proposed Services

- `services/follows.ts`
  - follow and unfollow hosts or venues
- `services/discoveryAlerts.ts`
  - evaluate new or updated events against saved-search criteria
  - send digest or immediate notifications

### Notes

- this should reuse the existing email and notification infrastructure
- event publication and recurring occurrence generation should trigger alert evaluation
- alert frequency controls matter to prevent spam

---

### 4. Squad Templates And Recurring Roster Management

### Problem

Captains and organizers often bring the same group back week after week, but the current product optimizes ticketing more than roster reuse.

### User and Business Value

- makes weekly football coordination faster
- improves repeat booking for recurring groups
- reduces roster drop-off for monthly or repeat sessions

### Proposed Experience

- save a squad template with player names, emails, and preferred roles
- reopen the same roster for a future event or booking slot
- invite the same people with one action
- track who confirmed, who paid, and which slots need replacement

### Proposed Services

- `services/squadTemplates.ts`
  - save, update, and load reusable squads
- `services/rosterInvites.ts`
  - send and manage recurring invites
  - map acceptance and payment state back to the roster

### Notes

- this should build on existing party, ticket assignment, and sharing concepts rather than introduce a separate parallel model
- captain workflows should stay compatible with both event tickets and slot-booking products

---

### 5. Reliability Scoring And Attendance Controls

### Problem

The platform tracks bookings, shares, refunds, and check-ins, but it does not yet turn that data into behavior-aware controls.

### User and Business Value

- reduces no-shows
- protects hosts from repeated abuse
- creates better incentives for reliable participation

### Proposed Experience

- internal reliability score for players and hosts
- flags for repeated late cancellations or no-shows
- optional host policies such as manual approval, limited advance holds, or stricter refund eligibility for repeat offenders

### Proposed Services

- `services/reliability.ts`
  - compute and update reliability signals
  - expose summaries for admin and host tooling
- `services/attendancePolicies.ts`
  - apply policy decisions to booking and ticket flows

### Notes

- the first release can keep scoring internal or host-visible only
- scoring should remain explainable; opaque punishment systems will create support burden

---

### 6. Referrals And Player Credits

### Problem

Meda already has a usable balance system, but it is mostly powered by refunds rather than intentional growth incentives.

### User and Business Value

- improves new-user acquisition
- creates a reason to bring teammates onto the platform
- helps fill low-demand sessions with targeted credits

### Proposed Experience

- referral code for invited friends
- reward only after the invited user completes a real booking
- optional off-peak or first-booking credits applied to Meda balance

### Proposed Services

- `services/referrals.ts`
  - create referral relationships
  - confirm reward eligibility
- `services/credits.ts`
  - issue and reconcile user credits into Meda balance with auditability

### Notes

- abuse prevention matters more than launch speed here
- referral rewards should be idempotent and easy to audit

---

## Recommended Service Boundaries

The current codebase already has strong service-layer usage.
Upcoming features should continue that pattern and avoid pushing business rules into route handlers or client components.

Recommended additions:

- `services/paidWaitlistOffers.ts`
- `services/waitlistCheckout.ts`
- `services/hostReviews.ts`
- `services/trustScore.ts`
- `services/follows.ts`
- `services/discoveryAlerts.ts`
- `services/squadTemplates.ts`
- `services/rosterInvites.ts`
- `services/reliability.ts`
- `services/attendancePolicies.ts`
- `services/referrals.ts`
- `services/credits.ts`

Service design rules:

- route handlers should authenticate, validate input, call services, and map errors
- services should own eligibility, state transitions, and side effects
- notification delivery should continue to go through the existing email and action-notification layers
- external providers should remain behind existing adapters and fail safely when env is missing

---

## Delivery Guidance

### Phase 1

- paid waitlist auto-conversion
- host ratings and trust summary

Reason:
These are the strongest immediate wins for conversion and trust.

### Phase 2

- follows and saved-search alerts
- squad templates and recurring roster tools

Reason:
These improve retention and repeat usage once the marketplace trust layer is stronger.

### Phase 3

- reliability scoring
- referrals and player credits

Reason:
These require more policy decisions, support planning, and abuse controls.

---

## Architecture Constraints For Future Work

When implementing any item in this roadmap:

- keep non-trivial domain logic in `services/`
- keep API routes thin
- reuse centralized Zod validation
- preserve revalidation and cache-tag patterns on mutations
- treat payments, payouts, refunds, and auth as high-risk surfaces
- prefer incremental rollout over broad rewrites

---

## Suggested Follow-Up Docs

Before implementation begins for any roadmap item, create one short design note covering:

- problem statement
- affected models and APIs
- service ownership
- permission rules
- failure modes
- test plan
- rollout and monitoring notes
