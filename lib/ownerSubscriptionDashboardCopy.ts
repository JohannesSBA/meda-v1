/**
 * Copy strings for owner dashboard subscription tiles ({@link OwnerDashboardWorkspace}).
 * Keeps grace vs active-term branching in one testable place.
 */

export type OwnerSubscriptionDashboardMetrics = {
  endsAt: string;
  renewalAt: string | null;
  entitlementActive: boolean;
  daysRemaining: number;
  graceEndsAt: string | null;
  gracePeriodActive: boolean;
  graceDaysRemaining: number;
};

function graceOrTermEndIso(sub: OwnerSubscriptionDashboardMetrics) {
  return sub.graceEndsAt ?? sub.endsAt;
}

function formatDashboardDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

/** "Status" HostMetricTile `detail` — grace window vs active/inactive inventory access. */
export function getOwnerSubscriptionStatusMetricDetail(
  subscription: OwnerSubscriptionDashboardMetrics | null | undefined,
): string {
  if (!subscription) {
    return "Inventory access inactive";
  }
  if (subscription.gracePeriodActive) {
    return `Grace ends ${formatDashboardDate(graceOrTermEndIso(subscription))}`;
  }
  return subscription.entitlementActive
    ? "Inventory access active"
    : "Inventory access inactive";
}

/** Numeric value for "Days left" tile (grace days vs term days). */
export function getOwnerSubscriptionDaysLeftValue(
  subscription: OwnerSubscriptionDashboardMetrics | null | undefined,
): number {
  if (!subscription) {
    return 0;
  }
  return subscription.gracePeriodActive
    ? subscription.graceDaysRemaining
    : subscription.daysRemaining ?? 0;
}

/** "Days left" HostMetricTile `detail` — grace end, term end, or inactive copy. */
export function getOwnerSubscriptionDaysLeftMetricDetail(
  subscription: OwnerSubscriptionDashboardMetrics | null | undefined,
): string {
  if (!subscription) {
    return "No active term";
  }
  if (subscription.gracePeriodActive) {
    return `Grace ends ${formatDashboardDate(graceOrTermEndIso(subscription))}`;
  }
  if (subscription.endsAt) {
    return `Ends ${formatDashboardDate(subscription.endsAt)}`;
  }
  return "No active term";
}

/** "Plan" HostMetricTile `detail` — next renewal or none scheduled. */
export function getOwnerSubscriptionPlanMetricDetail(
  subscription: OwnerSubscriptionDashboardMetrics | null | undefined,
): string {
  if (!subscription?.renewalAt) {
    return "No renewal scheduled";
  }
  return `Renews ${formatDashboardDate(subscription.renewalAt)}`;
}
