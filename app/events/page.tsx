import { Suspense } from "react";
import { PageShell } from "../components/ui/page-shell";
import { EventCardSkeleton } from "../components/ui/skeleton";
import EventsPageClient from "./EventsPageClient";

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsPageFallback />}>
      <EventsPageClient />
    </Suspense>
  );
}

function EventsPageFallback() {
  return (
    <PageShell>
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </PageShell>
  );
}
