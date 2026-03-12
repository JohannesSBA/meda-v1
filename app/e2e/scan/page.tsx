import { notFound } from "next/navigation";
import { PageShell } from "@/app/components/ui/page-shell";
import { ScanHarness } from "@/app/components/e2e/ScanHarness";
import { isE2EAuthBypassEnabled } from "@/lib/env";

export default function E2EScanPage() {
  if (!isE2EAuthBypassEnabled()) {
    notFound();
  }

  return (
    <PageShell containerClassName="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-10 sm:px-6">
      <ScanHarness />
    </PageShell>
  );
}
