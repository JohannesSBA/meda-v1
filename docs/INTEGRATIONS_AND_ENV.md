# Meda Integrations And Environment Notes

Date: 2026-03-30

This document lists the main external integrations and the environment values the app relies on.

## Core database and auth
- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`

## Payments and payouts
- `CHAPA_SECRET_KEY`
- `CHAPA_CALLBACK_URL`
- `CHAPA_WEBHOOK_SECRET`
- `PAYOUT_ENCRYPTION_KEY`

## Email
- `EMAIL_FROM`
- `RESEND_API_KEY` or `RESEND`

## Maps
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

## Redis / rate limiting
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Storage
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET_EVENTS`

## Cron / internal jobs
- `CRON_SECRET`

## Booking and ticket defaults
- `SOCCER_CATEGORY_ID`
- `TICKET_VERIFICATION_SECRET`

## Optional test/dev flags
- `NEXT_PUBLIC_BASE_URL`
- `E2E_AUTH_BYPASS`
- `AUTH_SCHEMA`
- `AUTH_USER_TABLE`
- `MEDA_SKIP_MIGRATION_WARNING`

## Operational notes

### Prisma
- if schema changes exist locally and the database is behind, the app can compile while runtime queries fail
- the dev-time warning in `lib/prisma.ts` is meant to catch this earlier

### Chapa
- confirm callbacks and webhooks are business-critical, not optional side paths
- any change to confirmation or transfer logic needs targeted tests and manual verification

### Resend
- user-facing action emails are a product requirement in many flows
- email failures should degrade safely without corrupting booking or payout state

### Maps
- map components should fail softly when `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is missing
- address text and coordinates still need to remain usable without the interactive map
