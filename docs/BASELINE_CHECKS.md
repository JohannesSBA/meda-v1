# Meda Baseline Checks

Date: 2026-03-30

Use this checklist before and after each meaningful refactor tranche.

## Minimum commands

### Always
- `npm run typecheck`

### Usually
- `npx eslint <touched files>`

### When business logic changes
- run the narrowest relevant Vitest file first
- example:
  - payments change -> `__tests__/services/payments-split.test.ts`
  - refund change -> `__tests__/services/refunds.test.ts`
  - event fee change -> `__tests__/services/eventCreationFee.test.ts`

### Before high-risk merges
- `npm test`
- `npm run test:e2e`

## Manual smoke checks

### Player
- `/play` loads
- slot discovery loads
- event discovery loads
- `/tickets` loads when signed in
- QR and map links render on ticket items

### Host
- `/host` loads for pitch owner
- can open place editor
- can edit saved place details
- can open booking-time form
- owner dashboard tabs load

### Admin
- `/admin` loads for admin
- core tabs render

## Baseline risks to watch
- schema drift after Prisma changes
- route alias drift after IA changes
- regressions in Chapa callback/confirm flows
- group payment expiry/refund logic
- payout availability calculation

## Current baseline notes
- `npm run typecheck` passed at audit time
- recent targeted eslint checks passed on touched modernization files
- full repo lint and full automated suite should still be re-run before major merge
