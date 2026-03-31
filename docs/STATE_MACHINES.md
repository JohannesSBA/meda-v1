# Meda State Machines

Date: 2026-03-30

This document describes the critical product state machines that should be treated as explicit contracts when changing booking, money, and ticket logic.

## Booking

Primary statuses:
- `PENDING`
- `CONFIRMED`
- `EXPIRED`
- `CANCELLED`
- `COMPLETED`

Expected transitions:
- `PENDING -> CONFIRMED`
  when payment or full group payment succeeds
- `PENDING -> EXPIRED`
  when deadline passes without successful completion
- `PENDING -> CANCELLED`
  when user/admin cancels before confirmation
- `CONFIRMED -> COMPLETED`
  after the booking time has passed
- `CONFIRMED -> CANCELLED`
  only when explicit cancellation/refund rules allow it

## Payment pool

Primary statuses:
- `PENDING`
- `FULFILLED`
- `EXPIRED`
- `CANCELLED`

Expected transitions:
- `PENDING -> FULFILLED`
  when all required money is collected
- `PENDING -> EXPIRED`
  when deadline passes without full payment
- `PENDING -> CANCELLED`
  when admin/system cancels the pool

Important rule:
- when a pool expires after partial payment, paid members must be refunded to Meda balance

## Contribution

Primary statuses:
- `PENDING`
- `PAID`
- `FAILED`
- `EXPIRED`
- `REFUNDED`

Expected transitions:
- `PENDING -> PAID`
  when contribution payment succeeds
- `PENDING -> FAILED`
  when provider payment fails
- `PENDING -> EXPIRED`
  when pool expires before payment
- `PAID -> REFUNDED`
  when the pool expires after partial completion or another refund path triggers

## Ticket

Primary statuses:
- `PURCHASED`
- `ASSIGNMENT_PENDING`
- `ASSIGNED`
- `VALID`
- `CHECKED_IN`
- `EXPIRED`
- `CANCELLED`

Expected transitions:
- `ASSIGNMENT_PENDING -> ASSIGNED`
  when a player name or assignee is attached
- `ASSIGNED -> VALID`
  when the booking is fully paid and the ticket can be used
- `VALID -> CHECKED_IN`
  when venue staff scans/checks in the ticket
- `VALID -> EXPIRED`
  after the usage window ends
- any active state -> `CANCELLED`
  only through explicit cancellation/refund logic

Important rule:
- dependent tickets kept under the purchaser account still need a player name
- claim-link tickets must not become valid before assignment/payment conditions are met

## Subscription

Primary statuses:
- `TRIAL`
- `ACTIVE`
- `PAST_DUE`
- `EXPIRED`
- `CANCELLED`

Expected business behavior:
- active plan grants host publishing access
- missed renewal should enter a 15-day grace period
- after grace ends, publishing access is revoked

## Payout

Observed conceptual states:
- ready to withdraw
- pending transfer
- paid out
- failed

Key business rule:
- payout availability must be based on current Meda balance, not only gross earnings

## Change protocol

When editing any of these flows:
1. write down the current and intended transition
2. identify which service owns the transition
3. verify idempotency for confirm/webhook/expiry paths
4. add or update targeted tests before broader UI work
