/**
 * Pure helpers for owner dashboard API query strings and display formatting.
 * Shared by {@link OwnerDashboardWorkspace}; keep free of React.
 */

export function formatOwnerDashboardCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** `YYYY-MM-DD` in local calendar for date inputs and dashboard filters. */
export function ownerDashboardDateInputFromDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export type OwnerDashboardFilterQueryArgs = {
  from: string;
  to: string;
  pitchId: string;
  customerId?: string;
};

/** Builds the query string for `/api/owner/dashboard/*` and CSV export URLs. */
export function buildOwnerDashboardQueryString(filters: OwnerDashboardFilterQueryArgs) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
  if (filters.pitchId) params.set("pitchId", filters.pitchId);
  if (filters.customerId) params.set("customerId", filters.customerId);
  return params.toString();
}
