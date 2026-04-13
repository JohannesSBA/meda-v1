# Refactor Plan — Phase 1 Discovery

**Aligned with:** `AGENTS.md` (logic in `services/`, thin API routes), `plan.md` (incremental, no big-bang). **Goal:** Maintainability and **clear boundaries** so Host UX and security reviews get cheaper over time.

---

## 1. Architecture principles (target)

1. **Host UI:** Shell pages stay thin; **data** comes from typed API clients calling **`services/ownerAnalytics.ts`**, `services/pitches.ts`, `services/slots.ts`, `services/bookings.ts`, etc.
2. **No new business logic in `app/components`** except UI state.
3. **One serializer family** per entity (`Event`, `BookableSlot`, `Booking`) to avoid profile vs public drift.
4. **Explicit modules** for “legacy event” vs “slot booking” to reduce accidental coupling.

---

## 2. Priority A — Component decomposition (highest ROI)

| File | ~Lines | Issue | Direction |
|------|--------|--------|-----------|
| `OwnerOperationsWorkspace.tsx` | 2200+ | God-component: calendar, pitches, slots, subscription UI | Extract: `HostCalendarPanel`, `PitchForm`, `SlotDrawer`, `SubscriptionCard`, hooks `useOwnerSlots`, `useOwnerPitches` |
| `OwnerDashboardWorkspace.tsx` | 1250+ | ERP tables + filters + exports | Extract: `OwnerBookingsTable`, `CustomersTable`, `PaymentsTable`, `OverviewKpiGrid`, `useOwnerDashboard` |
| `TicketsHubWorkspace.tsx` | 1390+ | Player ticket hub | Extract: claim/verify flows, list sections |
| `AccountWorkspace.tsx` | 1000+ | Account overview | Extract: summary cards, role sections |
| `SlotMarketplace.tsx` | 1100+ | Discovery | Extract: filters, map/list split |

**Rule of thumb:** Any file **>600 lines** with multiple `useEffect` fetch trees should be **split before** new features land.

---

## 3. Priority B — Service layer consolidation

### 3.1 Profile “my hosted events” vs `publicEvents`

**Issue:** Parallel Prisma + serializers risk **drift** from `services/publicEvents.ts`.

**Refactor:**

- Add `getHostedEventsForUser(userId)` in **`services/`** (or extend existing module) returning **the same serialized shape** as other event reads.
- Route handler becomes **one line** + error mapping.

### 3.2 Owner analytics

**Status:** `services/ownerAnalytics.ts` is the **right** aggregation point.

**Refactor:**

- Ensure **all** `/api/owner/dashboard/*` handlers call **named functions** (no inline Prisma in routes).
- Add **unit tests** for pure helpers (date ranges, utilization math).

### 3.3 Chapa API layout

**Issue:** `app/api/chapa/` vs `app/api/payments/chapa/` split confuses navigation.

**Refactor (incremental):**

- Document in `AGENTS.md` or `README`: **payments/chapa** = checkout/callback/webhook; **chapa/** = auxiliary (e.g. banks).
- Avoid adding a third root.

---

## 4. Priority C — API route hygiene

1. **Naming:** Prefer **`/api/owner/...`** for role-scoped host APIs; keep **`/api/pitches`**, **`/api/slots`** resource-oriented for CRUD—document the matrix.
2. **Validation:** Centralize Zod in `lib/validations/**`; routes parse → call service.
3. **Error shape:** Consistent JSON `{ error: string }` / problem+json (optional future).

---

## 5. Priority D — State and data fetching

- **Owner workspaces** use `browserApi` + `useEffect` heavily—consider **React Query (or Next-aligned cache)** for:
  - deduped fetches,
  - stale-while-revalidate,
  - fewer full-page spinners.

**Constraint:** Introduce incrementally on **one** workspace first (e.g. `OwnerDashboardWorkspace`).

---

## 6. Priority E — Testing strategy (ties to AGENTS Test Agent)

| Layer | Targets |
|-------|---------|
| **Integration** | Booking ownership, payment pool expiry, owner export scoping |
| **Unit** | Pure finance/KPI calculations in `ownerAnalytics` |
| **E2E** | Host navigates calendar → creates slot; player books (smoke) |

---

## 7. Migration order (refactor-safe)

1. **Extract** presentational components from `OwnerOperationsWorkspace` **without** behavior change.  
2. **Move** duplicated fetch logic into hooks/services.  
3. **Consolidate** profile hosted events into `services/`.  
4. **Add** tests on extracted pure functions.  
5. **Then** consider route-level splits (`/host/calendar`) if product approves.

---

## 8. Explicit non-refactors (for now)

- Rewriting `publicEvents.ts` filtering engine without product sign-off.  
- Merging Admin and Host.  
- Replacing Neon Auth.

---

## 9. Definition of done (refactor)

- [ ] No new **business rules** in components added during split.  
- [ ] New/changed services covered by **at least one** test where math or auth matters.  
- [ ] `npm run typecheck` and **`npm test`** green.  
- [ ] Host flows manually smoke-tested: **overview, calendar, money, exports**.

---

## 10. Summary

The codebase’s **pain is concentrated** in a handful of **mega-components** and a few **parallel data paths** (profile vs public events). **Surgical extraction** and **service consolidation** deliver the highest maintainability per line changed—**before** further Host feature growth makes the split more expensive.
