"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";
import { Button, buttonVariants } from "../components/ui/button";

export default function CreateEventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Create event error:", error);
  }, [error]);

  return (
    <PageShell containerClassName="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
        Unable to load event form
      </h1>
      <p className="max-w-md text-[var(--color-text-secondary)]">
        Something went wrong. Please try again.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button variant="primary" size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/events" className={buttonVariants("secondary", "lg")}>
          Browse events
        </Link>
        <Link href="/" className={buttonVariants("ghost", "lg")}>
          Go home
        </Link>
      </div>
    </PageShell>
  );
}
