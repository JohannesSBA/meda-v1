# Authorization Role Contract

## Canonical field

Use `session.user.role` for **all authorization decisions**.

- `role` is normalized to one of: `admin`, `pitch_owner`, `facilitator`, `user`.
- Any malformed, missing, or unknown role value is normalized to `user`.
- Runtime helpers and route guards must read `role`, never raw provider fields.

## `authRole` is informational only

`session.user.authRole` captures Neon payload role metadata for diagnostics and admin visibility.

- It is not authoritative for capability checks.
- It may differ from `role` because `role` is derived from Neon auth state plus DB-backed marketplace relationships.
- It may contain unexpected or malformed input from auth payloads and should never drive permissions.

## Runtime contract behavior

- **Server runtime** enriches role with marketplace relationships (`pitch_owner` / `facilitator`) and preserves `authRole` for traceability.
- **Edge runtime** cannot perform DB enrichment, so it still normalizes into the same role contract shape and treats malformed values safely.

This contract keeps authorization deterministic while retaining auth provider context for debugging.
