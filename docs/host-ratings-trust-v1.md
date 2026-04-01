# Host Ratings & Trust Signals (v1)

## Schema decisions

- Added `host_reviews` as an immutable per-attendee/per-event rating record with `unique(reviewer_id, event_id)` to enforce one review per attendee-event pair.
- Added `host_trust_metrics` as a persisted aggregate/read model for low-latency listing/detail rendering.
- Trust badge is an enum (`HostTrustBadge`) to keep UI states constrained and easy to evolve.

## Trust score formula (v1)

`trustScore` is a weighted score out of 100:

- Rating quality (avgRating/5): 45%
- Attendance rate: 20%
- Cancellation penalty (1 - cancellationRate): 15%
- Refund penalty (1 - refundRate): 10%
- Repeat player rate: 10%

Version stored in `trust_score_version = "v1"`.

Badge mapping:

- `< 3 reviews` => `NEW_HOST`
- `>= 85` => `HIGHLY_RATED`
- `>= 70` => `RELIABLE_HOST`
- else => `NEEDS_IMPROVEMENT`

## Follow-up recommendations (v2)

1. Move trust recomputation to event-driven jobs (queue/worker) for higher write throughput.
2. Add explicit host-cancelled event signal when event cancellation lifecycle exists.
3. Add tag-level quality analytics and anomaly flags for abuse detection.
4. Add confidence intervals / Bayesian smoothing for low-volume hosts to reduce early volatility.
