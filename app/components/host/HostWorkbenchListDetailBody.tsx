import type { ReactNode } from "react";
import { HostEmptyState } from "@/app/components/host/HostEmptyState";

type HostWorkbenchListDetailBodyProps = {
  /**
   * Master list has no rows (e.g. filters produced an empty result).
   * Body is omitted unless `listEmptyInsetMessage` is set (calendar week edge case).
   */
  listEmpty: boolean;
  /** Optional dashed inset under the header when the master list is empty. */
  listEmptyInsetMessage?: ReactNode;
  /** Master has rows but nothing is selected / no detail rows (e.g. no slots for the day). */
  idleMessage: ReactNode;
  /** When true, render `children` (detail content). */
  hasDetail: boolean;
  children: ReactNode;
};

/**
 * Standard paired list/detail body: optional master-empty inset, idle CTA, or detail content.
 */
export function HostWorkbenchListDetailBody({
  listEmpty,
  listEmptyInsetMessage,
  idleMessage,
  hasDetail,
  children,
}: HostWorkbenchListDetailBodyProps) {
  if (listEmpty) {
    return listEmptyInsetMessage ? (
      <HostEmptyState message={listEmptyInsetMessage} />
    ) : null;
  }
  if (!hasDetail) {
    return <HostEmptyState message={idleMessage} />;
  }
  return children;
}
