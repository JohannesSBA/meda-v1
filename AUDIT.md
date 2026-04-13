# Meda — Phase 1 Product & Architecture Audit

**Scope:** Discovery only (no code changes). Sources: `AGENTS.md`, `plan.md`, repository structure, representative files under `app/`, `lib/`, `services/`, `app/api/`.

**Opinionated thesis:** The product has **outgrown a single mental model**. “Host,” “profile,” “tickets,” “play,” “slots,” “bookings,” and “create match” coexist as **parallel entry points** to overlapping concerns. Navigation is **partially centralized** (`lib/navigation.ts`) but **behavior is fragmented** across giant client components and parallel API trees. The result is not merely “inconsistent styling”—it is **cognitive load** for hosts who must learn *where* Meda put a feature, not *what* the feature does.

---

## 1. Route & information architecture map

### 1.1 Canonical surfaces

| Surface | URL | Primary actor | Notes |
|--------|-----|----------------|-------|
| Play | `/play` | Player / browse | Discovery; not middleware-gated at edge |
| Tickets hub | `/tickets` | Authenticated user | Redirect to sign-in from page |
| Host | `/host?view=…` | `pitch_owner` only | Single URL; **seven** tab-like views via query string |
| Profile | `/profile` | Any authenticated user | Tabs: registered events, saved, payout (owners), admin callouts |
| Account | `/account/[path]` | Neon account UI + `AccountWorkspace` for some paths | Settings/security split |
| Admin | `/admin`, `/admin/events/[id]/edit` | `admin` | Middleware-protected |
| Create match (legacy naming) | `/create-events`, `/create-events/status` | Admin or pitch owner | Chapa-backed creation fee path for owners |

### 1.2 Legacy and redirect debt

- `/bookings` → **`/tickets`** (user “my bookings” language collapsed into tickets hub).
- `/my-events` → **`/tickets`** (name promised “events”; product now says “tickets”).
- `/account/owner` → **`/host`**
- `/account/owner/dashboard` → **`/host#host-reports`** (hash-based; fragile for analytics and support docs).

**Finding:** Redirects **paper over** renamed concepts without updating **every** nav label, footer link, and in-app copy. Users hitting old bookmarks see correct URLs but **internal language** (“Create match,” “Play,” “Host”) still mixes **football/event** metaphors with **marketplace/slots** mechanics.

### 1.3 Middleware vs page-level auth (structural inconsistency)

`middleware.ts` matches only: `account`, `profile`, `create-events`, `admin`. **`/host`, `/tickets`, `/play` are not in the matcher.**

**Implication:**

- “Protected” means **different things** at the edge vs inside React: some routes rely on Neon middleware redirect, others on `auth.getSession()` + `redirect()` in the page.
- **E2E bypass** (`meda_e2e_user` cookie) aligns with `isAuthProtectedPath`—but that list must stay manually in sync with **product** expectations for `/host` (currently **not** listed as auth-protected in the same sense).

**Risk class:** Not automatically a vulnerability, but **audit and onboarding cost**: every new “semi-private” page must remember to add session checks; there is no single funnel.

---

## 2. Host workflows — deep dive

### 2.1 `/host` is the product’s host OS — and it’s heavy

The host experience is centered on **`/host`** with `view` query param:

`overview | calendar | places | bookings | people | money | settings`

Implementation split:

- **`OwnerOperationsWorkspace`** (~2.2k lines): calendar, places (pitches), slots, subscription actions embedded—**operational** work.
- **`OwnerDashboardWorkspace`** (~1.2k lines): ERP-style tables and metrics—**reporting** work.

The server page composes **both** depending on view, plus duplicated **metric strips** (places count, slot count, plan status) in `AppPageHeader` and again in section cards.

**Friction:**

1. **Two mega-components** under one URL mean hosts cannot form a stable “this page does X” mental model—**operations and analytics** interleave by view.
2. **`OwnerDashboardWorkspace`** receives `initialTab` derived from host view, but naming diverges: e.g. host `people` → dashboard tab `customers`; host `money` → `payments`; host `settings` → `subscription`. **Indirection** without a user-visible legend.
3. **Floating FAB** (“+”) links to `?view=places`—reasonable, but competes with tab list and primary header actions (“Create match,” “See money”).

### 2.2 Duplication: “Create match” vs host calendar vs slots

- Global nav and profile quick actions still push **`/create-events`** (“Create match”).
- Host calendar/places copy talks about **2-hour booking times**, **blocking**, **places**.
- Product direction (see `plan.md` / engineering plan) points to **booking-first** and slots; **`/create-events` remains a parallel creation funnel** for classic `Event` rows.

**Finding:** Hosts who onboard through **Host** may never need **Create match**, or they may use both—**no single guided path** explains when to use legacy event creation vs slot inventory. This is the **highest-impact confusion** called out in `AGENTS.md`.

### 2.3 Profile vs Host vs Account

Recent copy in `ProfileDashboard` **explicitly** steers: Profile = account/saved/role access; Tickets = things you joined; Host = pitch operations; Admin = platform.

**Good.** But:

- **Pitch owners** still see **Payout settings** inside profile tabs while **money** also lives under Host—**split financial truth** unless carefully duplicated or cross-linked.
- **`AccountWorkspace`** (large) adds **another** “overview” for account-level data—hosts may land in **account** from footer/settings and lose the Host context.

### 2.4 Player-side parallel surfaces

- **`/play`**: discovery (`PlayWorkspace`).
- **`/slots`**: separate listing (potential overlap with play’s slot modes).
- **`/play/slots/[id]`**: slot detail + booking flow.
- **`TicketsHubWorkspace`** (~1.4k lines): hub for tickets, claims, verification—overlaps **narratively** with “bookings” redirect.

**Finding:** From a **player** perspective, “where do I see what I bought?” is **`/tickets`**; from URL taxonomy, **`/bookings`** still exists as a redirect—documentation and support must use one vocabulary.

---

## 3. UI / component architecture

### 3.1 Size concentration

Several **400+ line** client components anchor core flows:

- `OwnerOperationsWorkspace.tsx` — largest
- `TicketsHubWorkspace.tsx`
- `OwnerDashboardWorkspace.tsx`
- `SlotMarketplace.tsx`
- `AccountWorkspace.tsx`
- `CreateEventForm.tsx`
- `HeaderNav.tsx`

**Finding:** This is not vanity metrics—it indicates **state, fetching, and presentation** co-located, which makes **consistent empty/loading/error** behavior hard and increases regression risk when touching “one” feature.

### 3.2 Design system vs ad hoc

`AGENTS.md` calls for standardized Button, Card, Table, etc. The repo **does** use shared primitives (`app/components/ui/*`, `PageShell`, `AppSectionCard`). **However**, host surfaces still show **bespoke layout density** (long copy blocks, multiple `AppSectionCard` stacks, tablist implemented as `Link` grid).

**Inconsistency is structural**, not only token-level: some flows use **toast** (`sonner`), others inline banners—acceptable, but **not documented** as intentional tiers (system vs feature).

---

## 4. Services & API layer

### 4.1 Event domain split

- **`services/events.ts`**: creation, recurrence, images.
- **`services/adminEvents.ts`**: admin mutations and detail.
- **`services/publicEvents.ts`**: cached reads, serializers.
- **`services/ownerAnalytics.ts`**: host dashboard aggregates.
- **`services/pitches.ts` / `services/slots.ts` / `services/bookings.ts`**: booking domain (newer).

**Finding:** Clear **separation by capability**, but **`app/api/profile/events`** (if present) or similar **inline Prisma** routes risk **drift** from `publicEvents` serializers—same entity, different code paths.

### 4.2 API topology (naming)

Top-level `app/api` mixes **resource** names (`events`, `slots`, `bookings`) with **role** names (`owner`, `facilitator`) and **integration** stubs (`chapa` vs `payments/chapa`).

**Finding:** Predictable for veterans; **opaque** for new contributors and for **automated security review** (harder to grep “all owner mutations”).

---

## 5. Top friction points (ranked)

1. **Host: dual workspaces + seven views on one URL** — powerful but overwhelming; tab model hides URL shareability for sub-views inside dashboard workspace.
2. **Legacy “Create match” vs slot-based operations** — two creation philosophies without an in-app decision tree.
3. **Money split** — payouts/balance/host money/profile payout tab.
4. **Middleware scope** — `/host` not edge-protected; relies on page (consistent with design but easy to forget for new routes).
5. **Redirect maze** — `/bookings`, `/my-events`, `/account/owner` teach users different words for the same funnel.

---

## 6. Redundant or overlapping features (honest list)

| Area | Overlap |
|------|---------|
| Host overview vs Owner dashboard “overview” tab | Same metrics family; different component trees |
| Play vs `/slots` | Discovery overlap |
| Tickets hub vs “My bookings” language | Redirect unifies URL, not mental model |
| Event creation vs slot creation | Product strategy tension |
| Profile quick actions vs Host header actions | Duplicate CTAs (“Create match,” “Host”) |

---

## 7. Naming & mental models

- **Host** = good umbrella term; **pitch_owner** in code = friction for non-soccer verticals.
- **Places** = pitches; **booking times** = slots; **People** = customers—**domain glossary** is embedded in `uiCopy` but not surfaced as a user-facing glossary.
- **Admin** vs **Host** is relatively clear after recent profile copy; **Facilitator** is a third role with a **different API subtree** (`/api/facilitator/...`)—easy to forget in permission reviews.

---

## 8. Conclusion

Meda is **functionally rich** but **IA-debt heavy** at the host boundary: one URL (`/host`) carries **too many responsibilities** in **too few navigable sub-routes**, while **legacy event creation** and **new booking domain** coexist without a unified story.

**Recommended direction (preview; detail in `HOST_UX_REDESIGN.md` and `REFACTOR_PLAN.md`):** Treat Host as a **product shell** with **first-class sub-routes** (or stable nested routes), collapse duplicate metrics, and **document** the relationship between Events and Slots for both hosts and engineers.
