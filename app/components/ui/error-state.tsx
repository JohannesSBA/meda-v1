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
        "flex flex-col items-center justify-center gap-4 rounded-2xl border-red-500/40 bg-red-900/30 px-6 py-10 text-center",
        className,
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-400/50 bg-red-500/20 text-red-200"
        aria-hidden
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
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
      <p className="text-red-200">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}
