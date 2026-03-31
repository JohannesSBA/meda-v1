import type { ReactNode } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ErrorState } from "@/app/components/ui/error-state";

type AsyncPanelStateProps = {
  loading: boolean;
  error?: string | null;
  isEmpty: boolean;
  loadingFallback: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; href: string };
  onRetry?: () => void;
  children: ReactNode;
};

export function AsyncPanelState({
  loading,
  error,
  isEmpty,
  loadingFallback,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  children,
}: AsyncPanelStateProps) {
  if (loading) {
    return <>{loadingFallback}</>;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
}
