import { PageShell } from "@/app/components/ui/page-shell";
import { Skeleton, SkeletonText } from "@/app/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <PageShell containerClassName="relative mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </PageShell>
  );
}
