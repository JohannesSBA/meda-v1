# Linear Project Context

Purpose: give Linear issues enough shared context that implementation work stays aligned with the current Meda architecture and avoids re-discovering the same constraints.

---

## Product Summary

Meda is a Next.js event marketplace for football events. Core product areas:

- public event discovery and event detail pages
- ticket registration and paid checkout
- refunds, Meda balance, and ticket sharing
- ticket scan and check-in flows
- pitch-owner payouts and facilitator support
- admin billing, user management, and event operations

## Stack

- Next.js 16 App Router
- React 19
- Prisma 7 + PostgreSQL
- Neon Auth
- Chapa payments
- Supabase storage
- Resend email
- Upstash Redis rate limiting fallback
- Vitest + Playwright

## Layering Expectations

- `app/` owns pages, route handlers, and UI composition.
- `app/components/` owns interactive client logic and feature hooks.
- `services/` owns most business logic and domain rules.
- `lib/` owns shared infrastructure like auth, Prisma, validation, revalidation, caching, logging, and integration adapters.
- `prisma/` owns the schema and migrations.

Preferred implementation pattern:

1. page or route receives the request
2. auth guard and input parsing happen near the boundary
3. business logic lives in `services/*`
4. persistence goes through Prisma
5. mutations explicitly revalidate affected paths or tags

## Core Flows

### Event discovery

- `app/events/page.tsx`
- `app/events/useEventSearch.ts`
- `app/api/events/list/route.ts`
- `services/publicEvents.ts`

This flow already centralizes filtering, grouping, availability, and serialization in one dense read-model service.

### Event detail and registration

- `app/events/[id]/page.tsx`
- `app/events/[id]/data.ts`
- `app/components/register/*`
- `app/api/events/[id]/route.ts`
- `app/api/payments/chapa/checkout/route.ts`
- `services/registrations.ts`
- `services/payments.ts`
- `services/refunds.ts`

### Event creation

- `app/components/create-event/useCreateEventForm.ts`
- `app/api/events/create/route.ts`
- `services/events.ts`
- `services/eventCreationFee.ts`

### Profile and admin

- `app/profile/page.tsx`
- `app/components/profile/*`
- `app/api/profile/*`
- `app/api/admin/*`

This area is more mixed: some routes are service-led, others still query Prisma directly.

## Known Architectural Tensions

- Role resolution has multiple sources: Neon base role plus DB-derived marketplace role.
- Middleware protection and route-level protection need to stay aligned.
- Validation is partly centralized in Zod schemas and partly repeated inside service logic.
- `services/publicEvents.ts` is effective but highly coupled.
- Profile and admin client hooks are broad orchestration surfaces.
- Some operational/configuration details drift from intent, including a suspicious default bucket name in `lib/supabaseAdmin.ts` and reliance on undeclared transitive packages like `sonner`.

## High-Risk Change Areas

- auth and middleware
- payment and refund flows
- payout setup and split settlement
- Prisma schema and financial state changes
- cache invalidation after mutations
- environment-sensitive code paths

## Validation Expectations

Use the narrowest relevant command first, then broaden:

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`

## Documentation Expectations For Issues

Each issue should say:

- which user-facing behavior is changing
- which architectural layer should own the logic
- what existing files or flows are in scope
- what validation proves the issue is complete
- what is intentionally out of scope

## Suggested Linear Labels

- `area:auth`
- `area:payments`
- `area:profile`
- `area:admin`
- `area:events`
- `area:docs`
- `area:testing`
- `type:bug`
- `type:refactor`
- `type:tech-debt`
- `type:docs`
- `priority:p0`
- `priority:p1`
- `priority:p2`
