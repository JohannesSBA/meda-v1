import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";

export function HostPanelLoading({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <Card
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("p-8 text-center text-sm text-[var(--color-text-secondary)]", className)}
    >
      {message}
    </Card>
  );
}
