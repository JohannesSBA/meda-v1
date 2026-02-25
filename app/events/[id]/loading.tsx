import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import {
  Skeleton,
  SkeletonText,
  EventCardSkeleton,
} from "@/app/components/ui/skeleton";

export default function EventDetailLoading() {
  return (
    <PageShell>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="space-y-6 rounded-3xl bg-[#0d1a27]/80 p-6 backdrop-blur">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[#0f2235]/60 p-4">
              <EventCardSkeleton />
            </div>
            <article className="space-y-4">
              <Skeleton className="h-6 w-16" />
              <SkeletonText lines={4} />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </article>
          </Card>

          <div className="space-y-4">
            <Card className="space-y-2 rounded-3xl bg-[#0b1624]/90 p-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
            </Card>
            <Card className="space-y-4 rounded-3xl bg-[#0b1624]/90 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </Card>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
