/**
 * Returns true when a non-empty selection is no longer present in the current list
 * (e.g. after refetch or filter change). Empty string selection is never stale.
 */
export function shouldClearStaleListSelection(
  selectedId: string,
  listItemIds: readonly string[],
): boolean {
  const id = selectedId.trim();
  if (!id) return false;
  return !listItemIds.includes(id);
}
