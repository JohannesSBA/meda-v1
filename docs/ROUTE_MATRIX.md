# Meda Route Matrix

Date: 2026-03-30

This document defines which routes are canonical, which are compatibility aliases, and where auth is enforced.

## Canonical user-facing routes

| Route | Purpose | Auth | Notes |
| --- | --- | --- | --- |
| `/play` | Unified discovery for booking times and matches | Public | Use `?mode=slots` or `?mode=events` |
| `/tickets` | User booking and ticket hub | Signed-in user | Canonical replacement for booking/ticket history |
| `/host` | Pitch-owner workspace | Pitch owner | Canonical replacement for owner operations |
| `/profile` | Account, saved items, payout settings, role shortcuts | Signed-in user | Should stay account-focused |
| `/admin` | Platform administration | Admin | Canonical admin route |
| `/create-events` | Advanced event creation flow | Signed-in user with create permission | Secondary to host booking-time flow |

## Compatibility aliases

These should remain as redirect-only compatibility shims.

| Alias | Canonical target |
| --- | --- |
| `/events` | `/play?mode=events` |
| `/slots` | `/play?mode=slots` |
| `/bookings` | `/tickets` |
| `/my-tickets` | `/tickets` |
| `/account/owner` | `/host` |

## Route ownership rules

### Play
- owns slot discovery
- owns event discovery
- owns map-first discovery
- must not become a second tickets or host dashboard

### Tickets
- owns user booking history
- owns ticket assignment/dependent/claim-link flows
- owns QR visibility
- owns group payment next actions

### Host
- owns pitch owner operations
- owns place setup
- owns booking-time management
- owns owner reporting, money, and settings

### Profile
- owns personal account data
- owns saved items
- owns payout destination settings
- may link out to Host/Admin/Tickets
- must not become a second host/admin dashboard

### Admin
- owns moderation, platform billing, and ops views
- should not be embedded into Profile

## Protection model

### Middleware-protected today
- `/account/*`
- `/profile`
- `/profile/*`
- `/create-events`
- `/create-events/*`
- `/admin`
- `/admin/*`

### Server page / route guard protected today
- `/tickets`
- `/host`
- many `app/api/**` routes via explicit guard helpers

## Rule for future changes

When adding new internal links:
- use canonical routes only
- do not introduce new direct links to compatibility aliases
- if an alias is needed, keep it as a redirect surface only
