# Security Findings — Phase 1 Discovery

**Method:** Static review of auth (`lib/auth/*`), `middleware.ts`, `lib/env.ts`, representative `app/api/**` routes, and agent grep notes. **Not** a penetration test. **Severity** is practical (exploitability + impact in typical deployment).

---

## Executive summary

- **Authorization is route-local:** `/api` is **outside** the Next middleware matcher; every handler must enforce session + role + **resource ownership**. The codebase **mostly** delegates ownership to services—**good pattern**—but consistency and review cost are real risks.
- **Coarse role guards** (`requirePitchOwnerUser`, etc.) **do not** imply row-level access; IDOR defenses live in **service queries**—those must stay mandatory in code review.
- **E2E auth bypass** is powerful; production safety depends on **`NODE_ENV` + `E2E_AUTH_BYPASS`** discipline.
- **Information disclosure by ID** exists for **intentionally public** artifacts (e.g. ICS, public host summaries)—validate against product privacy expectations.

---

## Findings (severity-ranked)

### S1 — Middleware excludes `/api` (design) + inconsistent guard idioms (maintainability risk)

**Description:** `middleware.ts` only wraps selected page routes. All API auth is per-file. Subagent noted mixed patterns: `if (!session.user \|\| session.response)` vs `if (sessionCheck.response)`.

**Impact:** No automatic network-layer auth for APIs; a **missing** guard on a new route is a **full class** of vulnerability. Style drift makes audits slower.

**Recommendation:**  
- Add a **checklist** in PR template: new `route.ts` → session + role + service ownership.  
- Optionally introduce **small helpers** (`returnOrUnauthorized(session)`) to unify patterns.  
- Consider **middleware** or **edge wrapper** only for `/api/owner/**` if you want defense-in-depth (optional; may complicate cookie/session story).

---

### S2 — E2E authentication bypass (`meda_e2e_user`)

**Location:** `lib/auth/server.ts`, `lib/env.ts`, `middleware.ts`.

**Description:** When `E2E_AUTH_BYPASS=1` and non-production, a cookie can impersonate a user.

**Impact:** **Critical** if misconfigured in staging exposed to internet; **intended** for CI/local.

**Recommendation:**  
- Enforce **explicit** deny in production builds (assert at startup).  
- Document in runbooks; restrict staging env secrets.  
- Never enable on public preview URLs without IP allowlist.

---

### S3 — Role from DB enrichment; Edge skips enrichment

**Description:** `getEnrichedSessionUser` skips DB on Edge; elsewhere role comes from DB-backed enrichment (`enrichSessionUser`).

**Impact:** Edge routes (if any grow) might see **stale/default** roles—**privilege surprise** if sensitive actions run on Edge without alignment.

**Recommendation:** Flag any **Edge** API routes; keep **sensitive mutations** on Node runtime with full enrichment.

---

### S4 — Resource ownership in services (IDOR) — pattern good, coverage must be verified

**Examples of safer patterns (from review):**

- `getBookingForUser`, `getPaymentPoolForUser`, `getPartyForUser` style delegation.
- Composite keys: `eventId` + `userId` for waitlist / my-attendees.

**Risk:** Any `findUnique({ where: { id } })` **without** owner predicate in **service** layer is a candidate IDOR. **Ticket / booking / party** IDs are guessable UUIDs—**never** rely on obscurity.

**Recommendation:**  
- Grep for `findUnique`/`findFirst` in `services/` with **only** id from client.  
- Add **integration tests** that attempt cross-user access for core resources.

---

### S5 — Public-by-design endpoints (information disclosure)

| Example | Auth | Risk |
|---------|------|------|
| `GET /api/events/[id]/ics` | None | Anyone with `eventId` gets **ICS** with event details—OK if events are public listings; **not OK** for “secret” events. |
| Host review summary by `hostId` | None | Public aggregate—confirm marketing intent. |
| Public event list / categories | None | Expected. |

**Recommendation:** Product decision: **draft/unlisted** events (if introduced) must not be ICS-exportable without capability token.

---

### S6 — Webhooks and cron secrets

**Description:** Chapa webhook uses shared secret; cron routes use `CRON_SECRET` bearer pattern.

**Impact:** Weak or leaked secrets → forged payment or job execution.

**Recommendation:** Rotate secrets in incident response playbook; **log** verification failures without echoing secrets.

---

### S7 — Secrets in client boundary

**Description:** `NEXT_PUBLIC_*` vars are visible; ticket verification and similar must rely on **server-only** secrets (`TICKET_VERIFICATION_SECRET` in server helpers).

**Impact:** Mis-hydrated secret to client would be **critical**—audit any `NEXT_PUBLIC` related to crypto.

---

### S8 — Rate limiting

**Description:** Some routes use `checkRateLimit` (e.g. create event); not uniformly applied to all mutating APIs.

**Impact:** Abuse / cost / DoS-ish patterns on expensive endpoints.

**Recommendation:** Extend rate limits to **host mutations** (slot create, payout-adjacent) proportionally.

---

### S9 — CSV / owner exports

**Location:** `app/api/owner/dashboard/exports/*.csv`

**Description:** Must enforce **pitch_owner** (or admin) + **scope to owner-owned data** only.

**Impact:** Export routes are **high-value**; any bug → bulk PII leak.

**Recommendation:** **Integration tests** with two users; verify 403/empty for wrong owner.

---

### S10 — `secure-api-route` sample

**Description:** Unusual route name suggests demo or placeholder; if it only checks “logged in,” it’s a **footgun** for copy-paste.

**Recommendation:** Remove or rename; mark clearly in code if kept for docs.

---

## Positive observations

- **Webhook** verification pattern (HMAC/secret) exists for Chapa.  
- **Guards** module centralizes role checks.  
- **User-scoped** Prisma queries appear frequently in user-specific flows.  
- **Payout encryption** uses dedicated key (`PAYOUT_ENCRYPTION_KEY`).

---

## Prioritized remediation backlog (for Phase 3)

1. **Production assertion:** E2E bypass cannot activate when `NODE_ENV===production`.  
2. **Export routes:** Automated cross-tenant tests.  
3. **Service audit:** `findUnique` by id-only for protected resources.  
4. **PR checklist:** API auth + ownership + rate limit.  
5. **Document** public ICS and host summary endpoints as **data classification** decisions.

---

## Out of scope (this pass)

- Dependency CVE scanning.  
- WAF / infra TLS.  
- Neon Auth vendor bugs.  
- Full Chapa signature specification review.
