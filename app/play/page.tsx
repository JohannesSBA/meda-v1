import { Suspense } from "react";
import { EventCardSkeleton } from "@/app/components/ui/skeleton";
import { PageShell } from "@/app/components/ui/page-shell";
import { PlayWorkspace } from "./PlayWorkspace";

export const dynamic = "force-dynamic";

export default function PlayPage() {
  return (
    <Suspense fallback={<PlayFallback />}>
      <PlayWorkspace />
    </Suspense>
  );
}

function PlayFallback() {
  return (
    <PageShell containerClassName="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </PageShell>
  );
}
