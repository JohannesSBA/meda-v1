# Payout & Split Payment Changes

Summary of changes made to the payout flow and split payments for pitch owner events.

---

## Pitch Owner & Facilitator Roles

### Overview

Meda extends the base auth roles (`admin`, `user`) with two marketplace roles stored in the database:

- **Pitch owner** – Can create paid events and receive ticket revenue (minus platform commission)
- **Facilitator** – Can scan tickets for events owned by a specific pitch owner

Neon Auth only supports `admin` and `user`. The `pitch_owner` and `facilitator` roles are derived from our DB and added to the session at runtime.

---

### Pitch Owner

**What they can do:**

- Create events (including paid events)
- Receive ticket payments: 95% to their bank via Chapa subaccount, 5% platform commission
- Manage facilitators for their events
- View their events and payout settings in the profile Payout tab

**Setup:**

1. Admin promotes a user to pitch owner via the admin users table (e.g. `POST /api/admin/pitch-owners` with `{ userId }`)
2. A `PitchOwnerProfile` record is created for that user
3. Pitch owner must complete payout setup: bank details → Chapa subaccount creation → `chapaSubaccountId` and `payoutSetupVerifiedAt` stored
4. Until payout is complete, paid events created by the pitch owner cannot accept ticket payments (checkout returns "Payout setup incomplete")

**Data model:**

- `PitchOwnerProfile` – `userId`, `chapaSubaccountId`, `splitType`, `splitValue`, `payoutSetupVerifiedAt`, encrypted bank details

---

### Facilitator

**What they can do:**

- Scan tickets for events owned by the pitch owner who added them
- Access the Scan tab in the profile (or event scan page) for those events only

**Setup:**

1. Pitch owner adds a facilitator (by user ID or email) via the Facilitators tab in their profile
2. A `Facilitator` record is created linking `facilitatorUserId` to `pitchOwnerUserId`
3. Facilitator must be marked `isActive: true`

**Restriction:** Facilitators can only scan tickets for events where `event.userId === pitchOwnerUserId` (i.e. events created by the pitch owner who added them).

**Data model:**

- `Facilitator` – `facilitatorUserId`, `pitchOwnerUserId`, `isActive`

---

### Auth Guards

- `requirePitchOwnerUser()` – Requires `user.role === "pitch_owner"`
- `requireFacilitatorUser()` – Requires `user.role === "facilitator"`
- `requireAdminOrPitchOwnerUser()` – For routes usable by both
- `canManageEvent(user, eventUserId)` – Admin or pitch owner who owns the event
- `canCreateEvent(user)` – Admin or pitch owner

Session enrichment (e.g. in `lib/auth/server.ts` or a middleware) looks up `PitchOwnerProfile` and `Facilitator` by `userId` and sets `user.role` accordingly.

---

### Hierearchy

- `admin` makes `pitch-owner` and `facilitators`
  =

## 1. Chapa Subaccount Response Parsing

**Problem:** Chapa's create subaccount API returns the ID in `data.subaccount_id`, but the code expected `data.id`. Subaccounts were created in Chapa's dashboard but not stored in our database.

**Fix:** Updated `services/pitchOwner.ts` to parse multiple response formats:

- `data.subaccount_id` (actual Chapa API format)
- `data["subaccounts[id]"]` (per Chapa docs)
- `data.id`, `data.subaccounts.id`
- `data` as string (raw UUID)

---

## 2. Payout UI Behavior

**Problem:** Form was always shown even when a subaccount existed; saved subaccount wasn't clearly displayed.

**Fix:** Updated `app/components/profile/PayoutSettingsTab.tsx`:

- **When subaccount exists:** Show only the saved subaccount (bank last 4, subaccount ID, confirmation message). Form is hidden.
- **When no subaccount:** Show only the form to create one via Chapa API.

---

## 3. Manual Subaccount Linking Removed

**Previous behavior:** Optional "Subaccount ID" field allowed pasting an ID from Chapa dashboard.

**Change:** Removed manual linking. Subaccounts are created only via the Chapa API when the pitch owner submits the payout form.

---

## 4. Balance Payment Split

**Problem:** When a user paid with Meda balance for a pitch owner event, the platform kept 100%. The pitch owner received nothing.

**Fix:** Updated `services/payments.ts` in `payWithBalance()`:

- For pitch owner events (with payout setup complete):
  - Platform keeps 5% (same as Chapa split)
  - Pitch owner's `UserBalance` is credited with 95%
- Uses `PLATFORM_COMMISSION_PERCENT` from `services/pitchOwner.ts`

**Note:** Refunds of balance-paid tickets do not yet reverse the pitch owner's share. That may be a future enhancement.

---

## 5. Chapa Checkout Debug Logging

**Purpose:** Debug why Chapa split payments might not apply (e.g. full amount to platform instead of 5%).

**Change:** Added logging in `services/payments.ts` when initializing Chapa checkout (non-production only):

- `hasSubaccounts`
- `subaccounts` (id, split_type, split_value)
- `amount`

Log output example:

```
[timestamp] INFO [chapa] Initialize payload {"hasSubaccounts":true,"subaccounts":{"id":"...","split_type":"percentage","split_value":0.05},"amount":"20.00"}
```

---

## Files Modified

| File                                           | Changes                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `services/pitchOwner.ts`                       | Chapa response parsing, removed manual subaccount linking |
| `services/payments.ts`                         | Balance payment split, Chapa debug logging                |
| `app/api/profile/payout/route.ts`              | Removed subaccountId from schema                          |
| `app/components/profile/PayoutSettingsTab.tsx` | Conditional UI: subaccount display vs form                |

---

## Payout Flow Summary

1. **Pitch owner setup:** Fill payout form → Chapa creates subaccount → we store `chapaSubaccountId` and `payoutSetupVerifiedAt`.
2. **Chapa payment:** User pays via Chapa → Chapa splits 5% platform / 95% pitch owner (automatic).
3. **Balance payment:** User pays with Meda balance → we credit pitch owner's `UserBalance` with 95%.
