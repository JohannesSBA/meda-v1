# Meda

Meda is a Next.js event platform where users can browse events, register/purchase tickets, save events, and manage their own event activity.

This document provides:
- local setup and migration workflow
- detailed ticket sharing architecture and behavior
- `My Events` feature overview
- key components, APIs, and data model references

## Tech Stack

- Next.js App Router (`app/`)
- React client components for interactive UI
- Prisma + PostgreSQL (Neon)
- Neon Auth for authentication/session
- Chapa for paid checkout flow

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env`.
3. Run Prisma migrations:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`.

## Migration Notes (Neon Branches and Data Safety)

If your database has schema drift and `prisma migrate dev` suggests reset:
- Do not run reset on data you want to keep.
- Prefer Neon branch-based workflow:
  - create a branch in Neon
  - point `DATABASE_URL` to that branch
  - use `prisma migrate resolve --applied <migration_name>` for baseline/manual tables
  - use `npx prisma migrate deploy` to apply pending migrations

This project includes a baseline migration for `saved_events` to avoid destructive reset when drift exists.

## Feature Overview

### Ticket Sharing

Ticket owners can share extra tickets from the same event using a claim link.

#### Business Rules

- User must own at least 2 tickets to generate a share link.
- Shareable quantity is always `ownedTickets - 1` (owner keeps at least one ticket).
- Claim link requires sign-in.
- Link expires at event start.
- Owner cannot claim their own link.
- Same claimant cannot claim twice from the same invitation.
- Claiming transfers one ticket from owner to claimant.
- A claimant who already has a ticket for that event can still claim another (multi-ticket ownership is allowed).

### My Events

A dedicated page for events where the user has at least one ticket:
- route: `/my-events`
- included in header nav
- supports `upcoming`, `past`, and `all` filters
- shows event metadata and ticket counts
- allows generating share links for events with more than one ticket

## Ticket Sharing: Components, APIs, and Flow

### Data Model

Defined in `prisma/schema.prisma`:

- `EventAttendee`
  - one row per ticket
  - ownership is represented by `userId`
- `Invitation`
  - stores share-link state and constraints:
    - `tokenHash`
    - `status` (`Active`, `Expired`, `Revoked`)
    - `expiresAt`
    - `maxClaims`
    - `claimedCount`
- `InvitationClaim`
  - records who claimed from a link
  - unique `(invitationId, claimedByUserId)` prevents duplicate claim per invitation

Migration files:
- `prisma/migrations/20260226000000_saved_events_baseline/migration.sql`
- `prisma/migrations/20260226000100_ticket_sharing_claims/migration.sql`

### Token Security

Implemented in `lib/tickets/shareTokens.ts`:
- generate cryptographically random token
- store only SHA-256 hash in DB
- raw token appears only in share URL returned to owner

### Service Layer

Implemented in `services/ticketSharing.ts`:

- `createShareLink(...)`
  - validates event and owner ticket count
  - rotates token on re-generation
  - updates/reuses invitation record and preserves claim history
  - returns share URL and remaining slots

- `getShareLinkDetails(token)`
  - resolves invitation by token hash
  - computes and returns link status + event metadata
  - auto-marks active link as expired if time has passed

- `claimShareLink(...)`
  - enforces auth/business rules
  - validates active/remaining claim slot
  - checks duplicate claim by same user
  - transfers one `EventAttendee` row from owner to claimant in a transaction
  - increments claim counter atomically

- `revokeShareLink(...)`
  - owner-only
  - marks link as revoked

### API Endpoints

Implemented under `app/api/tickets/share/...`:

- `POST /api/tickets/share/create`
  - body: `{ eventId }`
  - response includes `shareUrl`, `remainingClaims`, and metadata

- `GET /api/tickets/share/[token]`
  - returns share-link details for claim page

- `POST /api/tickets/share/[token]/claim`
  - transfers one ticket to signed-in claimant
  - revalidates event/profile pages after success

- `POST /api/tickets/share/[token]/revoke`
  - owner revokes active link

## UI Surfaces and User Experience

### 1) Event Details (`/events/[id]`)

Component: `app/components/RegisterPanel.tsx`

Capabilities:
- displays current user ticket count for selected event
- if `myTickets > 1`, shows share panel
- allows:
  - generate link
  - regenerate link
  - copy link
  - inline `Copied` indicator + toast feedback

Additional behavior:
- after successful free registration or paid confirmation, if user crosses above 1 ticket, share panel can be used immediately.

### 2) My Events (`/my-events`)

Files:
- `app/my-events/page.tsx`
- `app/components/profile/MyEventsPanel.tsx`

Capabilities:
- list ticketed events for logged-in user
- filter by status (upcoming/past/all)
- per event:
  - view event
  - show `Share link` action when `ticketCount > 1`
  - copy feedback via inline `Copied` indicator and toast

### 3) Profile > Registered Events (`/profile`)

Component: `app/components/profile/ProfileDashboard.tsx`

Capabilities:
- in Registered Events tab, each event row shows:
  - `View`
  - `Save/Unsave`
  - `Share link` (when `ticketCount > 1`)
- copy feedback via inline `Copied` indicator and toast

### 4) Claim Page (`/tickets/claim/[token]`)

Files:
- `app/tickets/claim/[token]/page.tsx`
- `app/components/tickets/TicketClaimPanel.tsx`

Capabilities:
- requires authentication (redirects to sign-in with callback)
- loads invitation + event details
- displays link status and remaining claims
- allows claimant to claim ticket when eligible

## End-to-End Flow Details

### Generate Share Link Flow

1. User clicks share action from event/profile/my-events.
2. Client calls `POST /api/tickets/share/create`.
3. Backend validates ownership/ticket count/event time.
4. Backend creates or updates invitation and rotates token.
5. UI receives `shareUrl`, then:
   - shows link in panel (event page), or
   - copies link directly (my-events/profile)
6. User sees toast and inline copied indicator.

### Claim Flow

1. Friend opens `/tickets/claim/[token]`.
2. If not signed in, redirected to sign-in and back.
3. Claim page fetches invitation details.
4. User clicks claim.
5. Backend transaction:
   - validates status/rules
   - reserves claim slot
   - transfers ticket ownership (`EventAttendee.userId`)
   - records `InvitationClaim`
6. User is redirected to event page on success.

### Regenerate Link Flow

1. Owner generates link again.
2. Backend rotates token hash on invitation.
3. Previous raw link is no longer valid.
4. Claim history stays attached to invitation record.

## Key File Map

- Header/Nav
  - `app/components/HeaderNav.tsx`
- Event registration/purchase UI
  - `app/components/RegisterPanel.tsx`
- My Events page
  - `app/my-events/page.tsx`
  - `app/components/profile/MyEventsPanel.tsx`
- Profile dashboard
  - `app/components/profile/ProfileDashboard.tsx`
- Claim page
  - `app/tickets/claim/[token]/page.tsx`
  - `app/components/tickets/TicketClaimPanel.tsx`
- Sharing backend
  - `app/api/tickets/share/create/route.ts`
  - `app/api/tickets/share/[token]/route.ts`
  - `app/api/tickets/share/[token]/claim/route.ts`
  - `app/api/tickets/share/[token]/revoke/route.ts`
  - `services/ticketSharing.ts`
  - `lib/tickets/shareTokens.ts`
- Ticket ownership/event APIs
  - `app/api/events/[id]/route.ts`
  - `app/api/profile/registered-events/route.ts`

## QA Checklist

- Generate link with exactly 2 tickets.
- Generate link with 5 tickets and confirm up to 4 claims available.
- Regenerate link and verify old link no longer works.
- Claim while already owning ticket for same event.
- Confirm owner cannot claim own link.
- Confirm same user cannot claim twice from same invitation.
- Confirm expired/revoked links fail with clear message.
- Verify share controls appear in:
  - event details
  - my events
  - profile registered events
