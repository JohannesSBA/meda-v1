# Meda Technical Audit

Date: 2026-03-11
Reviewer stance: principal engineer, security auditor, product UX reviewer
Scope: full repository review of a production-oriented Next.js + Prisma + PostgreSQL SaaS application

## Validation Snapshot

- `npm test`: passed locally (`76/76`)
- `npx tsc --noEmit`: passed locally
- `npm run lint`: failed locally
  - `app/components/create-event/EventFormPreview.tsx:61` unescaped apostrophe
  - `app/components/profile/RegisteredEventsTab.tsx:77` `Date.now()` used during render
  - `app/components/create-event/useCreateEventForm.ts` unused imports

## Executive Summary

Meda has a good base for a small-to-mid-sized product: App Router, typed route handlers, Prisma, test coverage around core services, rate limiting, and a clear product domain. It is not yet at the standard expected for a large-scale production SaaS platform.

The main problems are not cosmetic. They are domain-model and trust-boundary problems:

1. Payments do not have a durable order or reservation model, which can produce oversells and inconsistent fulfillment.
2. `Event.capacity` is used as remaining seats instead of total capacity, which leaks domain complexity into every registration, refund, admin edit, and analytics path.
3. Authorization is inconsistent. The UI suggests admin-only event creation, but the page and API allow any authenticated user to create events.
4. Untrusted data is interpolated into raw HTML inside Mapbox popups.
5. The app is more dynamic than necessary, and several data-heavy flows do work in memory that should be done in the database.

## Overall Codebase Rating

`5/10`

Rationale:

- Stronger than an early prototype: typed code, service layer, tests, documented flows.
- Below production SaaS standard because payment correctness, auth consistency, data modeling, and scaling behavior have unresolved high-severity issues.

## Estimated Remediation Effort

- P0 / P1 stabilization: `4-6 engineer-weeks`
- Full roadmap in this document: `12-16 engineer-weeks` plus QA, migration rehearsal, and payment-provider validation

---

## Step 1 - Architecture Review

### Overall Architecture

The application follows a mostly standard Next.js App Router structure:

- `app/*`: routes, page components, route handlers, and many UI components
- `app/api/*`: server endpoints used by client components
- `services/*`: domain/service logic for events, payments, refunds, ticket sharing, waitlist, email
- `lib/*`: auth wrappers, Prisma client, rate limiting, validators, logging, token utilities
- `prisma/*`: schema and migrations
- `__tests__/*`: route/service/unit coverage with Vitest

### Frameworks, Libraries, and Technologies

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend runtime: Next.js route handlers
- ORM/data access: Prisma 7 + `@prisma/adapter-pg`
- Database: PostgreSQL / Neon
- Auth: Neon Auth (`@neondatabase/auth`)
- Payments: Chapa
- Storage: S3-compatible upload path via AWS SDK and Supabase client utilities
- Email: Resend-based templates/services
- Maps/geo: Mapbox GL
- Rate limiting: Upstash Redis with fallback logic
- Testing: Vitest

### Folder Structure Assessment

What works:

- Core domains exist (`events`, `payments`, `refunds`, `ticketSharing`, `waitlistPromotion`).
- UI primitives are centralized under `app/components/ui`.
- Validation helpers exist under `lib/validations`.

What does not scale well:

- `app/` mixes route files, client components, server helpers, and shared utilities.
- `app/helpers/locationCodec.ts` is imported by backend services, which couples server code to the route tree.
- Some route handlers call services; others query Prisma directly; others do large response-shaping inline.
- Large client hooks (`app/components/register/useRegisterPanel.ts`, `app/components/profile/useProfileData.ts`) have grown into orchestration layers for unrelated concerns.

### Data Flow

Current data flow is mostly:

`Browser -> client component -> same-origin API route -> service or direct Prisma -> database / external provider`

Examples:

- Event discovery: `app/events/page.tsx` -> `app/events/useEventSearch.ts` -> `app/api/events/list/route.ts` -> Prisma
- Registration: `app/components/register/useRegisterPanel.ts` -> event/payment routes -> `services/registrations.ts` or `services/payments.ts`
- Admin event management: profile/admin UI -> `app/api/admin/*` -> Prisma plus helper services
- Ticket verification: QR scanner -> `app/api/tickets/verify/[token]/route.ts` -> Prisma raw SQL + token utilities

The architecture breaks this pattern in a few places:

- `lib/auth/neonAdmin.ts` performs server-side HTTP calls back into the same app instead of calling auth admin primitives directly.
- Data shaping for event details is duplicated across route and page-side loaders.
- Client hooks fetch multiple related resources independently instead of using a shared query abstraction.

### Frontend-to-Backend Communication

The frontend uses a mix of `fetch` and `axios` against internal APIs. That leads to:

- duplicated error handling
- inconsistent return parsing
- no shared retry/caching strategy
- repeated `cache: "no-store"` usage without a broader data policy

Recommendation:

- Standardize on one HTTP client for browser-side internal calls.
- Introduce feature-scoped query hooks and request schemas.
- Move cross-cutting response serialization into shared modules.

### Authentication Flow

Current auth flow:

- Server: `auth.getSession()` and guard helpers in `lib/auth/guards.ts`
- Client: `authClient.useSession()` and `authClient.getSession()`
- Authorization: a mixture of route-level role checks, session existence checks, and UI-only gating

Key weakness:

- Event creation is implied to be admin-only in `app/components/HeaderNav.tsx:24-29` and `app/components/HeaderNav.tsx:39-45`, but the page itself is accessible and `app/api/events/create/route.ts:16-18` only requires any authenticated user.

This is a direct trust-boundary mismatch. The browser is hiding a capability that the API still permits.

### Database Structure and Access Patterns

Patterns currently in use:

- Prisma CRUD in services and routes
- raw SQL for ticket verification and auth user lookup
- domain state encoded into existing columns instead of normalized models

The largest modeling issue is `Event.capacity`:

- registrations decrement it in `services/registrations.ts:65-75`
- balance payments decrement it in `services/payments.ts:110-124`
- refunds increment it in `services/refunds.ts:96-100`
- admin edits overwrite it in `app/api/admin/events/[id]/route.ts:154-165`

That means `capacity` is behaving as "remaining seats", not "designed capacity". This is a bad fit for reporting, admin editing, concurrency control, and recurring-event maintenance.

### Architectural Weaknesses

| Weakness | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Inconsistent boundaries | Routes mix validation, serialization, Prisma, and business logic | Hard to reason about correctness | Move toward `route -> schema -> service -> repository` |
| Tight coupling to `app/` | `services/*` import `@/app/helpers/locationCodec` | Shared server logic depends on route tree | Move shared helpers to `lib/geo` or `shared/geo` |
| UI-only authorization signals | Create-event UI hidden but API open | Role confusion and privilege leakage | Enforce permissions in API/service layer |
| Service duplication | Event shaping appears in multiple loaders | Drift and inconsistent outputs | Centralize serializers or query models |
| Server-to-self HTTP | `lib/auth/neonAdmin.ts:11-68` | Added latency, duplicated auth context handling | Use provider SDK/admin client directly |
| Domain leakage into primitives | `capacity` stores mutable remaining inventory | Every flow needs special-case logic | Introduce explicit inventory / reservation model |

### Suggested Modular Target

```text
app/
  (public)/
  (authenticated)/
  api/
features/
  events/
    api/
    components/
    server/
      commands/
      queries/
      serializers/
  payments/
    api/
    server/
  profile/
    components/
    queries/
shared/
  auth/
  db/
  geo/
  ui/
```

---

## Step 2 - Code Quality Audit

### High-Value Findings

#### 1. Large hooks violate single-responsibility

- `app/components/register/useRegisterPanel.ts:23-420` manages occurrence selection, ticket quantity, payment confirmation, waitlist state, saved-event state, refund state, share-link creation, and auth redirect behavior.
- `app/components/profile/useProfileData.ts:22-392` manages user dashboard data, admin user CRUD, admin event CRUD, stats, category loading, save actions, refunds, and navigation actions.

Impact:

- hard to test in isolation
- easy to introduce stale state bugs
- repeated fetch logic and hidden dependencies

Recommendation:

- Split hooks by domain:
  - `useRegistrationState`
  - `useEventTicketSharing`
  - `useBalancePayment`
  - `useProfileRegisteredEvents`
  - `useAdminUsers`
  - `useAdminEvents`

#### 2. Duplicate and drifting semantics

- `app/components/profile/MyEventsPanel.tsx:1-5` says it lists events the user is hosting or managing.
- The actual fetch is `app/components/profile/MyEventsPanel.tsx:63-65` -> `/api/profile/registered-events`.
- There is already a route for owned events at `app/api/profile/events/route.ts:6-62`.

Impact:

- product confusion
- duplicated navigation meaning
- higher maintenance cost

Recommendation:

- Rename the panel to what it actually is, or repoint it to `/api/profile/events`.
- Align labels, comments, and information architecture.

#### 3. Mixed HTTP client patterns

- Some client flows use `fetch`, others use `axios`.
- Error conversion is repeated instead of standardized.

Recommendation:

- Use one client abstraction for browser-to-internal-API calls.
- Expose typed helpers per domain.

#### 4. Validation is inconsistent

- Some endpoints use Zod-based validators.
- Others manually parse `FormData` or JSON with ad hoc checks, for example `app/api/events/create/route.ts:20-49` and `app/api/admin/events/[id]/route.ts:56-132`.

Recommendation:

- Validate every route with a shared request schema.
- Parse once, then pass a typed command object to the service layer.

#### 5. Comments and names drift from behavior

- `EventsMap` comment claims clustering, but the implementation creates plain markers.
- `MyEventsPanel` comment claims hosting/managing, but renders registered events.
- `telebirrPrepayId` stores Chapa transaction references, which is misleading across providers.

Recommendation:

- Align names with current behavior, especially in payment and admin code.
- Rename provider-specific fields to neutral names (`providerReference`, `checkoutUrl`).

### SOLID and Maintainability Assessment

| Principle | Status | Notes |
| --- | --- | --- |
| Single Responsibility | Weak | Large hooks and route handlers do too much |
| Open/Closed | Mixed | Domain services exist, but behavior is still duplicated in routes |
| Liskov | Fine | No major inheritance hierarchy |
| Interface Segregation | Weak | Components and hooks consume oversized state APIs |
| Dependency Inversion | Weak | Services depend directly on Prisma, axios, and email providers with minimal seam for testing |

### Better Function Signatures

Current style is too primitive-heavy. For example, event creation takes many loose fields and relies on runtime checks.

Suggested pattern:

```ts
type CreateEventCommand = {
  actorId: string;
  title: string;
  categoryId: string;
  description?: string | null;
  startsAtUtc: Date;
  endsAtUtc: Date;
  timezone: string;
  venue: {
    address: string;
    latitude: number;
    longitude: number;
  };
  inventory: {
    capacityTotal: number | null;
    unitPriceEtb: number | null;
  };
  recurrence?: {
    kind: "daily" | "weekly" | "custom";
    interval: number;
    untilUtc: Date;
    weekdays?: number[];
  };
  image?: UploadedImage | null;
};

async function createEvent(command: CreateEventCommand): Promise<CreateEventResult> {
  // validate invariants before persistence
}
```

### Refactor Example: query/service split

```ts
// features/events/server/queries/listEvents.ts
export async function listUpcomingEvents(filters: EventSearchFilters) {
  return eventRepository.listUpcoming(filters);
}

// features/events/api/route.ts
export async function GET(request: Request) {
  const filters = eventSearchSchema.parse(readSearchParams(request));
  const result = await listUpcomingEvents(filters);
  return NextResponse.json(eventListSerializer(result));
}
```

---

## Step 3 - Security Review

## Critical Findings

### 1. Payment fulfillment is not inventory-safe

Evidence:

- `services/payments.ts:197-294` checks capacity only before redirecting the user to Chapa.
- `services/payments.ts:356-367` checks capacity again only after payment verification.
- No reservation or hold exists between initialize and confirm.

Impact:

- users can successfully pay and still fail fulfillment
- oversell windows under concurrency
- manual support burden and refund disputes

### 2. Balance payments bypass the per-user ticket cap

Evidence:

- Free registration enforces `MAX_TICKETS_PER_USER_PER_EVENT` in `services/registrations.ts:50-57`.
- Balance payment path does not check that limit in `services/payments.ts:58-136`.

Impact:

- inconsistent policy enforcement
- users can exceed intended inventory ownership limits

### 3. Chapa confirmation derives quantity from mutable event price

Evidence:

- `services/payments.ts:356-358` computes `quantity` from `payment.amountEtb / payment.event.priceField`.

Impact:

- if event price changes after checkout initialization, fulfillment quantity becomes incorrect
- a price edit can under-issue or over-issue tickets

### 4. Successful payment can still terminate in an untracked error state

Evidence:

- `services/payments.ts:360-367` throws when event ended or capacity is gone.
- In those branches, the payment row is not transitioned to a compensating state and no refund workflow is triggered.

Impact:

- payment provider success and app state can diverge
- finance reconciliation becomes manual

### 5. Create-event authorization is inconsistent

Evidence:

- `app/components/HeaderNav.tsx:27` and `app/components/HeaderNav.tsx:42` hide create-event links behind admin role.
- `app/api/events/create/route.ts:16-18` only requires a session.

Impact:

- any authenticated user can create events by calling the route directly

### 6. XSS risk in map popup rendering

Evidence:

- `app/components/EventsMap.tsx:79-95` interpolates `e.eventName` and `e.addressLabel` into `setHTML(...)`.

Impact:

- stored XSS if event names/locations contain markup
- account/session compromise if attacker-controlled content is rendered

### 7. Ticket scan endpoint performs a mutation on `GET`

Evidence:

- `app/api/tickets/verify/[token]/route.ts:113-121` inserts scan records during `GET`.

Impact:

- breaks HTTP semantics
- easier accidental replay by crawlers, prefetchers, proxies, or embedded tools
- harder to add CSRF-safe mutation behavior later

### 8. Authorization model is inconsistent for ticket scanning

Evidence:

- verification route allows event owners or admins to scan: `app/api/tickets/verify/[token]/route.ts:85-89`
- scan page itself allows admins only: `app/events/[id]/scan/page.tsx:21-23`

Impact:

- role model is unclear
- behavior differs depending on entry point

## Additional Security Weaknesses

| Finding | Evidence | Recommendation |
| --- | --- | --- |
| Raw unsafe SQL present | `prisma.$queryRawUnsafe` in `app/api/tickets/verify/[token]/route.ts:23-25` | Allowlist reduces exposure, but use safer query construction or a replicated user table |
| Route rate limiting is uneven | Some routes use Upstash, many privileged mutation routes do not | Add rate limiting to admin mutations, payment confirmation, share-link creation, and refund paths |
| Manual validation still common | Event create/admin edit parse payloads by hand | Require schema validation at every boundary |
| Payment confirmation depends on browser return path | Browser-driven confirm can be skipped or interrupted | Add provider webhook verification plus idempotent server-side reconciliation job |

### Recommended Security Fixes

1. Introduce a payment intent / order model with stored `quantity`, `unitPriceEtb`, `totalAmountEtb`, `provider`, and immutable `providerReference`.
2. Add seat reservations or short-lived inventory holds during checkout initialization.
3. Move ticket scan mutation to `POST /api/tickets/scan`.
4. Enforce authorization in service methods, not only route/UI layers.
5. Escape or avoid raw HTML in all map popup content.
6. Add systematic threat-modeling for all token-based flows (share links, ticket verification, payment callbacks).

### Refactor Example: safe popup rendering

```ts
function buildPopupNode(event: EventResponse) {
  const root = document.createElement("div");
  root.className = "min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-xl";

  const title = document.createElement("div");
  title.className = "px-3 py-2 text-sm font-semibold text-slate-900";
  title.textContent = event.eventName;

  const where = document.createElement("div");
  where.className = "px-3 pb-3 text-xs text-slate-600";
  where.textContent = event.addressLabel ?? "Location pending";

  root.append(title, where);
  return root;
}

new mapboxgl.Popup({ offset: 10 }).setDOMContent(buildPopupNode(event));
```

### Refactor Example: permission guard

```ts
export async function requirePermission(permission: "event:create" | "event:scan") {
  const session = await requireSessionUser();
  if (session.response) return session;

  const role = session.user?.role;
  const allowed =
    permission === "event:create" ? role === "admin" :
    permission === "event:scan" ? role === "admin" || role === "host" :
    false;

  if (!allowed) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return session;
}
```

---

## Step 4 - Performance Analysis

### 1. Root layout disables most static optimization

Evidence:

- `app/layout.tsx:55` exports `dynamic = "force-dynamic"`.
- `app/layout.tsx:62-69` reads session at the root for every request.

Impact:

- public pages cannot benefit from static rendering or route caching
- TTFB increases across the entire application

Recommendation:

- Keep public shells static.
- Resolve auth state only in authenticated layouts or via client hydration where acceptable.

### 2. Event discovery does in-memory work that belongs in the database

Evidence:

- `app/api/events/list/route.ts:71-78` loads up to 500 rows.
- `app/api/events/list/route.ts:80-173` decodes locations, geo-filters, de-duplicates recurring series, sorts, and paginates in memory.

Impact:

- poor scalability under event growth
- inaccurate pagination under high row counts
- wasted memory and CPU on every request

Recommendation:

- Normalize location columns.
- Push filtering, ordering, and paging into SQL.
- Represent recurring series with queryable series metadata instead of in-memory grouping keys.

### 3. Repeated client fetching creates network chatter and stale-state complexity

Evidence:

- `app/components/register/useRegisterPanel.ts:119-259` independently fetches event details, waitlist status, balance, and saved events.
- `app/components/profile/useProfileData.ts:65-161` contains multiple independent loaders.

Recommendation:

- Adopt TanStack Query or an equivalent shared query layer.
- Co-locate cache keys and mutation invalidation with features.

### 4. Heavy client libraries should be loaded more selectively

Candidates:

- `mapbox-gl`
- `html5-qrcode`
- large icon bundles

Recommendation:

- dynamically import map and QR components on the routes that need them
- isolate rarely used admin features into separate chunks

### 5. Prisma client lifecycle is risky for dev/serverless

Evidence:

- `lib/prisma.ts:5-13` creates a fresh client eagerly without a `globalThis` singleton.

Impact:

- connection churn
- harder local hot-reload behavior
- avoidable client creation overhead

Recommended implementation:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaPg;
};

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const adapter = globalForPrisma.prismaAdapter ?? new PrismaPg({ connectionString });
  globalForPrisma.prismaAdapter = adapter;
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

---

## Step 5 - UI/UX Review

### Product and Navigation Issues

#### 1. Capability signaling is inconsistent

- Non-admin users do not see "Create Event" in navigation.
- Non-admin users can still create events if they know the route.

This is both a security issue and a UX issue. Hidden capabilities without server enforcement create support confusion and erode trust.

#### 2. "My Events" means different things in different parts of the app

- UI text suggests hosted/managed events.
- Actual data is ticket ownership.
- There is already a route that returns owned events.

Recommendation:

- Split into `My Tickets` and `Hosted Events`, or repurpose `/my-events` to one clear meaning.

### Accessibility Findings

#### 1. Nested interactive elements

- `app/components/EventCard.tsx:53-57` wraps the card in a `Link`.
- Buttons exist inside that link at `app/components/EventCard.tsx:96-113` and `app/components/EventCard.tsx:136-153`.

Impact:

- invalid interactive semantics
- keyboard and screen-reader behavior can be inconsistent

Recommendation:

- Make the card container an `article`.
- Use a separate full-card overlay link or a single primary CTA plus separate action buttons outside the link target.

#### 2. Blocking native confirm dialogs

Examples:

- `app/components/profile/useProfileData.ts:281-304`
- `app/components/create-event/useCreateEventForm.ts`
- `app/components/profile/RegisteredEventsTab.tsx`

Impact:

- inconsistent styling
- poor mobile UX
- weak accessibility and no contextual detail

Recommendation:

- Replace with app-styled modal/dialog components.

#### 3. Map popup content is not part of the design system

- Inline styles in `app/components/EventsMap.tsx:80-95`
- Keyboard/accessibility semantics are limited

Recommendation:

- Build the popup with DOM nodes or a custom overlay pattern and use design-system tokens/classes.

### Loading and Error State Review

What is good:

- Many client panels at least show toast failures and some skeleton states.

What is weak:

- Multiple loaders fail silently (`catch {}`) and leave stale UI.
- No consistent empty/error surface across maps, lists, and profile panels.
- Browser-driven payment confirmation can leave the UI in an ambiguous state if redirect/confirm fails mid-flight.

### Component Reuse Review

Current issue:

- Similar list cards and action flows exist across event discovery, registered events, profile panels, and admin views with duplicated formatting logic.

Recommendation:

- Create shared feature-level presentation components:
  - `EventMeta`
  - `TicketCountBadge`
  - `PriceBadge`
  - `EventListRow`
  - `AsyncPanelState`

### UX Improvements

1. Rename or split "My Events".
2. Replace browser confirm flows with a proper modal system.
3. Rework `EventCard` semantics for accessibility.
4. Use a shared empty/error/loading state component for all major panels.
5. Make payment status explicit with a dedicated success/pending/failure screen instead of relying only on query-string-driven toast flows.

---

## Step 6 - Database Design Review

### Modeling Problems

#### 1. `Event.capacity` is overloaded

Current behavior makes `capacity` represent remaining seats, not total planned seats.

Problems caused by this:

- admin edits can accidentally rewrite remaining inventory
- analytics cannot reliably answer "how many seats were planned vs sold"
- recurring-series bulk updates become unsafe
- capacity logic is duplicated everywhere

Recommended schema direction:

```prisma
model Event {
  eventId         String   @id @default(uuid()) @db.Uuid
  capacityTotal   Int?
  // optional: denormalized cache field if needed
  capacityReserved Int     @default(0)
  capacitySold     Int     @default(0)
}

model TicketOrder {
  orderId         String   @id @default(uuid()) @db.Uuid
  eventId         String   @db.Uuid
  userId          String   @db.Uuid
  quantity        Int
  unitPriceEtb    Int
  totalAmountEtb  Int
  status          OrderStatus
  provider        PaymentProvider?
  providerRef     String?  @unique
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### 2. Location data is denormalized into a single string

Evidence:

- `prisma/schema.prisma:64`
- `services/events.ts:177`

Impact:

- cannot index latitude/longitude
- string parsing required in every read path
- search and geo filters are less reliable

Recommendation:

- Split into `addressLabel`, `latitude`, `longitude`.
- Add a geospatial index strategy appropriate for PostgreSQL/PostGIS or at least B-tree indexes for coordinates/ranges.

#### 3. Payment model lacks transactional detail

Current `Payment` model issues:

- `telebirrPrepayId` is provider-specific and not unique
- quantity is not stored
- unit price is not stored
- no immutable order snapshot

Recommendation:

- Add `provider`, `providerReference @unique`, `quantity`, `unitPriceEtb`, `totalAmountEtb`, and `metadata`.
- Consider a separate `PaymentAttempt` table if retries are supported.

### Indexing Gaps

Recommended additions based on observed query patterns:

- `EventAttendee(userId, eventId)` or at least `@@index([userId])`
- `SavedEvent(userId, createdAt)`
- `EventWaitlist(eventId, createdAt)`
- `TicketScan(eventId, scannedAt)`
- `Payment(providerReference)` as unique
- `Payment(userId, status, createdAt)`
- `Invitation(eventId, userId, status)`

### Data Consistency Concerns

| Concern | Impact | Fix |
| --- | --- | --- |
| Payment quantity inferred from current event price | Fulfillment mismatch | Store quantity and unit price on payment/order row |
| Remaining seats stored as event capacity | Inventory drift | Separate total capacity from sold/reserved state |
| Auth user data lives outside app DB | Raw queries/internal API coupling | Sync a local user profile table or use a dedicated auth admin client layer |

---

## Step 7 - Developer Experience Review

### Build and CI

Issue:

- Build script runs `prisma generate`, but CI does not.
- Generated Prisma client is ignored in `.gitignore:44`.
- CI only runs `npm ci`, `lint`, `tsc`, and `test` in `.github/workflows/ci.yml:20-29`.

Impact:

- clean CI environments may fail or become brittle depending on generated-client state

Recommendation:

- Add an explicit `npm run prisma:generate` step in CI before typecheck/test.

### Missing Project Guardrails

Gaps:

- no committed `.env.example`
- no `typecheck` script
- no `format` script
- no `prisma:generate` or `prisma:migrate:deploy` scripts

Recommended scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prisma:generate": "prisma generate",
    "prisma:migrate:deploy": "prisma migrate deploy"
  }
}
```

### Testing Strategy

Strengths:

- Core services and route handlers have targeted unit tests.
- Refund, payment, registration, and ticket-sharing behavior has coverage.

Gaps:

- no browser E2E tests for auth, checkout, ticket scan, and admin workflows
- no integration tests against a real database
- no contract tests for Chapa/Neon/Auth provider boundaries
- no concurrency tests for oversell or duplicate fulfillment scenarios

Recommended test layers:

1. unit tests for pure validators and business rules
2. integration tests with Prisma against ephemeral Postgres
3. Playwright E2E for sign-in, checkout redirect/return, sharing, refunds, scanning
4. race-condition tests for inventory/payment flows

### Documentation

README is useful, but it drifts from code in a few areas and does not currently document:

- exact environment variable contract
- role/permission model
- payment fulfillment lifecycle
- data ownership boundaries between Neon Auth and application tables

---

## Step 8 - Improvement Roadmap

## 1. Critical Issues (Must Fix)

1. Replace current payment flow with an order/payment-intent model that stores quantity and unit price.
2. Add inventory reservation or short-lived seat holds for checkout initialization.
3. Redefine event capacity as total capacity, not remaining seats.
4. Enforce create-event authorization at API/service level.
5. Remove raw HTML interpolation from map popups.
6. Move ticket scanning mutation from `GET` to `POST`.
7. Add webhook-driven payment reconciliation and idempotency.

## 2. High Impact Improvements

1. Normalize event location into structured columns.
2. Move event listing filtering/pagination into SQL.
3. Break up `useRegisterPanel` and `useProfileData` into feature hooks.
4. Standardize request validation and response serialization.
5. Remove server-to-self HTTP in `lib/auth/neonAdmin.ts`.
6. Make root layout static where possible and isolate auth-aware shells.

## 3. Medium Improvements

1. Add missing database indexes for observed query paths.
2. Standardize on one internal HTTP client abstraction.
3. Add Prisma singleton handling.
4. Replace browser `confirm()` flows with accessible dialogs.
5. Align naming and comments with actual product behavior.
6. Add `typecheck`, `format`, and Prisma lifecycle scripts.

## 4. Nice to Have

1. Adopt TanStack Query for client data orchestration.
2. Lazy-load Mapbox and QR code tooling.
3. Add richer analytics tables for attendance and scan events.
4. Build a permissions matrix and role capability abstraction.
5. Introduce feature-based folders to reduce `app/` sprawl.

---

## Step 9 - Refactored Examples

### Example A - Payment intent model and fulfillment flow

```ts
type CreateCheckoutInput = {
  actorId: string;
  eventId: string;
  quantity: number;
};

export async function createCheckout(input: CreateCheckoutInput) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({
      where: { eventId: input.eventId },
      select: { capacityTotal: true, capacitySold: true, priceField: true }
    });

    const available =
      event.capacityTotal == null ? Number.POSITIVE_INFINITY :
      event.capacityTotal - event.capacitySold;

    if (input.quantity > available) {
      throw new Error("Not enough seats available");
    }

    const order = await tx.ticketOrder.create({
      data: {
        eventId: input.eventId,
        userId: input.actorId,
        quantity: input.quantity,
        unitPriceEtb: event.priceField ?? 0,
        totalAmountEtb: (event.priceField ?? 0) * input.quantity,
        status: "pending",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    await tx.event.update({
      where: { eventId: input.eventId },
      data: { capacityReserved: { increment: input.quantity } }
    });

    return order;
  });
}
```

### Example B - Safer event card semantics

```tsx
export function EventCard({ event, href, onSaveToggle, isSaved }: EventCardProps) {
  return (
    <article className="group relative rounded-2xl border border-[var(--color-border)]">
      <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={event.eventName} />

      <div className="relative z-10 pointer-events-none">
        <EventCardContent event={event} />
      </div>

      {onSaveToggle ? (
        <button
          type="button"
          className="absolute right-3 top-3 z-20"
          onClick={() => void onSaveToggle(event.eventId, isSaved)}
        >
          Save
        </button>
      ) : null}
    </article>
  );
}
```

### Example C - Feature query hook split

```ts
export function useSavedEvents() {
  return useQuery({
    queryKey: ["saved-events"],
    queryFn: async () => {
      const res = await fetch("/api/profile/saved-events", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load saved events");
      return res.json() as Promise<{ items: SavedEventItem[] }>;
    }
  });
}

export function useBalance() {
  return useQuery({
    queryKey: ["profile-balance"],
    queryFn: async () => {
      const res = await fetch("/api/profile/balance", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load balance");
      return res.json() as Promise<{ balanceEtb: number }>;
    }
  });
}
```

### Example D - Event creation authorization fix

```ts
export async function POST(request: Request) {
  const session = await requireAdminUser();
  if (session.response) return session.response;

  const form = eventCreateSchema.parse(await readEventCreateForm(request));
  const result = await createEvent({
    actorId: session.user!.id,
    ...form
  });

  return NextResponse.json(result, { status: 201 });
}
```

---

## Step 10 - Final Summary

Meda is a promising codebase with real product depth, but it currently carries production risk in the exact areas that hurt SaaS systems most: payment correctness, authorization consistency, inventory modeling, and scaling paths for data-heavy screens.

The fastest path to a safer platform is:

1. fix payment and inventory modeling
2. harden authorization and unsafe rendering paths
3. move high-volume queries and geo/search logic into the database
4. split oversized hooks and standardize route validation

---

## Consolidated TODO List

### P0

- [x] Add a durable order/payment-intent model with stored quantity and unit price
- [x] Implement seat reservations or checkout holds
- [x] Replace remaining-seat `capacity` semantics with total capacity plus sold/reserved tracking
- [x] Enforce create-event permissions in API/service code
- [x] Remove `setHTML(...)` usage for untrusted map popup content
- [x] Convert ticket scan mutation from `GET` to `POST`
- [x] Add webhook-based payment reconciliation and idempotency handling

### P1

- [x] Normalize event location into `addressLabel`, `latitude`, and `longitude`
- [x] Push event list filtering, sorting, grouping, and pagination into SQL
- [x] Store payment provider references in provider-neutral fields with uniqueness constraints
- [x] Add missing indexes for attendee, saved-event, waitlist, ticket-scan, and payment query paths
- [x] Split `useRegisterPanel` into focused hooks
- [x] Split `useProfileData` into user/admin domain hooks
- [x] Remove server-to-self fetches from `lib/auth/neonAdmin.ts`
- [x] Make the root layout static for public routes

### P2

- [x] Standardize all route input validation with shared schemas
- [x] Standardize internal browser API calls on one client abstraction
- [x] Introduce Prisma singleton lifecycle management
- [x] Replace native confirm dialogs with accessible design-system dialogs
- [x] Fix `My Events` information architecture and naming
- [x] Fix nested interactive semantics in `EventCard`
- [x] Add a dedicated payment success/pending/failure UX
- [x] Add `.env.example`
- [x] Add `typecheck`, `format`, and Prisma scripts
- [x] Add `prisma generate` to CI
- [x] Resolve current lint failures and keep CI green

### P3

- [x] Add E2E coverage for auth, checkout, ticket sharing, refunds, and scanning
- [x] Add integration tests against ephemeral Postgres
- [x] Add concurrency tests for checkout and fulfillment flows
- [ ] Consider TanStack Query for client-side data orchestration
- [x] Lazy-load heavy client-only libraries such as Mapbox and QR scanning
- [x] Move shared helpers out of `app/helpers` into a neutral shared/server location
- [ ] Reorganize toward feature-based folders as the codebase grows
