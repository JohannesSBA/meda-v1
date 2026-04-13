/** Master list + fixed-width detail column (owner Customers tab). */
export const HOST_MASTER_DETAIL_GRID = "grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]";

/** Desktop table header cells (owner workbench tables). */
export const HOST_TABLE_HEAD_CLASS = "px-3 py-3";

/** Desktop table body cells. */
export const HOST_TABLE_CELL_CLASS = "px-3 py-4";

/** Row divider under thead / between logical rows. */
export const HOST_TABLE_ROW_DIVIDER_CLASS = "border-t border-[var(--color-border)]";

/**
 * Stacked mobile card / dense list row shell (ResponsiveTableCard mobile, timeline-style blocks).
 * Used across OwnerDashboardWorkspace row cards and OwnerOperationsWorkspace slot rows.
 */
export const HOST_WORKBENCH_LIST_CARD_CLASS =
  "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4";

/** Compact history line item (bordered, no fill). */
export const HOST_WORKBENCH_TIMELINE_ENTRY_CLASS =
  "rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3";
