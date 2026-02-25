import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <PageShell containerClassName="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="w-full space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </Card>
    </PageShell>
  );
}
