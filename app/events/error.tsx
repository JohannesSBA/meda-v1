/**
 * Events page error boundary -- shows error and retry for events listing.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";
import { Button, buttonVariants } from "../components/ui/button";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Events error:", error);
  }, [error]);

  return (
    <PageShell containerClassName="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
        Unable to load events
      </h1>
      <p className="max-w-md text-[var(--color-text-secondary)]">
        Something went wrong while loading this page. Please try again.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button variant="primary" size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/play?mode=events" className={buttonVariants("secondary", "lg")}>
          All matches
        </Link>
        <Link href="/" className={buttonVariants("ghost", "lg")}>
          Go home
        </Link>
      </div>
    </PageShell>
  );
}
