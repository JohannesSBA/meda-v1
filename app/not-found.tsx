import Link from "next/link";
import { PageShell } from "./components/ui/page-shell";
import { buttonVariants } from "./components/ui/button";

export default function NotFound() {
  return (
    <PageShell containerClassName="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">
        Page not found
      </h1>
      <p className="max-w-md text-[var(--color-text-secondary)]">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/" className={buttonVariants("primary", "lg")}>
          Go home
        </Link>
        <Link href="/events" className={buttonVariants("secondary", "lg")}>
          Browse events
        </Link>
      </div>
    </PageShell>
  );
}
