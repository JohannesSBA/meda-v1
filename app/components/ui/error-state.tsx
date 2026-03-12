/**
 * ErrorState -- displays error message with optional retry button.
 */

import { Card } from "./card";
import { Button } from "./button";
import { cn } from "./cn";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-5 border-[rgba(251,113,133,0.3)] bg-[linear-gradient(180deg,rgba(69,10,10,0.45),rgba(31,9,10,0.72))] px-6 py-12 text-center",
        className,
      )}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.16)] text-[#fecdd3]"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Something went wrong</h3>
        <p className="text-sm leading-6 text-[#fecdd3]">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}
