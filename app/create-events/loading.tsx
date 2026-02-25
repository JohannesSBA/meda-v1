import { PageShell } from "@/app/components/ui/page-shell";
import { Skeleton, SkeletonText } from "@/app/components/ui/skeleton";

export default function CreateEventsLoading() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-12 w-3/4" />
        <SkeletonText className="mt-3" lines={3} />
      </header>
      <div className="flex flex-col gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-3">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-24 rounded-xl" />
        </div>
      </div>
    </PageShell>
  );
}
