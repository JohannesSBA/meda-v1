import { Card } from "@/app/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";

export default function AccountLoading() {
  return (
    <PageShell containerClassName="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="space-y-6">
        <Card className="space-y-5 p-6 sm:p-8">
          <div className="h-4 w-32 rounded-full bg-white/8" />
          <div className="h-10 max-w-3xl rounded-2xl bg-white/10" />
          <div className="h-5 max-w-2xl rounded-2xl bg-white/8" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/6"
              />
            ))}
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="h-56 bg-white/5 p-6" />
            ))}
          </div>

          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="h-72 bg-white/5 p-6" />
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
