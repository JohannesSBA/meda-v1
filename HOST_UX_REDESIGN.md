# HOST_UX_REDESIGN.md

## Objective

Rewrite the Meda host dashboard **information architecture** so hosts can immediately understand:

- what is happening
- what they need to do next
- where each responsibility lives
- how to complete common tasks without confusion

This is an **IA rewrite**, not just a visual refresh.

**Constraints:** See root `AGENTS.md` — **do not remove features**; simplify, reorganize, clarify. The goal is to preserve all host functionality while making the system feel **simpler, cleaner, and easier to operate**.

---

## Core problems to solve

Current host-facing UX likely suffers from one or more of these issues:

1. Too many scattered entry points
2. Actions duplicated across multiple pages
3. Weak separation between:
   - event setup
   - bookings / attendees
   - payouts
   - analytics
   - settings
4. Host pages probably mix:
   - operational actions
   - passive reporting
   - account configuration
5. Unclear hierarchy causes users to ask:
   - where do I create/edit/manage something?
   - where do I see who booked?
   - where do I handle money?
   - where do I manage my staff/facilitators?

**Meda-specific snapshot (discovery):** Today much of this is concentrated on **`/host?view=…`** with two large client workspaces (operations vs reporting), plus **Profile** payout settings, **`/create-events`** for classic event creation, and **slot/places** flows that parallel “events.” That split is exactly what this IA is meant to replace with **clear ownership** per sidebar area.

---

## IA principles

1. **One section = one job** — Each primary sidebar item must answer **one** host question.
2. **No duplicate actions** — A host should only have **one obvious place** to do each core task.
3. **Overview is not a dumping ground** — Overview should **summarize and route**, not become a second operations dashboard.
4. **Insights and actions must be separated** — Analytics pages explain performance; operational pages let hosts **do work**.
5. **Detail pages should deepen, not branch unpredictably** — List → detail → focused sub-actions.
6. **Every host page should support fast scanning** — Dense data needs strong hierarchy, status chips, action grouping, and clear empty states.

---

## New host navigation model — primary sidebar

Recommended **final IA** (single source of truth for top-level host nav):

1. **Overview**
2. **Events**
3. **Bookings**
4. **Team**
5. **Payouts**
6. **Analytics**
7. **Settings**

---

## 1. Overview

### Purpose

Answer: **“What needs my attention right now?”**

### What belongs here

- **KPI summary**
  - upcoming events
  - active bookings
  - pending refunds
  - available payout balance
  - today / week revenue
- **Alerts / operational issues**
  - unpublished draft events
  - events with low capacity sold
  - payout account incomplete
  - check-in issues
- **Quick actions**
  - create event
  - review bookings
  - invite facilitator
  - view payout status
- **Upcoming event cards**
- **Recent activity feed**

### What does NOT belong here

- full analytics dashboards
- full event editing
- full settings forms
- full attendee tables

### Overview layout

- **Top row:** key KPI cards
- **Middle left:** upcoming events
- **Middle right:** action center / alerts
- **Bottom:** recent activity

### Main user outcome

The host lands here and immediately sees **what is performing**, **what needs attention**, and **what action to take next**.

---

## 2. Events

### Purpose

Answer: **“What am I hosting, and how do I manage it?”**

### What belongs here

- event list
- create event
- edit event
- duplicate event
- publish / unpublish
- cancel event
- archive event
- event details
- event performance summary **at the event level**
- event schedule / slot info (including pitch / bookable windows where the product uses slots)
- event pricing / ticket configuration
- refund policy for the event
- host-facing event preview

### Suggested subpages

- `/host/events`
- `/host/events/new`
- `/host/events/[eventId]`
- `/host/events/[eventId]/edit`

### Events list page sections

- **filters:** status, date, category, venue / pitch
- **columns:** event name, status, date/time, sold / capacity, revenue, quick actions

### Event detail page tabs

Inside an individual event page, use **tabs** so hosts do not jump between unrelated top-level pages for event-specific work:

- **Summary**
- **Setup**
- **Tickets**
- **Attendees**
- **Check-in**
- **Performance**

### Event detail tab responsibilities

#### Summary

- high-level event snapshot
- status, sales, attendance
- payout estimate
- main alerts

#### Setup

- title, description, images
- venue / pitch
- date/time
- category
- rules / notes

#### Tickets

- ticket types, pricing, sales windows
- capacity
- refund settings
- sharing eligibility

#### Attendees

- event-specific attendee list
- booking status
- transferred tickets
- refund state

#### Check-in

- scanner status
- recent check-ins
- manual verification flow

#### Performance

- event-level sales trend
- attendance completion
- conversion metrics

### What does NOT belong in Events

- global payout account setup
- facilitator org-wide management
- cross-event analytics dashboards

---

## 3. Bookings

### Purpose

Answer: **“Who booked, what is their status, and what needs handling?”**

### Why this must be separate

Hosts think differently about **creating/managing events** vs **dealing with customers and tickets**. These should not be mixed.

### What belongs here

- all bookings across events
- attendee/customer list
- payment status
- refunds
- transfers / shared tickets
- booking issues
- check-in state
- support actions

### Suggested subpages

- `/host/bookings`
- `/host/bookings/[bookingId]`

### Bookings list filters

- event
- date range
- paid / pending / refunded
- checked in / not checked in
- transferred / shared
- refund requested

### Booking detail page

Should include:

- customer identity
- event
- ticket type
- payment status
- transfer history
- refund history
- check-in status
- notes / support audit trail if applicable

### Bulk actions

- export filtered list
- mark refund reviewed
- resend ticket
- verify attendee manually where allowed

### What does NOT belong here

- event content editing
- org settings
- global analytics dashboard

---

## 4. Team

### Purpose

Answer: **“Who helps me operate events?”**

Especially important for facilitator / check-in models.

### What belongs here

- facilitators
- staff roles
- invite team member
- resend invite
- deactivate access
- assign event access
- permissions visibility
- activity history if available

### Suggested subpages

- `/host/team`
- `/host/team/[memberId]`

### Team page sections

- active team members
- pending invites
- role legend
- recent team activity

### Roles to support (minimum)

- Owner
- Manager
- Facilitator / Scanner

### Important UX rule

Permissions should be expressed in **plain language**, not system language.

- **Bad:** `CAN_MANAGE_EVENT_MUTATIONS`
- **Good:** Can edit events · Can scan tickets · Can view bookings · Cannot manage payouts

---

## 5. Payouts

### Purpose

Answer: **“What money is owed to me, and what is happening with it?”**

### What belongs here

- available balance
- pending balance
- payout history
- payout account status
- payout method setup
- payout issues / holds
- estimated future payouts
- payout exports

### Suggested subpages

- `/host/payouts`
- `/host/payouts/history`
- `/host/payouts/settings`

### Page sections

- **summary cards:** available, pending, last payout, next payout estimate
- payout history table
- payout account health
- action banner if configuration incomplete

### What does NOT belong here

- revenue charts beyond payout-specific summaries
- event editing
- user profile preferences unrelated to money

### UX priority

Money pages must feel **calm and trustworthy**. Use clear statuses, e.g.:

- Available · Pending · In review · Failed · Paid out

---

## 6. Analytics

### Purpose

Answer: **“How is my business performing?”**

### What belongs here

- revenue trends
- attendance rate
- sell-through rate
- refund rate
- repeat attendee metrics
- host performance over time
- top-performing events
- day/time performance
- venue utilization if relevant

### Suggested subpages

- `/host/analytics`
- `/host/analytics/events`
- `/host/analytics/audience`
- `/host/analytics/revenue`

### Analytics dashboard sections

- headline KPIs
- time-series revenue
- event performance ranking
- attendance funnel
- refund / operational quality indicators

### UX rule

Analytics pages are for **interpretation**, not heavy operations. Link out to action pages (e.g. “Low sell-through on Event A” → event detail). Do **not** embed full event editors inside analytics.

---

## 7. Settings

### Purpose

Answer: **“How is my host account configured?”**

### What belongs here

- host profile
- organization / pitch profile
- branding
- notification preferences
- payout account settings **if** not fully owned by Payouts (otherwise link clearly)
- legal / tax info if applicable
- integrations if applicable

### Suggested subpages

- `/host/settings/profile`
- `/host/settings/organization`
- `/host/settings/notifications`

### UX rule

Settings should be **calm, form-based, and stable**. Do not hide operational workflows here.

---

## Recommended route architecture

### Top-level host routes

```txt
/host
/host/events
/host/events/new
/host/events/[eventId]
/host/events/[eventId]/edit
/host/bookings
/host/bookings/[bookingId]
/host/team
/host/team/[memberId]
/host/payouts
/host/payouts/history
/host/payouts/settings
/host/analytics
/host/analytics/events
/host/analytics/audience
/host/analytics/revenue
/host/settings/profile
/host/settings/organization
/host/settings/notifications
```

**Implementation note:** `/host` alone should load **Overview**; deeper routes map to the sections above. Subscription / host-plan entitlement can live under **Settings** and/or **Payouts** depending on billing model—pick one primary home and cross-link.

---

## Global navigation and duplicate CTAs (cross-cutting)

- **One obvious primary** for each task: e.g. “Create event” should not compete with three other buttons in header, profile, and footer without labels.
- **Glossary:** align marketing copy (“Create a match”) with host IA (“Events,” “Bookings”) so public and authenticated vocabulary match.
- **Facilitators:** if Team is the home for facilitator management, global nav does not need a separate item—but **Team** must be discoverable from Overview quick actions.

---

## Success metrics

- Host task tests (time + misclicks): create event, find booking, handle refund, export, invite facilitator, complete payout setup.
- Support volume on “where is X?” drops.
- Stable URLs for support docs (no hash-only anchors for primary sections).

---

## Non-goals (for this redesign document)

- Removing slots, classic events, or booking models.
- Merging Admin into Host.
- Changing payment providers.

---

## Appendix — mapping from current Meda host UI (migration lens)

| Current concept | Target IA home |
|-----------------|----------------|
| `/host?view=overview` + KPI / attention cards | **Overview** |
| `/host` calendar / places / slots (`OwnerOperationsWorkspace`) | Primarily **Events** (Setup + schedule/slot/venue) unless product splits “inventory” as its own sidebar item later |
| `/host?view=bookings` / people / money / settings (`OwnerDashboardWorkspace`) | **Bookings**, **Analytics**, **Payouts**, **Settings** (split by job; no single “dashboard mode”) |
| `/create-events` | Routed from **Events** (`/host/events/new`) while preserving legacy URL via redirect |
| Profile payout tab | **Payouts** or **Settings** — **one** canonical place + link |
| Facilitator APIs | **Team** |

This appendix is for **engineering alignment** only; the canonical IA is the sections above.
