"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "./components/ui/page-shell";
import { Button, buttonVariants } from "./components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <PageShell containerClassName="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">
        Something went wrong
      </h1>
      <p className="max-w-md text-[var(--color-text-secondary)]">
        We encountered an unexpected error. Please try again.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button variant="primary" size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants("secondary", "lg")}>
          Go home
        </Link>
        <Link href="/events" className={buttonVariants("ghost", "lg")}>
          Browse events
        </Link>
      </div>
    </PageShell>
  );
}
